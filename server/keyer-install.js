import { access, mkdir, mkdtemp, readdir, rename, stat, statfs, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import path from "node:path";
import { keyerRuntime } from "./keyer.js";

export const corridorKeySourceRevision = "485f5e9ab759ead6138cc990776184b59d6ea971";
export const corridorKeyWeightsRevision = "cf44a8db3f024bb49fd59daa408848ccf05f7477";
const uvVersion = "0.13.5";
const uvAssets = {
  win32: { name: "uv-x86_64-pc-windows-msvc.zip", sha: "a38b8d1902b7cfbc76b423ba1bb456f623f42064cdc72628b6075b89afd1019a", binary: "uv.exe" }
};
const assets = ["weights/corridorkey_v2.safetensors", "weights/foundation_stats.safetensors", "vfms/cradio/C-RADIOv4-SO400M/model.safetensors", "vfms/moge/model.pt", "vfms/rvm/pretrain_rvm_small16_256_204031069.npz"];
const pythonProbe = `import json, sys
try:
 assert sys.version_info[:2] == (3, 12), 'Python 3.12 is required'
 import torch, torchvision, numpy, cv2, transformers, timm, safetensors, huggingface_hub, einops, scipy, PIL, tqdm, utils3d
 assert torch.__version__.split('+')[0] == '2.9.1', 'PyTorch 2.9.1 is required'
 assert torchvision.__version__.split('+')[0] == '0.24.1', 'torchvision 0.24.1 is required'
 assert numpy.__version__.split('.')[0] == '1', 'NumPy 1.x is required'
 assert torch.cuda.is_available(), 'CUDA is unavailable; a compatible NVIDIA driver and CUDA PyTorch are required'
 assert torch.cuda.get_device_capability(0)[0] >= 8, 'The selected GPU must support bfloat16 (RTX 30-series or newer)'
 assert float(torch.ones(1, device='cuda').sum().item()) == 1
 print('NEWT_KEYER_PROBE='+json.dumps({'ok': True, 'gpu': torch.cuda.get_device_name(0)}))
except Exception as error:
 print('NEWT_KEYER_PROBE='+json.dumps({'ok': False, 'reason': str(error)[:300]}))
`;
// These direct dependencies match the environment verified with this engine.
// utils3d uses a commit archive so no global Git installation is needed.
export const corridorKeyRequirements = `numpy==1.26.4
opencv-python==4.11.0.86
transformers==4.57.6
timm==1.0.30
safetensors==0.8.0
huggingface-hub==0.36.2
einops==0.8.2
scipy==1.17.1
pillow==12.3.0
tqdm==4.70.1
utils3d @ https://github.com/EasternJournalist/utils3d/archive/83bfa5bda008803f6521ce9547f94023b8afeddd.zip
`;
const fileExists = file => access(file).then(() => true, () => false);
const validAsset = file => stat(file).then(info => info.isFile() && info.size > 8, () => false);

export function runSetupCommand(command, args, { cwd, env, timeoutMs = 3600000, onOutput } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, windowsHide: true, shell: false });
    let stdout = "", tail = "", timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, timeoutMs);
    child.stdout.on("data", chunk => { stdout = (stdout + chunk).slice(-16000); onOutput?.(chunk.toString()); });
    child.stderr.on("data", chunk => { tail = (tail + chunk).slice(-4000); onOutput?.(chunk.toString()); });
    child.once("error", error => { clearTimeout(timer); reject(new Error(`Could not start ${path.basename(command)}: ${error.message}`)); });
    child.once("close", code => {
      clearTimeout(timer);
      if (code === 0 && !timedOut) resolve({ stdout });
      else reject(new Error(timedOut ? `${path.basename(command)} setup timed out; retry to resume.` : `${path.basename(command)} setup failed (${code}). ${(tail || stdout).trim().slice(-1800)}`));
    });
  });
}

export async function downloadSetupFile(url, destination, sha256) {
  await mkdir(path.dirname(destination), { recursive: true });
  const response = await fetch(url, { signal: AbortSignal.timeout(600000) });
  if (!response.ok || !response.body) throw new Error(`Setup download failed: HTTP ${response.status} from ${new URL(url).hostname}. Retry when online.`);
  const temporary = destination + ".part";
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  if (sha256) {
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(temporary)) hash.update(chunk);
    if (hash.digest("hex") !== sha256) throw new Error("The downloaded setup tool failed its SHA-256 integrity check. It was not executed.");
  }
  await rename(temporary, destination);
}

export function compatibleKeyerGpu(query, banner = "") {
  const gpu = String(query).trim().split(/\r?\n/).some(line => {
    const [capability, memory] = line.split(",").map(value => Number(value.trim()));
    return capability >= 8 && memory >= 4000;
  });
  const cuda = banner.match(/CUDA(?: UMD)? Version:\s*([\d.]+)/i)?.[1];
  const [major, minor] = String(cuda || "0.0").split(".").map(Number);
  return gpu && (major > 12 || major === 12 && minor >= 8);
}

export async function probeKeyerHardware(run = runSetupCommand) {
  try {
    const [{ stdout: query }, { stdout: banner }] = await Promise.all([
      run("nvidia-smi", ["--query-gpu=compute_cap,memory.total", "--format=csv,noheader,nounits"], { timeoutMs: 10000 }),
      run("nvidia-smi", [], { timeoutMs: 10000 })
    ]);
    return compatibleKeyerGpu(query, banner)
      ? { supported: true }
      : { supported: false, message: "CorridorKey requires a bfloat16-capable NVIDIA GPU (RTX 30-series or newer), at least 4 GB VRAM, and a driver supporting CUDA 12.8+. Update the NVIDIA driver if needed." };
  } catch { return { supported: false, message: "No compatible NVIDIA driver was found. Install an NVIDIA driver supporting CUDA 12.8+; GPU drivers cannot be installed by Newt Node." }; }
}

export async function probeKeyerPython(python, run = runSetupCommand) {
  try {
    const { stdout } = await run(python, ["-c", pythonProbe], { timeoutMs: 120000 });
    const line = stdout.split(/\r?\n/).findLast(line => line.startsWith("NEWT_KEYER_PROBE="));
    return line ? JSON.parse(line.slice("NEWT_KEYER_PROBE=".length)) : { ok: false, reason: "Python preflight did not complete" };
  } catch { return { ok: false, reason: "Python or its CUDA dependencies could not be loaded" }; }
}

export function createKeyerInstaller({ baseDir, env = process.env, platform = process.platform, arch = process.arch, run = runSetupCommand, download = downloadSetupFile, hardware = () => probeKeyerHardware(run), probe = python => probeKeyerPython(python, run), freeBytes = async () => { const s = await statfs(baseDir); return s.bavail * s.bsize; } }) {
  const runtime = () => keyerRuntime(env, platform, baseDir);
  const commandEnv = { UV_CACHE_DIR: path.join(baseDir, "uv-cache"), UV_PYTHON_INSTALL_DIR: path.join(baseDir, "python"), UV_PYTHON_BIN_DIR: path.join(baseDir, "bin"), UV_LINK_MODE: "copy", HF_HOME: path.join(baseDir, "huggingface"), HF_HUB_DISABLE_SYMLINKS_WARNING: "1", PYTHONUNBUFFERED: "1" };
  let pending, message = "", cached, cacheAt = 0, inspection;
  // Live install progress (0..1), the current step, and the latest line of tool output.
  const totalSteps = 6;
  let progress = 0, step = 0, detail = "", startedAt = 0;
  const bar = (value, stepNumber) => { progress = Math.max(progress, Math.min(1, value)); if (stepNumber) step = Math.max(step, stepNumber); };
  // Feed a running tool's output into the progress state; tqdm-style "NN%|" lines move the bar inside [low, high].
  const watch = (low, high) => ({ onOutput: chunk => {
    for (const raw of String(chunk).split(/[\r\n]+/)) {
      const line = raw.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").trim();
      if (!line) continue;
      detail = line.slice(0, 160);
      const percent = line.match(/(\d{1,3})%\|/)?.[1];
      if (percent !== undefined) bar(low + (high - low) * Math.min(100, Number(percent)) / 100);
    }
  } });
  async function inspect() {
    if (platform === "darwin") return { ready: false, canInstall: false, message: "The open CorridorKey 2.0 engine requires NVIDIA CUDA and cannot run locally on macOS. No CUDA packages or model weights will be downloaded." };
    if (platform !== "win32" || arch !== "x64") return { ready: false, canInstall: false, message: "CorridorKey automatic setup requires Windows x64 and NVIDIA CUDA. This platform is unsupported." };
    const gpu = await hardware();
    if (!gpu.supported) return { ready: false, canInstall: false, message: gpu.message };
    const r = runtime();
    if (env.NEWTNODE_CORRIDORKEY_PYTHON && !await fileExists(r.python)) return { ready: false, canInstall: false, message: "The configured CorridorKey Python path is missing. Remove the Python override to use automatic setup." };
    const source = await fileExists(path.join(r.root, "infer.py"));
    const python = await fileExists(r.python);
    const weights = (await Promise.all(assets.map(file => validAsset(path.join(r.root, file))))).every(Boolean);
    const packages = source && python ? await probe(r.python) : { ok: false };
    const ready = source && python && weights && packages.ok;
    return { ready, canInstall: true, message: ready ? "CorridorKey 2.0 ready · Local GPU" : "CorridorKey 2.0 is not installed. Click Install to download the missing components (about 8 GB on a new system)." };
  }
  async function status(force = false) {
    if (pending) return { ready: false, canInstall: true, installing: true, message, progress, step, steps: totalSteps, detail, startedAt };
    if (!force && cached && Date.now() - cacheAt < 30000) return cached;
    if (!inspection) inspection = inspect().then(value => { cached = value; cacheAt = Date.now(); return value; }).finally(() => { inspection = null; });
    return inspection;
  }
  async function unpack(archive, destination, strip = false) {
    await mkdir(destination, { recursive: true });
    const { stdout } = await run("tar", ["-tf", archive], { timeoutMs: 30000 });
    if (stdout.split(/\r?\n/).filter(Boolean).some(file => /^(?:[/\\]|[a-z]:)/i.test(file) || file.split(/[/\\]/).includes(".."))) throw new Error("Unsafe archive paths; setup was stopped.");
    await run("tar", ["-xf", archive, "-C", destination, ...(strip ? ["--strip-components=1"] : [])], { timeoutMs: 60000 });
  }
  async function install(onProgress) {
    const report = (text, value, stepNumber) => { message = text; detail = ""; if (value !== undefined) bar(value, stepNumber); onProgress?.(text, progress); };
    progress = 0; step = 0; detail = ""; startedAt = Date.now();
    const before = await inspect();
    if (before.ready) return runtime();
    if (!before.canInstall) throw new Error(before.message);
    await mkdir(baseDir, { recursive: true });
    if (await freeBytes() < 20 * 1024 ** 3) throw new Error("CorridorKey setup needs at least 20 GB free disk space for packages, weights and download caches.");
    const r = runtime();
    const temporary = await mkdtemp(path.join(baseDir, "setup-"));
    const tool = uvAssets[platform];
    const uv = path.join(baseDir, "tools", tool.binary);
    if (!await fileExists(uv)) {
      report("Installing the Python setup tool…", 0.01, 1);
      const archive = path.join(temporary, tool.name);
      await download(`https://github.com/astral-sh/uv/releases/download/${uvVersion}/${tool.name}`, archive, tool.sha);
      await unpack(archive, path.join(baseDir, "tools"));
    }
    bar(0.03, 1);
    if (!await fileExists(path.join(r.root, "infer.py"))) {
      if (await fileExists(r.root) && (await readdir(r.root)).length) throw new Error("The configured CorridorKey folder contains unrelated files. Select an empty folder or remove the root override for managed setup.");
      report("Downloading the CorridorKey 2.0 engine…", 0.04, 2);
      const archive = path.join(temporary, "engine.tar.gz");
      await download(`https://codeload.github.com/nikopueringer/CorridorKey2.0/tar.gz/${corridorKeySourceRevision}`, archive);
      await unpack(archive, r.root, true);
    }
    bar(0.08, 2);
    if (!await fileExists(r.python)) {
      report("Installing isolated Python 3.12…", 0.09, 3);
      await run(uv, ["venv", "--python", "3.12", "--managed-python", "--seed", "--allow-existing", path.join(r.root, "venv")], { env: commandEnv, ...watch(0.09, 0.12) });
    }
    bar(0.12, 3);
    if (!(await probe(r.python)).ok) {
      report("Installing CUDA PyTorch and Python dependencies… (the largest download, several GB)", 0.12, 4);
      await run(uv, ["pip", "install", "--python", r.python, "--reinstall-package", "torch", "--reinstall-package", "torchvision", "torch==2.9.1", "torchvision==0.24.1", "--index-url", "https://download.pytorch.org/whl/cu128"], { env: commandEnv, ...watch(0.12, 0.35) });
      bar(0.35);
      // Avoid Git and isolated-build interpreter discovery on Windows.
      await run(uv, ["pip", "install", "--python", r.python, "setuptools==78.1.0", "wheel"], { env: commandEnv, ...watch(0.35, 0.37) });
      const requirements = path.join(baseDir, "requirements-corridorkey.txt");
      await writeFile(requirements, corridorKeyRequirements);
      await run(uv, ["pip", "install", "--no-build-isolation", "--python", r.python, "-r", requirements], { env: commandEnv, ...watch(0.37, 0.45) });
    }
    bar(0.45, 4);
    report("Downloading or resuming CorridorKey and foundation model weights… (about 8 GB)", 0.46, 5);
    await run(r.python, ["-u", "scripts/download_weights.py", "--corridorkey_revision", corridorKeyWeightsRevision], { cwd: r.root, env: commandEnv, ...watch(0.46, 0.96) });
    report("Verifying Python dependencies, model files and CUDA execution…", 0.97, 6);
    cached = null;
    const after = await inspect();
    if (!after.ready) throw new Error("CorridorKey setup could not verify CUDA and all dependencies. Check the NVIDIA driver and retry; downloaded files are retained.");
    await writeFile(path.join(baseDir, "installation.json"), JSON.stringify({ sourceRevision: corridorKeySourceRevision, weightsRevision: corridorKeyWeightsRevision, verifiedAt: new Date().toISOString() }, null, 2));
    cached = after; cacheAt = Date.now();
    return r;
  }
  return { runtime, status, async ensure(onProgress) {
    if (!pending) pending = install(onProgress).finally(() => { pending = null; cached = null; });
    return pending;
  } };
}

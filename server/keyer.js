import { access, copyFile, mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { keyerModelName, keyerInputError } from "../src/keyer.js";

const exists = file => access(file).then(() => true, () => false);
export function keyerRuntime(env = process.env, platform = process.platform, baseDir = fileURLToPath(new URL("./data/corridorkey/", import.meta.url))) {
  const root = env.NEWTNODE_CORRIDORKEY_ROOT || path.join(baseDir, "engine");
  return { root, python: env.NEWTNODE_CORRIDORKEY_PYTHON || (root ? path.join(root, "venv", platform === "win32" ? "Scripts/python.exe" : "bin/python") : "") };
}

export function keyerArguments({ input, output, firstHint, hintVideo, settings = {}, ffmpeg }) {
  const args = ["-u", "infer.py", "--input", input, "--output_dir", output, "--outputs", "alpha", "fg", "checker", "cutout", "--despill_strength", String(settings.despill), "--ffmpeg_bin", ffmpeg];
  if (settings.mode === "first") args.push("--hint_first_frame", firstHint, "--hint_quality", String(settings.hintQuality));
  if (settings.mode === "video") args.push("--hint_video", hintVideo, "--hint_quality", String(settings.hintQuality));
  if (!settings.carry) args.push("--no_carry_hint");
  if (settings.memory === "balanced") args.push("--hann_chunk", "8", "--hann_stride", "4");
  if (settings.memory === "low") args.push("--low_vram", "--hann_chunk", "4", "--hann_stride", "2");
  if (settings.frameLimit > 0) args.push("--num_frames", String(settings.frameLimit));
  return args;
}

export function keyerStage(line) {
  if (/window \d+\/\d+/.test(line)) return `Temporal processing: ${line.trim().match(/window \d+\/\d+/)[0]}`;
  if (/RVM continuous|prepass|precomput/.test(line)) return "Analyzing source motion and image features…";
  if (/Hann stage1/.test(line)) return "Processing temporal windows…";
  if (/stage2|wrote .*output/i.test(line)) return "Writing matte, foreground and cutout…";
  return "";
}

export function runKeyerProcess(python, args, { cwd, onProgress, timeoutMs = 3600000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(python, args, { cwd, shell: false, windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: "1" } });
    let tail = "", pending = "", settled = false;
    const finish = error => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(); };
    const timer = setTimeout(() => { child.kill(); finish(new Error("CorridorKey exceeded the one-hour processing limit.")); }, timeoutMs);
    const read = chunk => {
      tail = (tail + chunk.toString()).slice(-6000);
      pending += chunk.toString();
      const lines = pending.split(/[\r\n]+/); pending = lines.pop().slice(-6000);
      for (const line of lines) { const message = keyerStage(line); if (message) onProgress?.(message); }
    };
    child.stdout.on("data", read); child.stderr.on("data", read);
    child.once("error", error => finish(new Error(`Could not start CorridorKey: ${error.message}`)));
    child.once("close", code => {
      // Only report the exception text, not local paths or the full Python trace.
      const detail = tail.split(/[\r\n]+/).filter(line => /(?:Error|Exception):/.test(line)).at(-1) || "Check the CorridorKey installation and available GPU memory.";
      finish(code === 0 ? null : new Error(`CorridorKey failed (${code}). ${detail}`));
    });
  });
}

export function createKeyerService({ resolveAsset, isLocalAssetUrl, createTarget, probeVideo, ffmpeg, recordHistory, projectFromBody, nodeFromBody, runtime = () => keyerRuntime(), run = runKeyerProcess, setup }) {
  const jobs = new Map();
  let busy = false;
  async function status() {
    if (setup) return { ...await setup.status(), busy, model: keyerModelName };
    const r = runtime();
    const required = [r.python, r.root && path.join(r.root, "infer.py"), r.root && path.join(r.root, "weights/corridorkey_v2.safetensors"), r.root && path.join(r.root, "weights/foundation_stats.safetensors"), r.root && path.join(r.root, "vfms/cradio/C-RADIOv4-SO400M/model.safetensors"), r.root && path.join(r.root, "vfms/moge/model.pt"), r.root && path.join(r.root, "vfms/rvm/pretrain_rvm_small16_256_204031069.npz")];
    const ready = required.every(Boolean) && (await Promise.all(required.map(exists))).every(Boolean);
    return { ready, busy, model: keyerModelName, message: ready ? "Local engine configured · NVIDIA CUDA required" : "Configure the CorridorKey 2.0 installation in the server environment. See docs/keyer.md." };
  }
  async function execute(job, body, assets) {
    let temporary;
    try {
      if (setup) {
        job.state = "installing";
        job.message = "Checking CorridorKey dependencies…";
        await setup.ensure(message => { job.message = message; });
      }
      temporary = await mkdtemp(path.join(os.tmpdir(), "newt-keyer-"));
      const r = runtime();
      const output = path.join(temporary, "result");
      // Stable basename prevents upstream output names from depending on a user's path.
      const input = path.join(temporary, "source" + path.extname(assets.source.filePath));
      await copyFile(assets.source.filePath, input);
      job.state = "running";
      await run(r.python, keyerArguments({ input, output, firstHint: assets.first?.filePath, hintVideo: assets.video?.filePath, settings: body.settings, ffmpeg }), { cwd: r.root, onProgress: message => { job.message = message; } });
      const files = await readdir(output);
      const passes = {};
      for (const [pass, suffix, extension] of [["cutout", "_cutout.mov", ".mov"], ["alpha", "_alpha.mp4", ".mp4"], ["fg", "_fg.mp4", ".mp4"], ["checker", "_checker_comp_despill", ".mp4"]]) {
        const name = files.find(file => pass === "checker" ? file.includes(suffix) && file.endsWith(extension) : file.endsWith(suffix));
        if (!name) throw new Error(`CorridorKey did not write the ${pass} output.`);
        const target = await createTarget(body, `keyer-${pass}`, extension, pass !== "cutout");
        await mkdir(path.dirname(target.filePath), { recursive: true });
        await copyFile(path.join(output, name), target.filePath);
        passes[pass] = { type: "video", label: `${keyerModelName} · ${pass}`, url: target.publicPath, fileName: target.fileName, mimeType: extension === ".mov" ? "video/quicktime" : "video/mp4", bytes: (await stat(target.filePath)).size };
      }
      const metadata = await probeVideo((await resolveAsset(passes.cutout.url)).filePath);
      const keyer = { model: keyerModelName, sourceVideoUrl: body.sourceVideoUrl, firstHintUrl: body.settings.mode === "first" ? body.firstHintUrl : "", hintVideoUrl: body.settings.mode === "video" ? body.hintVideoUrl : "", settings: body.settings, passes };
      const cost = { amountUsd: 0, currency: "USD", mediaType: "video", pricingBasis: "Local GPU processing; electricity and hardware costs excluded" };
      const item = { ...passes.cutout, keyer, cost };
      await recordHistory({ id: randomUUID(), createdAt: new Date().toISOString(), mediaType: "video", provider: "local", modelName: keyerModelName, endpoint: "local/corridorkey-2", mode: "Keyer", project: projectFromBody(body), node: nodeFromBody(body), settings: { keyer: body.settings }, keyer, cost, localVideo: item.url, outputFileName: item.fileName, outputBytes: item.bytes, video: metadata });
      job.item = item; job.state = "complete"; job.message = "Key complete";
    } catch (error) { job.state = "error"; job.error = error.message; job.message = "Keying failed"; }
    finally { busy = false; if (temporary) await rm(temporary, { recursive: true, force: true }).catch(() => {}); }
  }
  return {
    status,
    job: id => jobs.get(id),
    async start(body) {
      const error = keyerInputError(body);
      if (error) throw Object.assign(new Error(error), { status: 400 });
      if (busy) throw Object.assign(new Error("The local Keyer is busy. Wait for the current key to finish."), { status: 409 });
      // Reserve before awaiting validation, so simultaneous windows cannot both start.
      busy = true;
      try {
        const readiness = await status();
        if (!readiness.ready && !readiness.canInstall) throw new Error(readiness.message || "CorridorKey 2.0 is not configured. See docs/keyer.md.");
        for (const url of [body.sourceVideoUrl, body.settings.mode === "first" ? body.firstHintUrl : "", body.settings.mode === "video" ? body.hintVideoUrl : ""].filter(Boolean)) if (!isLocalAssetUrl(url)) throw new Error("Keyer inputs must be managed local assets.");
        const source = await resolveAsset(body.sourceVideoUrl);
        const metadata = await probeVideo(source.filePath);
        if (!(metadata.width > 0 && metadata.height > 0 && metadata.duration > 0)) throw new Error("Select a readable source video.");
        const first = body.settings.mode === "first" ? await resolveAsset(body.firstHintUrl) : null;
        const video = body.settings.mode === "video" ? await resolveAsset(body.hintVideoUrl) : null;
        if (video) {
          const hint = await probeVideo(video.filePath);
          if (hint.width !== metadata.width || hint.height !== metadata.height || Math.abs(hint.duration - metadata.duration) > 0.1 || Math.abs(hint.fps - metadata.fps) > 0.01) throw new Error("The full matte video must match source dimensions, frame rate and duration.");
        }
        if (first && !/\.(png|jpe?g)$/i.test(first.filePath)) throw new Error("The first-frame hint must be a PNG or JPEG matte image.");
        // Retain completed/error jobs for reconnection, with a bounded in-memory registry.
        if (jobs.size >= 50) for (const [id, job] of jobs) { if (["complete", "error"].includes(job.state)) { jobs.delete(id); break; } }
        const job = { id: randomUUID(), state: "starting", message: "Loading CorridorKey 2.0…" };
        jobs.set(job.id, job);
        void execute(job, body, { source, first, video });
        return { jobId: job.id };
      } catch (error) { busy = false; throw error; }
    }
  };
}

import { spawn } from "node:child_process";
import { watchFile, unwatchFile } from "node:fs";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restartDelay } from "./supervisorPolicy.mjs";
import { createRotatingLog } from "./rotatingLog.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = process.argv.includes("--client");
const port = Number(client ? process.env.VITE_CLIENT_PORT || 5176 : process.env.PORT || process.env.VITE_API_PORT || 3336);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid NewtNode service port.");
const service = client ? "client" : "server";
const logDir = path.join(rootDir, ".newtnode_logs");
const lockPath = path.join(logDir, `${service}-${port}.lock`);
const markerPath = path.join(rootDir, "server", "restart-marker.js");
await mkdir(logDir, { recursive: true });

async function acquireLock() {
  try {
    const handle = await open(lockPath, "wx");
    try { await handle.writeFile(JSON.stringify({ pid: process.pid, service, port })); } finally { await handle.close(); }
    return true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    let owner;
    try { owner = JSON.parse(await readFile(lockPath, "utf8")); } catch { return false; }
    try { process.kill(owner.pid, 0); return false; }
    catch (error) { if (error.code !== "ESRCH") return false; }
    await rm(lockPath, { force: true });
    return acquireLock();
  }
}
if (!await acquireLock()) {
  console.log(`NewtNode ${service} supervisor already owns port ${port}.`);
  process.exit(0);
}

const output = createRotatingLog(path.join(logDir, `${service}-${port}.log`));
output.on("error", (error) => { console.error(`NewtNode log unavailable: ${error.code || "write failed"}`); shutdown(); });
const log = (message) => output.write(`[${service}-supervisor] ${new Date().toISOString()} ${message}\n`);
let child = null;
let timer = null;
let killTimer = null;
let failures = 0;
let restarts = 0;
let requested = false;
let stopping = false;

function start() {
  if (stopping) return;
  const startedAt = Date.now();
  const args = client
    ? [path.join(rootDir, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"]
    : [path.join(rootDir, "server", "index.js")];
  const current = spawn(process.execPath, args, { cwd: rootDir, env: { ...process.env, NEWTNODE_SUPERVISED: "1", NEWTNODE_SUPERVISOR_RESTARTS: String(restarts++), ...(client ? {} : { PORT: String(port) }) }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  child = current;
  current.stdout.pipe(output, { end: false });
  current.stderr.pipe(output, { end: false });
  log(`started pid=${current.pid || "unavailable"} port=${port}`);
  current.on("error", (error) => log(`spawn failed code=${error.code || "unknown"}`));
  current.on("close", (code, signal) => {
    child = null;
    clearTimeout(killTimer);
    log(`exited code=${code ?? ""} signal=${signal || ""}`);
    if (stopping) { finish(); return; }
    const policy = restartDelay({ failures, uptimeMs: Date.now() - startedAt, requested });
    failures = policy.failures;
    requested = false;
    log(`restart in ${policy.delayMs}ms consecutiveFailures=${failures}`);
    timer = setTimeout(start, policy.delayMs);
  });
}

function terminateChild() {
  const current = child;
  if (!current) return;
  current.kill("SIGTERM");
  clearTimeout(killTimer);
  killTimer = setTimeout(() => { if (child === current) current.kill("SIGKILL"); }, 5000);
}
function restart() {
  if (stopping) return;
  requested = true;
  clearTimeout(timer);
  if (child) terminateChild();
  else { failures = 0; requested = false; start(); }
}
async function finish() {
  await rm(lockPath, { force: true }).catch(() => {});
  output.end(() => process.exit(0));
  setTimeout(() => process.exit(1), 2000).unref();
}
function shutdown() {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  unwatchFile(markerPath);
  if (child) terminateChild(); else finish();
}

watchFile(markerPath, { interval: 500 }, (current, previous) => {
  if (current.mtimeMs !== previous.mtimeMs) { log("requested restart"); restart(); }
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
start();

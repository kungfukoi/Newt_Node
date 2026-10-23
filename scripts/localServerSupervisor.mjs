import { spawn } from "node:child_process";
import { watchFile, unwatchFile } from "node:fs";
import { mkdir, open, readFile, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restartDelay } from "./supervisorPolicy.mjs";
import { createRotatingLog } from "./rotatingLog.mjs";
import { stopOwnedProcessTree, stopOwnedWslServices } from "./ownedProcessTree.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const client = process.argv.includes("--client");
const port = Number(client ? process.env.VITE_CLIENT_PORT || 5176 : process.env.PORT || process.env.VITE_API_PORT || 3336);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid NewtNode service port.");
const service = client ? "client" : "server";
const logDir = path.join(rootDir, ".newtnode_logs");
const lockPath = path.join(logDir, `${service}-${port}.lock`);
const stopPath = path.join(logDir, `${service}-${port}.stop`);
const ownerToken = randomUUID();
const markerPath = path.join(rootDir, "server", "restart-marker.js");
await mkdir(logDir, { recursive: true });

async function acquireLock() {
  try {
    const handle = await open(lockPath, "wx");
    try { await handle.writeFile(JSON.stringify({ pid: process.pid, service, port, ownerToken })); } finally { await handle.close(); }
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
let failures = 0;
let restarts = 0;
let requested = false;
let stopping = false;
const ownedWslServices = new Map();

function start() {
  if (stopping) return;
  const startedAt = Date.now();
  const args = client
    ? [path.join(rootDir, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"]
    : [path.join(rootDir, "server", "index.js")];
  const current = spawn(process.execPath, args, { cwd: rootDir, env: { ...process.env, NEWTNODE_SUPERVISED: "1", NEWTNODE_SUPERVISOR_RESTARTS: String(restarts++), ...(client ? {} : { PORT: String(port) }) }, windowsHide: true, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe", "ipc"] });
  child = current;
  current.on("message", (message) => {
    if (client) return;
    if (message?.type === "windows-closed") { void shutdown(); return; }
    if (message?.type === "owned-wsl-service" && [message.distro, message.user, message.service].every(value => typeof value === "string" && /^[a-zA-Z0-9_.@-]+$/.test(value) && !value.startsWith("-"))) {
      ownedWslServices.set(`${message.distro}:${message.user}:${message.service}`, message);
    }
  });
  current.stdout.pipe(output, { end: false });
  current.stderr.pipe(output, { end: false });
  log(`started pid=${current.pid || "unavailable"} port=${port}`);
  current.on("error", (error) => log(`spawn failed code=${error.code || "unknown"}`));
  current.on("close", (code, signal) => {
    child = null;
    log(`exited code=${code ?? ""} signal=${signal || ""}`);
    if (stopping) return;
    if (!client && code === 73) {
      log("another backend owns this checkout's data; stopping duplicate supervisor");
      stopping = true; unwatchFile(markerPath); finish(); return;
    }
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
  void stopOwnedProcessTree(current).catch(error => {
    log(`process-tree restart failed: ${error.message}`);
    current.kill("SIGKILL");
  });
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
async function requestClientShutdown() {
  const clientPort = Number(process.env.VITE_CLIENT_PORT || 5176);
  if (!Number.isInteger(clientPort) || clientPort < 1 || clientPort > 65535) return;
  try {
    const owner = JSON.parse(await readFile(path.join(logDir, `client-${clientPort}.lock`), "utf8"));
    if (owner.ownerToken) await writeFile(path.join(logDir, `client-${clientPort}.stop`), owner.ownerToken);
  } catch (error) { if (error.code !== "ENOENT") log(`client shutdown request failed: ${error.message}`); }
}

async function prepareShutdown(current) {
  if (!current?.connected) return;
  await new Promise(resolve => {
    const ready = message => { if (message?.type === "shutdown-ready") done(); };
    const timeout = setTimeout(done, 1000);
    function done() { clearTimeout(timeout); current.off("message", ready); resolve(); }
    current.on("message", ready);
    current.send({ type: "shutdown-session" }, error => { if (error) done(); });
  });
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  clearTimeout(timer);
  unwatchFile(markerPath);
  unwatchFile(stopPath);
  log("shutting down owned services");
  const current = child;
  if (!client) {
    await requestClientShutdown();
    await prepareShutdown(current);
  }
  try { await stopOwnedProcessTree(current); }
  catch (error) { log(`process-tree shutdown failed: ${error.message}`); current?.kill("SIGKILL"); }
  // The backend can no longer start another inference unit while we stop the
  // services it registered (including those retained across backend restarts).
  if (!client) await stopOwnedWslServices(ownedWslServices);
  await finish();
}

watchFile(markerPath, { interval: 500 }, (current, previous) => {
  if (current.mtimeMs !== previous.mtimeMs) { log("requested restart"); restart(); }
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
watchFile(stopPath, { interval: 250 }, async () => {
  try { if ((await readFile(stopPath, "utf8")) === ownerToken) await shutdown(); } catch { /* No request for this owner. */ }
});
start();

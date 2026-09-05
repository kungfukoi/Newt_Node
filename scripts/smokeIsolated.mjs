import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import setupMedia from "../e2e/setup.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const sandbox = await mkdtemp(path.join(os.tmpdir(), "newt-isolated-smoke-"));
let child;
let exited;
let output = "";
try {
  for (const folder of ["server", "src", "scripts"]) {
    await cp(path.join(root, folder), path.join(sandbox, folder), {
      recursive: true,
      filter: (source) => !["data", "__pycache__"].includes(path.basename(source)) && !source.endsWith(".log")
    });
  }
  await cp(path.join(root, "package.json"), path.join(sandbox, "package.json"));
  await symlink(path.join(root, "node_modules"), path.join(sandbox, "node_modules"), process.platform === "win32" ? "junction" : "dir");
  await mkdir(path.join(sandbox, "server", "data"), { recursive: true });
  await mkdir(path.join(sandbox, "outputs"), { recursive: true });
  await writeFile(path.join(sandbox, ".env"), "");
  await setupMedia();
  await cp(path.join(root, "e2e", ".generated", "motion.mp4"), path.join(sandbox, "outputs", "clip.mp4"));
  await writeFile(path.join(sandbox, "server", "data", "history.json"), JSON.stringify([
    { id: "smoke-generation", project: { id: "smoke-project", name: "Smoke" }, mediaType: "video", localVideo: "/outputs/clip.mp4", createdAt: new Date().toISOString() }
  ]));
  await writeFile(path.join(sandbox, "server", "data", "remote-video-jobs.json"), JSON.stringify({ version: 1, jobs: [{
    runId: "manual-recovery", state: "uncertain", submissionStartedAt: new Date().toISOString(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    spec: { provider: "krea", modelName: "Seedance 2.5", routeKind: "text-to-video", endpoint: "/fixture", settings: { generateAudio: true }, body: { projectId: "recovered-project", nodeId: "recovered-node" } }
  }] }));
  const port = await freePort();
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|HOME|USERPROFILE|COMSPEC)$/i.test(key)));
  Object.assign(env, { PORT: String(port), NEWTNODE_CONTROL_PORT: String(port), NODE_ENV: "production", DOTENV_CONFIG_PATH: path.join(sandbox, ".env") });
  child = spawn(process.execPath, [path.join(sandbox, "server", "index.js")], { cwd: sandbox, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  exited = once(child, "exit");
  child.stdout.on("data", (data) => { output = (output + data).slice(-16000); });
  child.stderr.on("data", (data) => { output = (output + data).slice(-16000); });
  const api = `http://127.0.0.1:${port}`;
  const request = async (url, body) => {
    const response = await fetch(api + url, { signal: AbortSignal.timeout(15000), ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    assert.equal(response.ok, true, `${url}: HTTP ${response.status} ${await response.clone().text()}`);
    return response;
  };
  let healthy = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Isolated API exited: ${output}`);
    try { healthy = (await (await request("/api/health")).json()).ok; } catch { /* Wait for this owned API to bind. */ }
    if (healthy) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(healthy, `Isolated API did not become ready: ${output}`);
  const historyFile = path.join(sandbox, "server", "data", "history.json");
  await cp(historyFile, `${historyFile}.bak`);
  await rm(historyFile);
  await request("/api/history?summary=1");
  assert.equal(JSON.parse(await readFile(historyFile, "utf8"))[0].id, "smoke-generation");
  assert.match((await (await request("/api/settings")).json()).historyRecoveryNotice, /restored/);
  const catalog = await (await request("/api/project-outputs?projectId=smoke-project")).json();
  assert.equal(catalog.total, 1);
  const poster = await request("/api/video-poster?url=" + encodeURIComponent("/outputs/clip.mp4"));
  assert.match(poster.headers.get("content-type"), /image\/jpeg/);
  assert.ok((await poster.arrayBuffer()).byteLength > 1000);
  const diagnostics = await (await request("/api/system/performance-diagnostics", { enabled: true })).json();
  assert.equal(diagnostics.enabled, true);
  const saved = await (await request("/api/saved-workflows", {
    id: "smoke-project", name: "Smoke", nodes: [], edges: [], packageParentPath: path.join(sandbox, "packages")
  })).json();
  assert.equal(saved.projectOutputs.length, 1);
  assert.match(saved.projectOutputs[0].url, /^\/workflow-assets\/[^/]+\/outputs\//);
  const clone = await (await request("/api/saved-workflows", {
    id: "smoke-copy", sourceWorkflowId: saved.id, name: "Smoke Copy", nodes: [], edges: [], packageParentPath: path.join(sandbox, "copies")
  })).json();
  assert.notEqual(clone.id, saved.id);
  assert.equal(clone.projectOutputs.length, 1);
  const reopened = await (await request(`/api/saved-workflows/${encodeURIComponent(clone.fileName)}`)).json();
  assert.equal(reopened.projectOutputs[0].url, clone.projectOutputs[0].url);
  const cloneCatalog = await (await request(`/api/project-outputs?projectId=${encodeURIComponent(clone.id)}`)).json();
  assert.equal(cloneCatalog.total, 1);
  await request("/api/system/performance-diagnostics", { enabled: false });
  assert.equal(JSON.parse(await readFile(path.join(sandbox, "server", "data", "history.json"), "utf8")).length, 1);
  await request("/api/remote-video-jobs/manual-recovery/recover", { action: "import", acknowledged: true, scope: JSON.stringify(["recovered-project", "", ""]), assetUrl: "/outputs/clip.mp4" });
  let recovered;
  for (let attempt = 0; attempt < 50; attempt++) {
    recovered = (await (await request("/api/remote-video-jobs/manual-recovery")).json()).job;
    if (recovered.state === "completed") break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(recovered.state, "completed", recovered.message);
  assert.equal((await (await request("/api/project-outputs?projectId=recovered-project")).json()).total, 1);
  console.log("Isolated API passed: startup, history backup recovery, project catalog, video poster, diagnostics, Save As, reopen, clone catalog, uncertain-result import; no provider calls.");
} finally {
  if (child && child.exitCode === null) child.kill("SIGTERM");
  if (exited) await exited;
  // The junction is removed separately; recursive cleanup can only reach this test-owned temp root.
  const relative = path.relative(os.tmpdir(), sandbox);
  if (!relative.startsWith("newt-isolated-smoke-") || relative.includes(path.sep)) throw new Error("Refusing cleanup outside isolated smoke directory.");
  await rm(path.join(sandbox, "node_modules"), { recursive: true, force: true });
  await rm(sandbox, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

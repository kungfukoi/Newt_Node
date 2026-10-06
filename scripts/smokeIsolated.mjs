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
  await writeFile(path.join(sandbox, ".env"), "# ATLAS_API_KEY=atlas-smoke-key\n");
  await setupMedia();
  await cp(path.join(root, "e2e", ".generated", "landscape.png"), path.join(sandbox, "outputs", "panel.png"));
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
  assert.equal((await (await request("/api/health")).json()).routes.ideogram45, true);
  assert.equal((await (await request("/api/health")).json()).routes.explore, true);
  const builtIns = await (await request("/api/newt-presets")).json();
  assert.equal(builtIns.filter(item => item.isSystem).length, 6);
  for (const item of builtIns) assert.ok((await (await request("/api/newt-presets/" + item.id)).json()).graph.nodes.length);
  const priceStatus = await (await request("/api/pricing")).json();
  assert.equal(priceStatus.enabled, false);
  assert.equal(priceStatus.running, false);
  assert.equal(priceStatus.catalog.version, 1);
  const pricingWrite = await fetch(api + "/api/pricing/settings", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:true})});
  assert.equal(pricingWrite.status, 403);
  const invalidExplore = await fetch(api + "/api/node/explore-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: 0, references: [], parents: [] }) });
  assert.equal(invalidExplore.status, 400);
  assert.equal((await (await request("/api/health")).json()).routes.storyboardRevisions, true);
  const invalidReview = await fetch(api + "/api/node/storyboard-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
  assert(invalidReview.status === 400, "Sequence review must reject missing panels before paid work.");
  const invalidRevision = await fetch(api + "/api/node/storyboard-revise", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
  assert.equal(invalidRevision.status, 400);
  if (process.env.NEWT_SMOKE_CLIENT_URL) {
    const smoke = spawn(process.execPath, [path.join(root, "scripts", "smokeApp.mjs"), process.env.NEWT_SMOKE_CLIENT_URL, `${api}/api/health`], { cwd: root, windowsHide: true, stdio: "inherit" });
    assert.equal((await once(smoke, "exit"))[0], 0, "Client/API smoke failed");
  }
  const exportedBoard = await (await request("/api/node/storyboard-export-board", { sceneName: "Smoke Board", frames: [{number:3,sourceUrl:"/outputs/panel.png",description:"Saved caption"}], includePdf:true, includeFrames:true, generateDescriptions:false })).json();
  assert.equal(exportedBoard.export.frames[0].number, 3);
  assert.equal(exportedBoard.export.frames[0].description, "Saved caption.");
  const pdfBytes = await readFile(exportedBoard.export.pdf.localPath);
  assert.equal(pdfBytes.subarray(0,5).toString(), "%PDF-");
  assert.equal((await request(exportedBoard.export.frames[0].localUrl)).status, 200);
  const historyFile = path.join(sandbox, "server", "data", "history.json");
  await cp(historyFile, `${historyFile}.bak`);
  await rm(historyFile);
  await request("/api/history?summary=1");
  assert.equal(JSON.parse(await readFile(historyFile, "utf8"))[0].id, "smoke-generation");
  const initialSettings = await (await request("/api/settings")).json();
  assert.match(initialSettings.historyRecoveryNotice, /restored/);
  assert.equal(initialSettings.userPreferences.showPresetPanel, true);
  assert.equal(initialSettings.repository, "https://github.com/kungfukoi/Newt_Node.git");
  assert.equal(initialSettings.branch, "main");
  assert.equal(initialSettings.branchStatus.state, "archive-install");
  assert.equal(initialSettings.branchStatus.label, "ZIP install");
  const expectedRouting = {
    seedance: "krea",
    veo: "fal",
    imageGeneration: "atlas",
    minimaxH3: "local",
    llm: "openai"
  };
  const savedSettings = await (await request("/api/settings", {
    userPreferences: { showPresetPanel: false, imageEditorModel: "Ideogram 4.5" },
    modelProviderPreferences: expectedRouting
  })).json();
  assert.equal(savedSettings.userPreferences.showPresetPanel, false);
  assert.deepEqual(savedSettings.modelProviderPreferences, expectedRouting);
  assert.equal(savedSettings.atlasApiKeyConfigured, true);
  assert.ok(savedSettings.activeCredentialIds.atlas);
  const reloadedSettings = await (await request("/api/settings")).json();
  assert.equal(reloadedSettings.userPreferences.showPresetPanel, false);
  assert.equal(reloadedSettings.userPreferences.imageEditorModel, "Ideogram 4.5");
  assert.deepEqual(reloadedSettings.modelProviderPreferences, expectedRouting);
  assert.equal(reloadedSettings.atlasApiKeyConfigured, true);
  assert.equal(reloadedSettings.activeCredentialIds.atlas, savedSettings.activeCredentialIds.atlas);
  await request("/api/settings", { modelProviderPreferences: { ...expectedRouting, imageGeneration: "krea", veo: "krea" } });
  const kreaSettings = await (await request("/api/settings")).json();
  assert.equal(kreaSettings.modelProviderPreferences.imageGeneration, "krea");
  assert.equal(kreaSettings.modelProviderPreferences.veo, "krea");
  for (const [route, model, message] of [
    ["generate-image", "Ideogram 4.5", /not supported/],
    ["generate-image", "Nano Banana 2", /Krea API key/],
    ["generate-video", "Wan 2.7 Reference-to-Video", /not supported/],
    ["generate-video", "Kling O3 Pro", /Krea API key/],
    ["generate-video", "Gemini Omni Flash", /Krea API key/]
  ]) {
    const rejected = await fetch(`${api}/api/node/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt: "Routing validation only" }) });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, message);
  }
  await request("/api/settings", { modelProviderPreferences: expectedRouting });
  assert.deepEqual(
    JSON.parse(await readFile(path.join(sandbox, "server", "data", "runtime-settings.json"), "utf8")).modelProviderPreferences,
    expectedRouting
  );
  const catalog = await (await request("/api/project-outputs?projectId=smoke-project")).json();
  assert.equal(catalog.total, 1);
  const poster = await request("/api/video-poster?url=" + encodeURIComponent("/outputs/clip.mp4"));
  assert.match(poster.headers.get("content-type"), /image\/jpeg/);
  assert.ok((await poster.arrayBuffer()).byteLength > 1000);
  const diagnostics = await (await request("/api/system/performance-diagnostics", { enabled: true })).json();
  assert.equal(diagnostics.enabled, true);
  const saved = await (await request("/api/saved-workflows", {
    id: "smoke-project", name: "Smoke", nodes: [{ id: "board", type: "storyboard", data: { storyboardFrames: [{ id: "panel", number: 1, protected: true, resultUrl: "/outputs/panel.png", versions: [{ resultUrl: "/outputs/panel.png", prompt: "Original direction", savedAt: 1 }] }] } }], edges: [], packageParentPath: path.join(sandbox, "packages")
  })).json();
  assert.equal(saved.projectOutputs.length, 1);
  const savedPanel = saved.graph.nodes[0].data.storyboardFrames[0];
  assert.equal(savedPanel.protected, true);
  assert.match(savedPanel.versions[0].resultUrl, /^\/workflow-assets\//);
  assert.equal((await request(savedPanel.versions[0].resultUrl)).status, 200);
  assert.match(saved.projectOutputs[0].url, /^\/workflow-assets\/[^/]+\/outputs\//);
  const clone = await (await request("/api/saved-workflows", {
    id: "smoke-copy", sourceWorkflowId: saved.id, name: "Smoke Copy", nodes: saved.graph.nodes, edges: [], packageParentPath: path.join(sandbox, "copies")
  })).json();
  assert.notEqual(clone.id, saved.id);
  assert.equal(clone.projectOutputs.length, 1);
  const reopened = await (await request(`/api/saved-workflows/${encodeURIComponent(clone.fileName)}`)).json();
  assert.equal(reopened.projectOutputs[0].url, clone.projectOutputs[0].url);
  const restoredPanel = reopened.graph.nodes[0].data.storyboardFrames[0];
  assert.equal(restoredPanel.protected, true);
  assert.equal(restoredPanel.versions[0].prompt, "Original direction");
  assert.ok(restoredPanel.versions[0].resultUrl.includes(clone.id));
  assert.equal((await request(restoredPanel.versions[0].resultUrl)).status, 200);
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
  const directorProps = ["Can", "Frap", "Sign", "Book", "Koozie", "HatCopy", "Goblet", ...Array.from({ length: 10 }, (_, index) => `Extra${index + 1}`)];
  const director = await (await request("/api/node/run-skill-director", {
    action: "build",
    durationSeconds: "still",
    sceneOverview: "A still scene with @Witch holding @Goblet.",
    characterInputs: [{ tag: "@Witch", label: "Witch", url: "/outputs/witch.png" }],
    locationInputs: [{ tag: "@NoiseRedux1", label: "NoiseRedux1", url: "/outputs/location.png" }],
    elementInputs: directorProps.map((name) => ({ tag: `@${name}`, label: name, url: `/outputs/${name}.png` }))
  })).json();
  for (const tag of ["Witch", "NoiseRedux1", ...directorProps]) {
    assert.match(director.referenceSetup, new RegExp(`^@${tag} = `, "m"));
    assert.match(director.text, new RegExp(`^@${tag} = `, "m"));
  }
  assert.equal(director.referenceTags.length, 19);
  assert.equal(director.referenceTags.at(-1), "@Extra10");
  const elevenSaved = await (await request("/api/settings", { credentials: { elevenLabs: [{ id: "eleven-smoke", label: "Smoke", key: "eleven-fixture-key" }] }, activeCredentialIds: { elevenLabs: "eleven-smoke" } })).json();
  assert.equal(elevenSaved.elevenLabsApiKeyConfigured, true);
  assert.equal(elevenSaved.activeCredentialIds.elevenLabs, "eleven-smoke");
  assert.equal(JSON.stringify(elevenSaved).includes("eleven-fixture-key"), false);
  const elevenReloaded = await (await request("/api/settings")).json();
  assert.equal(elevenReloaded.elevenLabsApiKeyConfigured, true);
  assert.match(await readFile(path.join(sandbox, ".env"), "utf8"), /^ELEVENLABS_API_KEY=eleven-fixture-key$/m);
  const elevenDisabled = await (await request("/api/settings", { activeCredentialIds: { elevenLabs: "" } })).json();
  assert.equal(elevenDisabled.elevenLabsApiKeyConfigured, false);
  assert.equal(elevenDisabled.credentialProfiles.elevenLabs.length, 1);
  console.log("Isolated API passed: startup, history backup recovery, settings and routing persistence, project catalog, video poster, diagnostics, Save As, reopen, clone catalog, uncertain-result import, Director reference completeness; no provider calls.");
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

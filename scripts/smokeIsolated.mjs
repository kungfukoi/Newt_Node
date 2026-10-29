import ffmpeg from "ffmpeg-static";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { once } from "node:events";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import setupMedia from "../e2e/setup.mjs";
import ffprobe from "@ffprobe-installer/ffprobe";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const sandbox = await mkdtemp(path.join(os.tmpdir(), "newt-isolated-smoke-"));
let clientChild, clientExited;
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
  // Exercise the bundled probe before the API can turn a launch error into
  // an empty metadata result and a misleading "unreadable video" response.
  const { stdout: probeOutput } = await promisify(execFile)(ffprobe.path, [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height:format=duration", "-of", "json",
    path.join(root, "e2e", ".generated", "motion.mp4")
  ], { windowsHide: true, timeout: 15000 });
  const probe = JSON.parse(probeOutput);
  assert.equal(probe.streams?.[0]?.width, 640, "Bundled FFprobe must read the fixture width");
  assert.equal(probe.streams?.[0]?.height, 360, "Bundled FFprobe must read the fixture height");
  assert.ok(Number(probe.format?.duration) > 0, "Bundled FFprobe must read the fixture duration");
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
  const localRenderTimeout = { timeoutMs: 120000 };
  const request = async (url, body, { timeoutMs = 15000 } = {}) => {
    const started = Date.now();
    try {
      const response = await fetch(api + url, { signal: AbortSignal.timeout(timeoutMs), ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
      assert.equal(response.ok, true, `${url}: HTTP ${response.status} ${await response.clone().text()}`);
      return response;
    } catch (error) {
      throw new Error(`Isolated smoke request ${url} failed after ${Date.now() - started} ms (timeout ${timeoutMs} ms): ${error.message}\nIsolated backend output:\n${output}`, { cause: error });
    }
  };
  let healthy = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Isolated API exited: ${output}`);
    try { healthy = (await (await request("/api/health")).json()).ok; } catch { /* Wait for this owned API to bind. */ }
    if (healthy) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(healthy, `Isolated API did not become ready: ${output}`);
  const health = await (await request("/api/health")).json();
  assert.equal(health.routes.windowLifecycle, true);
  assert.equal((await request("/api/window-session")).status, 204, "Unsupervised API stays available without a browser");
  assert.equal(health.routes.videoOutpaintPrompt, true);
  assert.equal(health.routes.kreaModelProviders, true);
  assert.equal(health.routes.keyer, true);
  assert.equal(health.routes.keyerUtility, true);
  assert.equal(health.routes.keyerAutoSetup, true);
  assert.equal(health.routes.workspaceRecovery, true);
  assert.equal(health.routes.keyerInstallCancel, true);
  const recovery = await fetch(api + "/api/ui-state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "smoke-window", revision: 1, state: { workspaceMode: "nodes", draft: { nodes: [], edges: [], projectName: "Recovery smoke" } } }) });
  assert.equal(recovery.status, 200);
  assert.equal((await (await request("/api/ui-state?sessionId=smoke-window")).json()).state.draft.projectName, "Recovery smoke");
  assert.equal((await (await request("/api/keyer/cancel", { jobId: "nonexistent-smoke" })).json()).cancelled, false);
  for (const model of ["Extract Frame", "Wan VACE Mask-to-Video", "Wan VACE 14B Inpainting"]) {
    const retired = await fetch(api + "/api/node/utility-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model }), signal: AbortSignal.timeout(15000) });
    assert.equal(retired.status, 400);
    assert.match((await retired.json()).error, /disabled/);
  }
  const keyerStatus = await (await request("/api/keyer/status")).json();
  assert.equal(typeof keyerStatus.ready, "boolean");
  assert.equal(typeof keyerStatus.canInstall, "boolean");
  const invalidKeyer = await fetch(api + "/api/node/keyer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: {} }), signal: AbortSignal.timeout(15000) });
  assert.equal(invalidKeyer.status, 400);
  const invalidOutpaint = await fetch(api + "/api/node/video-outpaint-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "guided" }), signal: AbortSignal.timeout(15000) });
  assert.equal(invalidOutpaint.status, 400);
  for (const flag of ["kling4ImageToVideo", "timelineExtractFrame", "flux3Max", "seedanceDrafts", "seedanceMultiProviderDrafts", "seedanceVideoEditing", "elevenLabsV4", "exploreLookVariation"]) assert.equal(health.routes[flag], true);
  const missingReceipt = await fetch(api + "/api/node/seedance-draft/complete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receiptId: "12345678-1234-1234-1234-123456789012" }) });
  assert.equal(missingReceipt.status, 404);
  const clientPort = await freePort();
  clientChild = spawn(process.execPath, [path.join(root, "node_modules", "vite", "bin", "vite.js"), "preview", "--host", "127.0.0.1", "--port", String(clientPort), "--strictPort"], { cwd: root, windowsHide: true, stdio: "ignore" });
  clientExited = once(clientChild, "exit");
  const clientUrl = "http://127.0.0.1:" + clientPort + "/";
  let clientReady = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { clientReady = (await fetch(clientUrl)).ok; } catch {}
    if (clientReady) break;
    if (clientChild.exitCode !== null) throw new Error("Owned preview server exited before smoke check.");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert(clientReady, "Owned preview server did not become ready.");
  const { stdout: shellSmoke } = await promisify(execFile)(process.execPath, [path.join(root, "scripts", "smokeApp.mjs"), clientUrl, api + "/api/health"], { windowsHide: true, timeout: 30000 });
  console.log(shellSmoke.trim());
  const duplicatePort = await freePort();
  const duplicate = spawn(process.execPath, [path.join(sandbox, "server", "index.js")], { cwd: sandbox,
    env: { ...env, PORT: String(duplicatePort), NEWTNODE_CONTROL_PORT: String(duplicatePort) }, windowsHide: true, stdio: "ignore" });
  const duplicateClosed = once(duplicate, "close");
  let duplicateTimeout;
  try {
    const [code] = await Promise.race([duplicateClosed, new Promise((_, reject) => { duplicateTimeout = setTimeout(() => reject(new Error("Duplicate backend did not reject shared data ownership")), 10000); })]);
    assert.equal(code, 73, "A second backend must reject the shared datastore before opening jobs/history, even on different HTTP ports.");
    assert.equal((await (await request("/api/health")).json()).ok, true);
  } finally {
    clearTimeout(duplicateTimeout);
    if (duplicate.exitCode === null) duplicate.kill("SIGKILL");
    await duplicateClosed;
  }
  assert.equal((await (await request("/api/health")).json()).routes.ideogram45, true);
  assert.equal((await (await request("/api/health")).json()).routes.nanoBanana21, true);
  assert.equal((await (await request("/api/health")).json()).routes.explore, true);
  assert.equal((await (await request("/api/health")).json()).routes.spendAnalytics, true);
  assert.equal((await (await request("/api/health")).json()).routes.objectSelectionCache, true);
  const restoredObjects = await (await request("/api/node/image-object-cache", { sourceUrl: "/outputs/panel.png" })).json();
  assert.deepEqual(restoredObjects.entries, []);
  const accounting = await (await request("/api/stats/local")).json();
  assert.equal(accounting.history.length, 1);
  assert.equal(accounting.history[0].cost.amountUsd, null);
  assert.ok(accounting.coverage.trackingStartedAt);
  const accountingExport = await (await request("/api/stats/export")).json();
  const ledgerBefore = await readFile(path.join(sandbox, "server", "data", "stats-ledger.json"), "utf8");
  const accountingPreview = await (await request("/api/stats/import-preview", accountingExport)).json();
  assert.equal(accountingPreview.duplicates, 1);
  assert.equal(accountingPreview.persisted, false);
  assert.equal(await readFile(path.join(sandbox, "server", "data", "stats-ledger.json"), "utf8"), ledgerBefore);
  const noBilling = await (await request("/api/stats/accounts?start=2026-10-01&end=2026-10-09")).json();
  assert.equal(noBilling.providers.length, 6);
  assert.ok(noBilling.providers.every(provider => provider.spend.amount === null));
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
  assert.equal((await (await request("/api/health")).json()).routes.storyboardPlanningV2, true);
  assert.equal((await (await request("/api/health")).json()).routes.directorCharacterDialogue, true);
  assert.equal((await (await request("/api/health")).json()).routes.prepareCharacterDialogue, true);
  const emptySpeech = await fetch(api + "/api/node/prepare-character-dialogue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "Seedance 2.5" }) });
  assert.equal(emptySpeech.status, 400);
  assert.match((await emptySpeech.json()).error, /Add exact dialogue lines/);
  const invalidDialogue = await fetch(api + "/api/node/generate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "Kling O3 Pro", prompt: "Two people talk", generationRunId: "smoke-dialogue-unsupported", filmDirector: { dialogue: { lines: [{ id: "one", characterNodeId: "actor", text: "Hi" }] } } }) });
  assert.equal(invalidDialogue.status, 400);
  assert.match((await invalidDialogue.json()).error, /does not accept assigned Character dialogue audio/);
  for (const route of ["plan-v2", "revise-v2", "review-v2"]) {
    const invalid = await fetch(api + `/api/node/storyboard-${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /scene description/i);
  }
  assert.equal((await (await request("/api/health")).json()).routes.imageObjectSelection, true);
  assert.equal((await (await request("/api/health")).json()).routes.imageSelectionExport, true);
  assert.equal((await (await request("/api/health")).json()).routes.imageBoxIdentification, true);
  const invalidBoxName = await fetch(api + "/api/node/identify-image-box", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
  assert.equal(invalidBoxName.status, 400);
  const emptyImageSelection = await fetch(api + "/api/node/save-image-selection", { method: "POST", body: new FormData() });
  assert.equal(emptyImageSelection.status, 400);
  const noKeySelection = await fetch(api + "/api/node/image-objects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceUrl: "/outputs/panel.png", requestId: "smoke-object-selection" }) });
  assert.equal(noKeySelection.status, 400);
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
  assert.equal(initialSettings.userPreferences.textAgentModel, "sol");
  assert.equal(initialSettings.repository, "https://github.com/kungfukoi/Newt_Node.git");
  assert.equal(initialSettings.branch, "main");
  assert.equal(initialSettings.branchStatus.state, "archive-install");
  assert.equal(initialSettings.branchStatus.label, "ZIP install");
  const expectedRouting = {
    seedance: "krea",
    veo: "fal",
    imageGeneration: "atlas",
    minimaxH3: "fal",
    model3d: "fal",
    utilityImage: "fal",
    utilityVideo: "fal",
    llm: "openai"
  };
  const savedSettings = await (await request("/api/settings", {
    userPreferences: { showPresetPanel: false, imageEditorModel: "Ideogram 4.5", textAgentModel: "astra" },
    modelProviderPreferences: expectedRouting
  })).json();
  assert.equal(savedSettings.userPreferences.showPresetPanel, false);
  assert.deepEqual(savedSettings.modelProviderPreferences, expectedRouting);
  assert.equal(savedSettings.atlasApiKeyConfigured, true);
  assert.ok(savedSettings.activeCredentialIds.atlas);
  const reloadedSettings = await (await request("/api/settings")).json();
  assert.equal(reloadedSettings.userPreferences.showPresetPanel, false);
  assert.equal(reloadedSettings.userPreferences.imageEditorModel, "Ideogram 4.5");
  assert.equal(reloadedSettings.userPreferences.textAgentModel, "astra");
  assert.deepEqual(reloadedSettings.modelProviderPreferences, expectedRouting);
  assert.equal(reloadedSettings.atlasApiKeyConfigured, true);
  assert.equal(reloadedSettings.activeCredentialIds.atlas, savedSettings.activeCredentialIds.atlas);
  await request("/api/settings", { modelProviderPreferences: { ...expectedRouting, imageGeneration: "krea", veo: "krea", llm: "krea", model3d: "krea", utilityImage: "krea", utilityVideo: "krea" } });
  const kreaSettings = await (await request("/api/settings")).json();
  assert.equal(kreaSettings.modelProviderPreferences.imageGeneration, "krea");
  assert.equal(kreaSettings.modelProviderPreferences.veo, "krea");
  assert.equal(kreaSettings.modelProviderPreferences.minimaxH3, "krea");
  assert.equal(kreaSettings.modelProviderPreferences.llm, "krea");
  for (const [route, model, message] of [
    ["generate-image", "Ideogram 4.5", /Krea API key/],
    ["generate-image", "Flux 3", /not supported/],
    ["generate-image", "Nano Banana 2.1", /Krea API key/],
    ["generate-image", "Nano Banana 2", /Krea API key/],
    ["generate-video", "Wan 2.7 Reference-to-Video", /not supported/],
    ["generate-video", "Kling O3 Pro", /Krea API key/],
    ["generate-video", "MiniMax H3", /Krea API key/],
    ["generate-video", "FLUX 3 Max", /Krea API key/],
    ["generate-3d", "Rodin 2.5", /Krea API key/],
    ["utility-image", "Topaz Image Upscale", /Krea API key/],
    ["utility-image", "Image to Color ID", /Krea API key/],
    ["utility-video", "Flux Video Upscale", /Krea API key/],
    ["generate-video", "Gemini Omni Flash", /Krea API key/]
  ]) {
    const rejected = await fetch(`${api}/api/node/${route}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, prompt: "Routing validation only" }) });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, message);
  }
  for (const mode of ["process", "agent"]) {
    const rejected = await fetch(`${api}/api/node/process-text`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode, text: "Routing validation only" }) });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, /Krea API key/);
  }
  for (const provider of ["fal", "atlas", "google", "krea"]) {
    await request("/api/settings", { modelProviderPreferences: { ...expectedRouting, veo: provider } });
    // Atlas has a deliberately invalid configured fixture key. Reject the
    // missing start frame locally, before that key could reach an upload.
    const rejected = await fetch(`${api}/api/node/generate-video`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "Kling 4.0 Image-to-Video", prompt: "Routing validation only", startFrameUrls: [] }) });
    assert.equal(rejected.status, 400);
    assert.match((await rejected.json()).error, provider === "fal" ? /Fal API key/ : provider === "atlas" ? /exactly one Start Frame/ : /not supported/);
  }
  await request("/api/settings", { modelProviderPreferences: expectedRouting });
  const nano21Atlas = await fetch(`${api}/api/node/generate-image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "Nano Banana 2.1", prompt: "Routing validation only" }) });
  assert.equal(nano21Atlas.status, 400);
  assert.match((await nano21Atlas.json()).error, /Nano Banana 2.1.*not supported by Atlas/);
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
  const inputBytes = await readFile(path.join(sandbox, "outputs", "panel.png"));
  const inputFolder = path.join(saved.packagePath, "inputs");
  await writeFile(path.join(inputFolder, "already-here.png"), inputBytes);
  const inputCount = (await readdir(inputFolder)).length;
  async function uploadInput(bytes) {
    const form = new FormData();
    form.append("workflowPackageId", saved.id); form.append("workflowPackagePath", saved.packagePath);
    form.append("asset", new Blob([bytes], { type: "image/png" }), "already-here.png");
    const response = await fetch(api + "/api/node/upload-asset", { method: "POST", body: form, signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 200);
    return (await response.json()).asset;
  }
  const reusedInput = await uploadInput(inputBytes);
  assert.equal(reusedInput.storedFileName, "inputs/already-here.png");
  assert.match(reusedInput.localUrl, /\/inputs\/already-here\.png$/);
  assert.equal((await readdir(inputFolder)).length, inputCount);
  assert.deepEqual(await readFile(path.join(inputFolder, "already-here.png")), inputBytes);
  assert.equal((await uploadInput(inputBytes)).localUrl, reusedInput.localUrl);
  assert.notEqual((await uploadInput(Buffer.concat([inputBytes, Buffer.from("changed")]))).localUrl, reusedInput.localUrl);
  assert.equal((await readdir(inputFolder)).length, inputCount + 1);
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
  assert.equal((await (await request("/api/health")).json()).routes.generateAudio, true);
  assert.equal((await fetch(api + "/api/elevenlabs/voices")).status, 400);
  assert.equal((await fetch(api + "/api/node/generate-audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audioMode: "sfx", prompt: "Rain" }) })).status, 400);
  assert.equal(elevenDisabled.credentialProfiles.elevenLabs.length, 1);
  const audioBytes = Buffer.alloc(44 + 16000);
  audioBytes.write("RIFF"); audioBytes.writeUInt32LE(audioBytes.length - 8, 4); audioBytes.write("WAVEfmt ", 8); audioBytes.writeUInt32LE(16, 16); audioBytes.writeUInt16LE(1, 20); audioBytes.writeUInt16LE(1, 22); audioBytes.writeUInt32LE(8000, 24); audioBytes.writeUInt32LE(16000, 28); audioBytes.writeUInt16LE(2, 32); audioBytes.writeUInt16LE(16, 34); audioBytes.write("data", 36); audioBytes.writeUInt32LE(16000, 40);
  await writeFile(path.join(sandbox, "outputs", "speech.wav"), audioBytes);
  const audioSaved = await (await request("/api/saved-workflows", { id: "audio-smoke", name: "Audio Smoke", nodes: [{ id: "audio", type: "audioModel", data: { audioMode: "sts", voiceId: "fixture", sourceAudioUrl: "/outputs/speech.wav", resultUrl: "/outputs/speech.wav", resultItems: [{ type: "audio", url: "/outputs/speech.wav" }] } }], edges: [], packageParentPath: path.join(sandbox, "packages") })).json();
  const audioCopy = await (await request("/api/saved-workflows", { id: "audio-copy", sourceWorkflowId: audioSaved.id, name: "Audio Copy", nodes: audioSaved.graph.nodes, edges: [], packageParentPath: path.join(sandbox, "copies") })).json();
  const audioReopened = await (await request("/api/saved-workflows/" + encodeURIComponent(audioCopy.fileName))).json();
  const audioData = audioReopened.graph.nodes[0].data;
  assert.equal(audioData.audioMode, "sts");
  assert.ok(audioData.sourceAudioUrl.includes(audioCopy.id));
  assert.ok(audioData.resultItems[0].url.includes(audioCopy.id));
  assert.equal((await request(audioData.sourceAudioUrl)).status, 200);
  const timelineStill = await (await request("/api/node/assembly-extract-frame", { nodeId: "timeline-still", nodeTitle: "Timeline", frameTime: 0.125, assembly: {
    outputWidth: 320, outputHeight: 180, frameRate: 24, inPoint: 1, outPoint: 2,
    media: [{ id: "still", type: "image", url: "/outputs/panel.png", duration: 5 }, { id: "unused", type: "video", url: "/outputs/does-not-exist.mp4" }],
    tracks: [{ id: "v1", type: "video", clips: [{ id: "still-clip", mediaId: "still", start: 0, duration: 5 }] }]
  } }, localRenderTimeout)).json();
  assert.equal(timelineStill.endpoint, "local/timeline-extract-frame");
  assert.equal(timelineStill.image.mimeType, "image/png");
  assert.equal(timelineStill.image.metadata.width, 320);
  assert.equal(timelineStill.image.metadata.height, 180);
  assert.equal(timelineStill.cost.amountUsd, 0);
  assert.equal((await request(timelineStill.image.localUrl)).headers.get("content-type"), "image/png");
  const invalidTimelineTime = await fetch(api + "/api/node/assembly-extract-frame", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ frameTime: -1, assembly: {} }) });
  assert.equal(invalidTimelineTime.status, 400);
  const composite = await (await request("/api/node/utility-video", { model: "Composite Video", compositeVideo: { duration: 0.2, layers: [
    { id: "base", url: "/outputs/panel.png", type: "image", blendMode: "normal", mixAmount: 100 },
    { id: "layer1", url: "/outputs/clip.mp4", type: "video", blendMode: "screen", mixAmount: 50, maskUrl: "/outputs/panel.png", maskType: "image", maskBlur: 1, maskExpand: 1 },
    { id: "extra", url: "/outputs/panel.png", type: "image", blendMode: "multiply", mixAmount: 25, maskUrl: "/outputs/clip.mp4", maskType: "video", invertMask: true }
  ] } }, localRenderTimeout)).json();
  assert.ok(composite.video.localUrl);
  assert.ok(Math.abs(composite.video.duration - Number(probe.format.duration)) < 0.1, "Still layers must last for the video duration, regardless of Still Duration");
  assert.equal(composite.cost.amountUsd, 0);
  assert.equal((await request(composite.video.localUrl)).status, 200);
  const stillComposite = await (await request("/api/node/utility-video", { model: "Composite Video", compositeVideo: { layers: [
    { id: "base", url: "/outputs/panel.png", type: "image" }, { id: "layer1", url: "/outputs/panel.png", type: "image" }
  ] } }, localRenderTimeout)).json();
  assert.ok(stillComposite.video.localUrl);
  assert.ok(Math.abs(stillComposite.video.duration - 5) < 0.1, "Image-only stacks must default to five seconds");
  const legacyComposite = await (await request("/api/node/utility-video", { model: "Composite Video", referenceVideoUrls: ["/outputs/clip.mp4", "/outputs/clip.mp4"], compositeVideo: { blendMode: "screen", mixAmount: 50 } }, localRenderTimeout)).json();
  assert.ok(legacyComposite.video.localUrl);
  assert.equal(health.routes.videoOutpaint, true);
  assert.equal(health.routes.videoOutpaintFraming, true);
  assert.equal(health.routes.videoOutpaintMatching, true);
  assert.equal(health.routes.videoOutpaintConsistency, true);
  assert.equal(health.routes.videoOutpaintReferenceSlots, true);
  await promisify(execFile)(ffmpeg, ["-y", "-stream_loop", "-1", "-i", path.join(sandbox, "outputs", "clip.mp4"), "-t", "4", "-c:v", "copy", path.join(sandbox, "outputs", "outpaint-source.mp4")], { windowsHide: true, timeout: 30000 });
  const outpaintPrepared = await (await request("/api/node/video-outpaint-prepare", { sourceVideoUrl: "/outputs/outpaint-source.mp4", projectName: "Outpaint smoke", videoOutpaint: { aspectRatio: "9:16", duration: 3.375 } }, { timeoutMs: 120000 })).json();
  assert.equal(outpaintPrepared.plan.frames, 81);
  assert.equal(outpaintPrepared.plan.width, 720);
  assert.ok(outpaintPrepared.videoUrl && outpaintPrepared.maskVideoUrl && outpaintPrepared.previewUrl);
  assert.equal((await fetch(api + outpaintPrepared.maskVideoUrl)).ok, true);
  const refinished = await (await request("/api/node/video-outpaint-finish", { prepared: outpaintPrepared, rawVideoUrl: outpaintPrepared.videoUrl, videoOutpaint: { feather: 32, autoMatch: true, finalQc: true, visualQc: false } }, { timeoutMs: 120000 })).json();
  assert.equal(refinished.cost.amountUsd, 0);
  assert.equal(refinished.videoOutpaint.restoredSource, true);
  assert.equal(refinished.videoOutpaint.qc.status, "off");
  assert.equal(refinished.videoOutpaint.matching.finishVersion, 3);
  assert.equal(refinished.videoOutpaint.rawVideoUrl, outpaintPrepared.videoUrl);
  assert.match(refinished.videoOutpaint.outputFormat, /H.264 MP4/);
  assert.equal(refinished.mimeType, "video/mp4");
  assert.equal((await fetch(api + refinished.url)).ok, true);
  const outpaintPlayback = await fetch(api + "/api/video-preview?url=" + encodeURIComponent(refinished.url));
  assert.equal(outpaintPlayback.ok, true);
  assert.match(outpaintPlayback.headers.get("content-type"), /video\/mp4/);
  await outpaintPlayback.arrayBuffer();
  const masterCopy = await (await request("/api/node/save-output", { sourceUrl: refinished.url, sourceFileName: "master.mp4", mediaType: "video", outputFormat: "source", outputOriginalSourceUrl: "/outputs/outpaint-source.mp4", outputTargetPath: path.join(sandbox, "master-export"), outputTargetFileName: "master" })).json();
  const hashMaster = async file => { const hash = createHash("sha256"); for await (const chunk of createReadStream(file)) hash.update(chunk); return hash.digest("hex"); };
  assert.equal(await hashMaster(masterCopy.output.filePath), await hashMaster(refinished.filePath), "Same-format Output changed the completed MP4 bytes");
  await promisify(execFile)(ffmpeg, ["-y", "-i", path.join(sandbox, "outputs", "clip.mp4"), "-c:v", "prores_ks", "-profile:v", "3", "-pix_fmt", "yuv422p10le", path.join(sandbox, "outputs", "original.mov")], { windowsHide: true, timeout: 30000 });
  const sourceExportBody = { sourceUrl: refinished.url, sourceFileName: "master.mp4", mediaType: "video", outputFormat: "source", outputOriginalSourceUrl: "/outputs/original.mov", outputTargetPath: path.join(sandbox, "source-export"), outputTargetFileName: "finished" };
  const previewOriginal = await (await request("/api/node/preview-output", sourceExportBody)).json();
  const originalExport = await (await request("/api/node/save-output", sourceExportBody, localRenderTimeout)).json();
  assert.match(previewOriginal.preview.fileName, /\.mov$/);
  assert.equal(originalExport.output.fileName, previewOriginal.preview.fileName);
  const { stdout: originalProbe } = await promisify(execFile)(ffprobe.path, ["-v", "error", "-select_streams", "v:0", "-show_streams", "-of", "json", originalExport.output.filePath], { windowsHide: true });
  const exportedStream = JSON.parse(originalProbe).streams[0];
  assert.equal(exportedStream.codec_name, "prores");
  assert.equal(Number(exportedStream.nb_frames), outpaintPrepared.plan.frames, "Output must convert the whole completed clip");
  assert.equal(exportedStream.width, outpaintPrepared.plan.outputWidth);
  const noOutpaintKey = await fetch(api + "/api/node/utility-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "Video Outpaint", prompt: "Extend scene", referenceVideoUrls: ["/outputs/outpaint-source.mp4"] }) });
  assert.equal(noOutpaintKey.status, 400);
  assert.match((await noOutpaintKey.json()).error, /Fal-only/);
  const localOutpaintCrop = await (await request("/api/node/utility-video", { model: "Video Outpaint", referenceVideoUrls: ["/outputs/outpaint-source.mp4"], videoOutpaint: { aspectRatio: "16:9", frame: { x: 0.1, y: 0.1, width: 0.5 }, duration: 3.375, outputSize: "720p" } }, { timeoutMs: 120000 })).json();
  assert.equal(localOutpaintCrop.cost.amountUsd, 0);
  assert.equal(localOutpaintCrop.videoOutpaint.localCrop, true);
  assert.equal(localOutpaintCrop.video.width, 1280);
  assert.equal(localOutpaintCrop.video.height, 720);
  assert.equal(health.routes.videoOutpaintSeedance, true);
  assert.equal(health.routes.seedanceKreaVideoEditing, true);
  assert.equal(health.routes.videoOutpaintLocalMasks, true);
  assert.equal(health.routes.videoOutpaintSeedanceGreenPadding, true);
  assert.equal(health.routes.videoOutpaintSeedanceAllRepeats, true);
  assert.equal(health.routes.videoOutpaintSeedanceSourceFrames, true);
  const seedancePrepared = await (await request("/api/node/video-outpaint-prepare", { sourceVideoUrl: "/outputs/clip.mp4", videoOutpaint: { model: "seedance-2.5" } }, { timeoutMs: 120000 })).json();
  assert.equal(seedancePrepared.maskVideoUrl, undefined);
  assert.equal(seedancePrepared.plan.generationPaddingColor, "green");
  assert.ok(seedancePrepared.generationVideoUrl);
  assert.ok(seedancePrepared.maskImageUrl.endsWith(".png"));
  assert.equal(seedancePrepared.plan.frames, 97); assert.equal(seedancePrepared.plan.duration, 97 / 24);
  assert.equal(health.routes.videoOutpaintFullResolution, true);
  assert.deepEqual([seedancePrepared.plan.width, seedancePrepared.plan.height], [1080, 1920]);
  assert.equal(seedancePrepared.plan.looped, false); assert.equal(seedancePrepared.plan.tailPadded, true); assert.equal(seedancePrepared.loopedSourceUrl, undefined);
  await request("/api/settings", { modelProviderPreferences: { ...expectedRouting, seedance: "fal" } });
  const seedanceWithoutKey = await fetch(api + "/api/node/generate-video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "Seedance 2.5", videoOutpaintUtility: true, videoOutpaint: { model: "seedance-2.5" }, referenceVideoUrls: ["/outputs/clip.mp4"], prompt: "Extend scene" }) });
  assert.equal(seedanceWithoutKey.status, 400);
  assert.match((await seedanceWithoutKey.json()).error, /selected Fal key/);
  const seedanceCrop = await (await request("/api/node/generate-video", { model: "Seedance 2.5", videoOutpaintUtility: true, referenceVideoUrls: ["/outputs/clip.mp4"], videoOutpaint: { model: "seedance-2.5", aspectRatio: "16:9", frame: { x: 0.1, y: 0.1, width: 0.5 }, outputSize: "720p" } }, { timeoutMs: 120000 })).json();
  assert.equal(seedanceCrop.cost.amountUsd, 0); assert.equal(seedanceCrop.videoOutpaint.localCrop, true);
  assert.equal(seedanceCrop.video.num_frames, seedancePrepared.plan.outputFrames);
  await request("/api/settings", { modelProviderPreferences: expectedRouting });


  console.log("Isolated API passed: startup, history backup recovery, settings and routing persistence, project catalog, video poster, diagnostics, Save As, reopen, clone catalog, uncertain-result import, Director reference completeness, image/video Composite layers and masks; no provider calls.");
} finally {
  if (clientChild && clientChild.exitCode === null) clientChild.kill("SIGTERM");
  if (clientExited) await clientExited;
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

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { normalizeKeyerData, keyerSettings, keyerResultForPort } from "../src/keyer.js";
import { nodeSchedulingKey } from "../src/nodeScheduling.js";
import { isRunnableNode } from "../src/nodeRunner.js";
import { createKeyerService, keyerArguments, keyerRuntime } from "../server/keyer.js";
import { registerKeyerRoutes } from "../server/routes/keyer.js";
import { isKeyerNode, migrateKeyerNode, remapUtilityKeyerEdges } from "../src/keyer.js";
import { utilityVideoModelNames, utilityVideoModelOptions, normalizeModelPreferences, isRetiredUtilityVideoModel } from "../src/modelOptions.js";
import { catalogNodeTypeDefinitions } from "../src/nodeRegistry.js";

test("CorridorKey lives in Utility and retired models are excluded from both pickers and preferences", () => {
  assert.ok(utilityVideoModelOptions.includes("CorridorKey 2.0"));
  assert.equal(catalogNodeTypeDefinitions.some(item => item.type === "keyer"), false);
  const prefs = normalizeModelPreferences();
  for (const name of [utilityVideoModelNames.extractFrame, utilityVideoModelNames.wanVaceMaskToVideo, utilityVideoModelNames.wanVaceInpainting]) {
    assert.equal(utilityVideoModelOptions.includes(name), false);
    assert.equal(prefs.utilityVideo[name], undefined);
    assert.equal(isRetiredUtilityVideoModel(name), true);
  }
  assert.equal(isRetiredUtilityVideoModel(utilityVideoModelNames.wan22VaceInpainting), false);
});

test("saved Keyer nodes migrate without losing identity, settings, pass URLs or ports", () => {
  const item = { url: "/outputs/key.mov", keyer: { passes: { alpha: { url: "/outputs/matte.mp4" } } } };
  const legacy = { id: "old-key", type: "keyer", x: 40, y: 80, data: { title: "Keyer 2", keyerDespill: .7, resultItems: [item], selectedResultIndex: 0 } };
  const node = migrateKeyerNode(legacy);
  assert.equal(node.id, legacy.id); assert.equal(node.type, "utility"); assert.equal(node.data.title, "Utility 2");
  assert.equal(node.data.utilityVideoModel, "CorridorKey 2.0"); assert.equal(node.data.utilityMode, "video");
  assert.equal(node.data.keyerDespill, .7); assert.equal(node.data.resultItems[0], item);
  assert.equal(keyerResultForPort(node, "matteOut").url, "/outputs/matte.mp4");
  assert.equal(isKeyerNode(node), true); assert.equal(nodeSchedulingKey(node), "localGpu");
  assert.equal(migrateKeyerNode({ ...legacy, data: { title: "My green screen" } }).data.title, "My green screen");
});

test("switching Utility models preserves source and primary output wires and removes unsupported auxiliary wires", () => {
  const edges = [
    { id: "in", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "util", port: "referenceVideoIn" } },
    { id: "out", from: { nodeId: "util", port: "utilityOut" }, to: { nodeId: "output", port: "sourceIn" } }
  ];
  const keying = remapUtilityKeyerEdges(edges, "util", ["videoIn", "firstHintIn", "hintVideoIn"], ["cutoutOut", "matteOut", "foregroundOut"], true);
  assert.equal(keying[0].to.port, "videoIn"); assert.equal(keying[1].from.port, "cutoutOut");
  const matte = { id: "matte", from: { nodeId: "util", port: "matteOut" }, to: { nodeId: "preview", port: "sourceIn" } };
  assert.deepEqual(remapUtilityKeyerEdges([...keying, matte], "util", ["referenceVideoIn"], ["utilityOut"], false), edges);
  assert.equal(remapUtilityKeyerEdges(keying, "util", ["imageIn"], ["utilityOut"], false, true).length, 0);
});

test("Keyer normalization clamps persisted controls and keeps portable result metadata", () => {
  const passes = { alpha: { url: "/outputs/matte.mp4" }, cutout: { url: "/outputs/key.mov" } };
  const item = { url: passes.cutout.url, keyer: { passes } };
  const d = normalizeKeyerData({ keyerMode: "injected", keyerDespill: 8, keyerHintQuality: "bad", keyerFrameLimit: -1, resultItems: [item], keyerCarry: false });
  assert.equal(d.keyerMode, "auto"); assert.equal(d.keyerDespill, 1); assert.equal(d.keyerHintQuality, .95); assert.equal(d.keyerFrameLimit, 0);
  assert.equal(keyerResultForPort({ data: d }, "matteOut").url, passes.alpha.url);
  assert.equal(keyerResultForPort({ data: d }, "foregroundOut"), null);
  assert.equal(keyerResultForPort({ data: d }, "unknown"), null);
  assert.equal(keyerSettings(d).carry, false);
  assert.equal(isRunnableNode({ type: "keyer" }), true);
  assert.equal(nodeSchedulingKey({ type: "keyer" }), "localGpu");
});

test("Keyer CLI arguments use explicit hint and memory modes without shell interpolation", () => {
  const args = keyerArguments({ input: "file with spaces.mov", output: "out", firstHint: "hint.png", ffmpeg: "ffmpeg", settings: { mode: "first", despill: .7, hintQuality: .8, memory: "low", carry: false, frameLimit: 12 } });
  assert.equal(args[args.indexOf("--input") + 1], "file with spaces.mov");
  assert.equal(args[args.indexOf("--hint_first_frame") + 1], "hint.png");
  assert.ok(args.includes("--low_vram")); assert.ok(args.includes("--no_carry_hint"));
  assert.equal(args[args.indexOf("--num_frames") + 1], "12");
  assert.equal(keyerRuntime({ NEWTNODE_CORRIDORKEY_ROOT: "/engine" }, "darwin").python, path.join("/engine", "venv", "bin/python"));
  assert.equal(keyerRuntime({ NEWTNODE_CORRIDORKEY_ROOT: "/engine", NEWTNODE_CORRIDORKEY_PYTHON: "/custom/python" }).python, "/custom/python");
});

test("route normalizes untrusted settings and never forwards arbitrary CLI flags", async () => {
  const handlers = new Map(); let body;
  registerKeyerRoutes({ get: () => {}, post: (route, handler) => handlers.set(route, handler) }, { start: value => { body = value; return { jobId: "test" }; } });
  const res = { status(code) { this.code = code; return this; }, json(value) { this.value = value; } };
  await handlers.get("/api/node/keyer")({ body: { sourceVideoUrl: "/outputs/a.mp4", settings: { mode: "video", despill: 999, frameLimit: -50, flags: ["--weights", "evil"] } } }, res);
  assert.equal(res.code, 202); assert.equal(body.settings.mode, "video"); assert.equal(body.settings.despill, 1); assert.equal(body.settings.frameLimit, 0); assert.equal(body.settings.flags, undefined);
});

async function harness(t, run) {
  const root = await mkdtemp(path.join(os.tmpdir(), "newt-keyer-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const python = path.join(root, "python");
  const required = ["python", "infer.py", "weights/corridorkey_v2.safetensors", "weights/foundation_stats.safetensors", "vfms/cradio/C-RADIOv4-SO400M/model.safetensors", "vfms/moge/model.pt", "vfms/rvm/pretrain_rvm_small16_256_204031069.npz", "source.mp4"];
  for (const file of required) { await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), "fixture"); }
  const targets = [], history = [];
  const service = createKeyerService({
    runtime: () => ({ root, python }), ffmpeg: "ffmpeg", isLocalAssetUrl: url => url.startsWith("/outputs/"),
    resolveAsset: async url => ({ filePath: path.join(root, path.basename(url)) }),
    probeVideo: async () => ({ width: 512, height: 512, duration: 1, fps: 24 }),
    createTarget: async (_body, kind, extension, dependency) => { const fileName = `${kind}${extension}`; targets.push({ kind, dependency }); return { fileName, filePath: path.join(root, fileName), publicPath: `/outputs/${fileName}` }; },
    recordHistory: async item => history.push(item), projectFromBody: () => ({}), nodeFromBody: () => ({}), run
  });
  const body = { sourceVideoUrl: "/outputs/source.mp4", settings: keyerSettings() };
  return { root, service, targets, history, body };
}
const complete = async (service, id) => {
  for (let n = 0; n < 300; n++) { const job = service.job(id); if (["complete", "error"].includes(job.state)) return job; await new Promise(resolve => setTimeout(resolve, 10)); }
  throw new Error("Fixture job did not finish");
};

test("service serializes windows, preserves each managed pass and records local History", async t => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const h = await harness(t, async (_python, args, { onProgress }) => {
    await gate; onProgress("Temporal processing: window 1/1");
    const out = args[args.indexOf("--output_dir") + 1]; await mkdir(out, { recursive: true });
    for (const name of ["source_cutout.mov", "source_alpha.mp4", "source_fg.mp4", "source_checker_comp_despill050.mp4"]) await writeFile(path.join(out, name), name);
  });
  const first = h.service.start(h.body);
  await assert.rejects(h.service.start(h.body), /busy/);
  const { jobId } = await first; release();
  const job = await complete(h.service, jobId);
  assert.equal(job.state, "complete", job.error);
  assert.equal(job.item.url, "/outputs/keyer-cutout.mov");
  assert.equal(job.item.keyer.passes.alpha.url, "/outputs/keyer-alpha.mp4");
  assert.deepEqual(h.targets.map(t => t.dependency), [false, true, true, true]);
  assert.equal(h.history[0].provider, "local"); assert.equal(h.history[0].cost.amountUsd, 0);
  assert.equal(await readFile(path.join(h.root, "keyer-alpha.mp4"), "utf8"), "source_alpha.mp4");
  assert.equal((await h.service.status()).busy, false);
});

test("service rejects remote inputs and missing hints, exposes process failures without a result", async t => {
  const h = await harness(t, async () => { throw new Error("CUDA out of memory"); });
  await assert.rejects(h.service.start({ ...h.body, sourceVideoUrl: "https://example.com/video.mp4" }), /managed local/);
  await assert.rejects(h.service.start({ ...h.body, settings: { ...h.body.settings, mode: "first" } }), /first-frame/);
  const { jobId } = await h.service.start(h.body);
  const job = await complete(h.service, jobId);
  assert.equal(job.state, "error"); assert.match(job.error, /CUDA out of memory/);
  assert.equal(job.item, undefined); assert.equal(h.targets.length, 0); assert.equal(h.history.length, 0);
  assert.equal((await h.service.status()).busy, false);
});

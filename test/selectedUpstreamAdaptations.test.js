import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCreativeAnalysisCache } from "../server/creative-analysis-cache.js";
import { creativeOpenAiModel, openAiLlmBody, validateCreativeResponse } from "../server/creative-llm.js";
import { directorMusicLevelContext } from "../server/director-music.js";
import { NewtPresetStore } from "../server/newt-presets.js";
import {
  filmDirectorApproachDirective,
  filmDirectorMusicVideoError,
  filmDirectorSupportsMusic,
  normalizeFilmDirectorApproach
} from "../src/filmDirectorApproaches.js";
import {
  filmDirectorReferenceVideoMode,
  normalizeFilmDirectorReferenceVideoOptions,
  selectFilmDirectorReferenceVideoMode
} from "../src/filmDirectorScenes.js";
import { generateCharacterBaseSheets } from "../src/characterSheetWorkflow.js";
import { applyImageAdjustmentsToCanvas, curveLookup } from "../src/imageAdjustments.js";
import { bindNewtPresetInputs, buildNewtPresetGraph, instantiateNewtPreset } from "../src/newtPresets.js";
import { requireStoryboardPlanResponse, storyboardPlanIssues, storyboardQcUnavailable } from "../src/storyboardPlanValidation.js";

test("creative Director responses use strict structured output and cache successful analysis", async () => {
  const body = openAiLlmBody({
    model: creativeOpenAiModel,
    input: "Build a scene",
    systemPrompt: "Return direction",
    responseMimeType: "application/json",
    route: "film-director-style"
  });
  assert.equal(body.store, false);
  assert.equal(body.text.format.type, "json_schema");
  assert.deepEqual(validateCreativeResponse({}, {
    route: "film-director-style",
    provider: "OpenAI",
    text: JSON.stringify({ styleDirection: "Soft natural daylight" })
  }), { styleDirection: "Soft natural daylight" });

  let calls = 0;
  const reuse = createCreativeAnalysisCache();
  const generate = async () => ({ analysis: `result-${++calls}`, usages: [{ amountUsd: 1 }] });
  const first = await reuse("same-input", generate);
  const second = await reuse("same-input", generate);
  assert.equal(calls, 1);
  assert.equal(first.analysis, second.analysis);
  assert.deepEqual(second.usages, []);
  assert.equal(second.cacheHit, true);
});

test("Director approaches validate music and expose distinct creative direction", () => {
  assert.equal(normalizeFilmDirectorApproach("MUSIC-VIDEO"), "music-video");
  assert.equal(filmDirectorSupportsMusic("montage"), true);
  assert.match(filmDirectorApproachDirective("vintage"), /8mm/i);
  assert.match(filmDirectorMusicVideoError({ approach: "music-video" }), /Connect an audio file/);
  assert.equal(filmDirectorMusicVideoError({
    approach: "music-video",
    audioInputs: [{ url: "/outputs/song.wav" }],
    videoModel: "Seedance 2.5"
  }), "");
});

test("Director reference video modes remain mutually exclusive and normalized", () => {
  assert.deepEqual(normalizeFilmDirectorReferenceVideoOptions({ extend: true, camera: true }), {
    extend: true,
    camera: false,
    reference: false
  });
  const selected = selectFilmDirectorReferenceVideoMode({ extend: true }, "camera", true);
  assert.equal(filmDirectorReferenceVideoMode(selected), "camera");
  assert.equal(filmDirectorReferenceVideoMode(selectFilmDirectorReferenceVideoMode(selected, "camera", false)), "");
});

test("Director music analysis reports level evidence without inventing beats", () => {
  const samples = Float32Array.from({ length: 1600 }, (_value, index) => index < 800 ? 0.1 : 0.8);
  const context = directorMusicLevelContext(samples, 800);
  assert.match(context, /relative audio levels/i);
  assert.match(context, /not a listening description/i);
  assert.throws(() => directorMusicLevelContext(new Float32Array(800), 800), /silent/i);
});

test("Storyboard planning rejects incomplete plans and preserves an unreviewed QC state", () => {
  const shotList = "CUT 1 shot frame: WS; camera movement: Static; shot type: Establishing Wide; Description: Room.\n\nCUT 2 shot frame: CU; camera movement: Static; shot type: Close-Up; Description: Face.";
  const plan = {
    frames: [
      { number: 1, prompt: "Wide room", notes: "CUT 1" },
      { number: 2, prompt: "Face before the reaction", notes: "CUT 2" },
      { number: 3, prompt: "Face after the reaction", notes: "CUT 2" }
    ]
  };
  assert.deepEqual(storyboardPlanIssues(plan, shotList), []);
  assert.throws(() => requireStoryboardPlanResponse({ ok: false }, { error: "Provider failed" }), /Provider failed/);
  assert.equal(storyboardQcUnavailable().severity, "unreviewed");
});

test("Character base generation checkpoints each completed sheet independently", async () => {
  const checkpoints = [];
  const result = await generateCharacterBaseSheets({
    baseSignature: "image-signature",
    baseVideoSignature: "video-signature",
    includeVideo: true,
    generateBase: async () => ({ url: "/outputs/base.png" }),
    generateVideo: async () => ({ url: "/outputs/video.png" }),
    onCheckpoint: async (value) => checkpoints.push(structuredClone(value))
  });
  assert.equal(checkpoints.length, 2);
  assert.equal(checkpoints[0].characterBaseSheet.url, "/outputs/base.png");
  assert.equal(checkpoints[0].characterBaseVideoSheet, null);
  assert.equal(checkpoints[1].characterBaseVideoSheet.url, "/outputs/video.png");
  assert.equal(result.baseVideoSignature, "video-signature");
});

test("shared image adjustment math applies the same curve and tone operations", () => {
  const pixels = new Uint8ClampedArray([64, 96, 128, 255]);
  const context = {
    getImageData: () => ({ data: pixels }),
    putImageData: () => {}
  };
  const identity = curveLookup();
  assert.equal(identity[0], 0);
  assert.equal(identity[255], 255);
  applyImageAdjustmentsToCanvas(context, 1, 1, { brightness: 10, contrast: 0, saturation: 0 });
  assert.ok(pixels[0] > 64 && pixels[1] > 96 && pixels[2] > 128);
});

test("Newt Presets preserve graph behavior, sanitize runtime state and bind reusable inputs", () => {
  const graph = {
    nodes: [
      { id: "source", type: "image", x: 0, y: 0, data: { title: "Hero", resultUrl: "/outputs/hero.png" } },
      { id: "model", type: "imageModel", x: 400, y: 0, data: { title: "Look", prompt: "Use @Hero", status: "running", apiKey: "private" } }
    ],
    edges: [{ id: "edge", from: { nodeId: "source", port: "imageOut" }, to: { nodeId: "model", port: "imageIn" }, color: "blue" }],
    groups: []
  };
  const saved = buildNewtPresetGraph({ ...graph, slots: [{ nodeId: "source", type: "image", role: "Image", label: "Hero" }] });
  assert.equal(saved.nodes[1].data.status, "ready");
  assert.doesNotMatch(JSON.stringify(saved), /private|apiKey/);
  const copy = instantiateNewtPreset(saved, { x: 900, y: 100 });
  const replacement = { id: "existing", type: "image", data: { title: "Replacement" } };
  const bound = bindNewtPresetInputs(copy, { source: "existing" }, [replacement]);
  assert.equal(bound.nodes.some((node) => node.type === "image"), false);
  assert.equal(bound.edges[0].from.nodeId, "existing");
  assert.match(bound.nodes[0].data.prompt, /@Replacement/);
});

test("user preset storage persists metadata and supports deletion", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "newt-user-presets-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const store = new NewtPresetStore({
    directory: path.join(root, "presets"),
    assetsDirectory: path.join(root, "assets"),
    assetsUrl: "/outputs/Newt-Presets/dependencies",
    resolveAsset: async () => { throw new Error("No assets expected"); },
    collectAssetUrls: () => new Set(),
    rewriteAssetUrls: (value) => value
  });
  const graph = buildNewtPresetGraph({ nodes: [{ id: "text", type: "plainText", x: 0, y: 0, data: { title: "Prompt", text: "Hello" } }] });
  const saved = await store.save({ name: "Prompt starter", graph });
  assert.equal((await store.list())[0].nodeCount, 1);
  assert.equal((await store.get(saved.id)).name, "Prompt starter");
  await store.remove(saved.id);
  assert.deepEqual(await store.list(), []);
});

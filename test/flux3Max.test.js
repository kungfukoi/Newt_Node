import test from "node:test";
import assert from "node:assert/strict";
import { buildFlux3MaxRequest, flux3MaxSelectionPatch, flux3MaxCost, flux3MaxModelName, flux3MaxUnsupportedPorts } from "../src/flux3Max.js";
import { filmDirectorVideoModelOptions } from "../src/filmDirectorVideoModels.js";
import { generateFlux3Max } from "../server/flux3Max.js";
import { videoModelOptions, videoWorkspaceModelOptions } from "../src/modelOptions.js";
import { generationProviderForModel } from "../src/generationPricing.js";
import { modelProviderOptionState } from "../src/modelProviderRouting.js";
import { buildVideoGenerationRequest, videoModelSupportsFilmDirector } from "../src/nodeRunners/videoModels.js";

const body = { ...flux3MaxSelectionPatch(), prompt: "A bird sings" };

test("FLUX 3 Max excludes Director selection, ports and packages before uploads or billing", async () => {
  assert.equal(filmDirectorVideoModelOptions.includes(flux3MaxModelName), false);
  assert.ok(flux3MaxUnsupportedPorts.includes("directorIn"));
  for (const filmDirector of [{}, { finalPrompt: "A forest scene", videoModel: flux3MaxModelName }]) {
    await assert.rejects(generateFlux3Max({ ...body, filmDirector }, {
      upload: () => assert.fail("Director package uploaded"), subscribe: () => assert.fail("Director package submitted")
    }), /does not support Director/);
  }
});

test("FLUX 3 Max uses the video catalog and explicit Fal or Krea provider selection", () => {
  assert.ok(videoModelOptions.includes(flux3MaxModelName));
  assert.equal(videoWorkspaceModelOptions.includes(flux3MaxModelName), false);
  for (const provider of ["fal", "google", "krea"]) assert.equal(modelProviderOptionState(flux3MaxModelName, "video", { veo: provider }).disabled, provider === "google");
  for (const provider of ["fal", "google", "krea"]) assert.equal(generationProviderForModel({ model: flux3MaxModelName, mediaType: "video", providerPreferences: { veo: provider } }), provider === "google" ? null : provider);
  assert.equal(videoModelSupportsFilmDirector(flux3MaxModelName), false);
});

test("text generation sends the documented schema and preserves saved controls", () => {
  const saved = { ...body, duration: "20 seconds", resolution: "1080p", aspectRatio: "21:9", seed: "0", flux3MaxReasoningLevel: "low", generateAudio: false };
  const node = { id: "video", data: saved };
  const request = buildVideoGenerationRequest({ node, prompt: saved.prompt });
  assert.deepEqual(buildFlux3MaxRequest(request), { endpoint: "blackforestlabs/flux-3-max/text-to-video", input: {
    prompt: saved.prompt, duration: 20, resolution: "1080p", aspect_ratio: "21:9", reasoning_level: "low", generate_audio: false, seed: 0
  } });
  const { prompt, ...settings } = saved;
  assert.deepEqual(flux3MaxSelectionPatch(JSON.parse(JSON.stringify(saved))), settings);
});

test("invalid settings and unsupported references reject before uploads or billing", async () => {
  for (const invalid of [
    { duration: "4 seconds" }, { duration: "21 seconds" }, { resolution: "4K" }, { aspectRatio: "5:4" },
    { flux3MaxReasoningLevel: "medium" }, { seed: "abc" }, { generateAudio: "false" },
    { startFrameUrls: ["/outputs/start.png"] }, { endFrameUrls: ["/outputs/end.png"] }, { startFrameUrls: ["a", "b"] },
    { startFrameUrls: ["https://external.invalid/start.png"] }, { referenceImageUrls: ["a"] },
    { characterReferenceUrls: ["a"] }, { referenceVideoUrls: ["a"] }, { referenceAudioUrls: ["a"] }, { filmDirector: { references: [{ url: "/outputs/reference.png" }] } }
  ]) {
    await assert.rejects(generateFlux3Max({ ...body, ...invalid }, {
      isManagedUrl: url => url.startsWith("/outputs/"),
      upload: () => assert.fail("invalid request uploaded"), subscribe: () => assert.fail("invalid request submitted")
    }));
  }
});

test("provider failures are not retried and missing outputs are actionable", async () => {
  let calls = 0;
  await assert.rejects(generateFlux3Max(body, { subscribe: async () => { calls++; throw new Error("Provider unavailable"); } }), /Provider unavailable/);
  assert.equal(calls, 1);
  await assert.rejects(generateFlux3Max(body, { subscribe: async () => ({ data: {} }) }), /Check Fal history/);
  assert.equal(flux3MaxCost("endpoint", 5).pricingStatus, "unpriced");
  assert.equal(flux3MaxCost("endpoint", 5).amountUsd, null);
});

test("keyframes preserve positions, upload every image and select the keyframes endpoint", async () => {
  const request = { ...body, flux3MaxKeyframes: [{ image_url: "/outputs/b.png", frame_index: "72" }, { image_url: "/outputs/a.png", frame_index: "24" }] };
  let uploads = 0;
  await generateFlux3Max(request, {
    isManagedUrl: url => url.startsWith("/outputs/"),
    upload: async url => { uploads++; return `https://uploaded.invalid${url}`; },
    subscribe: async (endpoint, { input }) => {
      assert.equal(endpoint, "blackforestlabs/flux-3-max/keyframes-to-video");
      assert.deepEqual(input.keyframes.map(frame => frame.frame_index), [24, 72]);
      assert.match(input.keyframes[0].image_url, /a.png$/);
      assert.equal(input.image_url, undefined);
      return { data: { video: { url: "https://example.invalid/video.mp4" } } };
    }
  });
  assert.equal(uploads, 2);
});

test("invalid keyframes reject before uploads and billing", async () => {
  for (const frames of [
    [{ image_url: "/outputs/a.png", frame_index: "" }],
    [{ image_url: "/outputs/a.png", frame_index: 121 }],
    [{ image_url: "/outputs/a.png", frame_index: 1.5 }],
    [{ image_url: "/outputs/a.png", frame_index: 24 }, { image_url: "/outputs/b.png", frame_index: 24 }],
    Array.from({ length: 11 }, (_, i) => ({ image_url: "/outputs/a.png", frame_index: i })),
    [{ image_url: "https://external.invalid/a.png", frame_index: 24 }]
  ]) await assert.rejects(generateFlux3Max({ ...body, flux3MaxKeyframes: frames }, {
    isManagedUrl: url => url.startsWith("/outputs/"), upload: () => assert.fail("uploaded"), subscribe: () => assert.fail("submitted")
  }));
});

test("individual keyframe rows map image positions and enforce uniqueness", () => {
  const frames = [{ image_url: "/outputs/a.png", frame_index: "0" }, { image_url: "/outputs/b.png", frame_index: "48" }];
  const { input, endpoint } = buildFlux3MaxRequest({ ...body, flux3MaxKeyframes: frames });
  assert.match(endpoint, /keyframes-to-video$/);
  assert.deepEqual(input.keyframes.map(frame => frame.frame_index), [0, 48]);
  assert.throws(() => buildFlux3MaxRequest({ ...body, flux3MaxKeyframes: [...frames, frames[0]] }), /unique/);
  assert.throws(() => buildFlux3MaxRequest({ ...body, flux3MaxKeyframes: [{ image_url: "/outputs/a.png", frame_index: "" }] }), /integer/);
});

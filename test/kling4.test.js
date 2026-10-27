import { test } from "node:test";
import assert from "node:assert/strict";
import { buildKling4Request, kling4Endpoints, kling4ModelName, kling4SelectionPatch } from "../src/kling4.js";
import { generateKling4, kling4HistorySettings } from "../server/kling4.js";
import { videoModelOptions, normalizeModelPreferences, enabledVideoModelOptions } from "../src/modelOptions.js";
import { modelProviderOptionState, providerSupportedModels } from "../src/modelProviderRouting.js";
import { generationProviderForModel, estimateVideoRunCost } from "../src/generationPricing.js";
import { normalizeStatsRecord, aggregateRecords } from "../src/statsAnalytics.js";
import { buildVideoGenerationRequest } from "../src/nodeRunners/videoModels.js";

const body = { model: kling4ModelName, prompt: "A bird flies", duration: "30 seconds", resolution: "1080p", startFrameUrls: ["/uploads/start.png"], endFrameUrls: ["/uploads/end.png"], referenceImageUrls: ["/uploads/middle.png", "/uploads/middle.png"] };

test("Kling 4.0 is independently enabled only through selected Fal/Atlas routes", () => {
  assert.ok(videoModelOptions.includes(kling4ModelName));
  for (const provider of ["fal", "atlas", "krea", "google", "local"]) {
    assert.equal(modelProviderOptionState(kling4ModelName, "video", { veo: provider }).disabled, !["fal", "atlas"].includes(provider));
    assert.equal(providerSupportedModels("veo", provider).includes(kling4ModelName), ["fal", "atlas"].includes(provider));
    assert.equal(generationProviderForModel({ model: kling4ModelName, mediaType: "video", providerPreferences: { veo: provider } }), ["fal", "atlas"].includes(provider) ? provider : null);
  }
  assert.ok(enabledVideoModelOptions(normalizeModelPreferences({})).includes(kling4ModelName));
  assert.ok(!enabledVideoModelOptions({ video: { [kling4ModelName]: false } }).includes(kling4ModelName));
  assert.equal(estimateVideoRunCost({ ...body, provider: "fal" }), null);
  assert.deepEqual(kling4SelectionPatch(body), { model: kling4ModelName, duration: "30 seconds", resolution: "1080p", aspectRatio: "Auto", generateAudio: false, characterVoiceMode: "off" });
});

for (const provider of ["fal", "atlas"]) {
  test(`${provider} maps frames, settings, result identity and unpriced Stats without fallback`, async () => {
    const uploads = [], calls = [];
    const result = await generateKling4(body, provider, {
      isManagedUrl: url => url.startsWith("/uploads/"),
      upload: async url => { uploads.push(url); return `https://example.test${url}`; },
      subscribe: async (endpoint, { input }) => { calls.push({ endpoint, input }); return { requestId: "fal-job", data: { video: { url: "https://example.test/out.mp4" } } }; },
      atlasGenerate: async input => { calls.push({ endpoint: input.model, input }); return { requestId: "atlas-job", url: "https://example.test/out.mp4" }; }
    });
    assert.equal(calls.length, 1);
    assert.equal(result.endpoint, kling4Endpoints[provider]);
    assert.equal(uploads.length, 4);
    const input = calls[0].input;
    assert.equal(input.duration, 30);
    assert.equal(input.resolution, "1080p");
    assert.deepEqual(input[provider === "fal" ? "middle_image_urls" : "middle_images"], ["https://example.test/uploads/middle.png", "https://example.test/uploads/middle.png"]);
    assert.equal(input.generate_audio, undefined);
    assert.equal(input.aspect_ratio, undefined);
    assert.equal(input[provider === "fal" ? "image" : "start_image_url"], undefined);
    const settings = kling4HistorySettings(body, provider, input);
    assert.equal(settings.provider, provider);
    assert.equal(settings.duration, 30);
    assert.equal(settings.endFrameCount, 1);
    assert.equal(settings.middleImageCount, 2);
    assert.deepEqual(settings.middleImageUrls, body.referenceImageUrls);
    assert.equal(settings.aspectRatio, "source image");
    const row = normalizeStatsRecord({ id: result.result.requestId, provider, modelName: kling4ModelName, endpoint: result.endpoint, cost: result.cost });
    assert.equal(row.provider, provider);
    assert.equal(row.endpoint, kling4Endpoints[provider]);
    assert.equal(aggregateRecords([row], "model")[0].unpricedCount, 1);
  });
}

test("invalid settings and unsupported inputs fail before upload or paid submission", async () => {
  let calls = 0;
  const deps = { isManagedUrl: () => true, upload: () => { calls++; }, subscribe: () => { calls++; }, atlasGenerate: () => { calls++; } };
  for (const patch of [{ startFrameUrls: [] }, { startFrameUrls: ["a", "b"] }, { endFrameUrls: ["a", "b"] }, { duration: "31 seconds" }, { resolution: "4k-esr" }, { referenceImageUrls: Array(9).fill("a") }, { referenceAudioUrls: ["a"] }, { characterReferenceUrls: ["a"] }, { referenceVideoUrls: ["a"] }, { filmDirector: {} }]) {
    await assert.rejects(generateKling4({ ...body, ...patch }, "fal", deps), { status: 400 });
  }
  await assert.rejects(generateKling4(body, "krea", deps), /requires Fal or Atlas/);
  assert.equal(calls, 0);
  assert.equal(buildKling4Request({ ...body, resolution: "4k-esr" }, "atlas").input.resolution, "4k-esr");
});

test("provider failures never retry or fall back", async () => {
  let submissions = 0;
  await assert.rejects(generateKling4(body, "fal", { isManagedUrl: () => true, upload: async () => "https://example.test/image.png", subscribe: async () => { submissions++; throw new Error("selected provider failed"); }, atlasGenerate: () => assert.fail("fallback") }), /selected provider failed/);
  assert.equal(submissions, 1);
});

test("node request preserves keyframes and disables unsupported audio", () => {
  const request = buildVideoGenerationRequest({ node: { id: "kling", data: { ...body, generateAudio: true } }, prompt: body.prompt, startFrameUrls: body.startFrameUrls, endFrameUrls: body.endFrameUrls, referenceImageUrls: body.referenceImageUrls });
  assert.equal(request.generateAudio, false);
  assert.deepEqual(request.referenceImageUrls, body.referenceImageUrls);
  assert.equal(request.model, kling4ModelName);
});

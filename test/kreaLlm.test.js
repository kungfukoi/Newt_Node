import test from "node:test";
import assert from "node:assert/strict";
import { buildKreaLlmInput, requestKreaLlm } from "../server/krea-llm.js";
import { buildKreaEnhanceInput, kreaEnhanceEndpoint } from "../server/krea-enhance.js";
import { buildKreaImageInput, kreaEndpointForModel } from "../src/kreaApi.js";
import { modelProviderOptionState, normalizeModelProviderPreferences, providerSupportedModels } from "../src/modelProviderRouting.js";

test("Krea Agent pins the selected creative model and constrains the reply to analysis", () => {
  const body = buildKreaLlmInput({ prompt: "Plan three shots", systemPrompt: "Keep @Alice", model: "gpt-6-astra", responseMimeType: "application/json", attachments: [{ url: "https://example.com/alice.png" }] });
  assert.equal(body.model, "openai/gpt-6-astra");
  assert.match(body.prompt, /Keep @Alice/);
  assert.match(body.prompt, /Return only valid JSON/);
  assert.match(body.prompt, /Do not generate images/);
  assert.equal(body.attachments.length, 1);
  assert.throws(() => buildKreaLlmInput({ model: "not-a-model" }), /does not support/);
  assert.throws(() => buildKreaLlmInput({ prompt: "a".repeat(100001) }), /100,000/);
});

test("Krea sends one paid turn and polls its exact run through completion", async () => {
  const calls = [];
  const responses = [{ sessionId: "session", runId: "run", url: "https://www.krea.ai/agent/session" }, { status: "running", finished: false }, { status: "completed", finished: true, text: '{"cuts":[]}' }];
  const result = await requestKreaLlm({ prompt: "Plan" }, { apiKey: "fixture-key", fetchImpl: async (url, options) => {
    calls.push({ url, ...options, body: JSON.parse(options.body) });
    return { ok: true, json: async () => responses.shift() };
  } });
  assert.equal(calls.filter(call => call.url.endsWith("/send-message")).length, 1);
  assert.deepEqual(calls[1].body, { sessionId: "session", runId: "run", timeoutSeconds: 30 });
  assert.equal(calls[0].headers.Authorization, "Bearer fixture-key");
  assert.equal(result.provider, "Krea");
  assert.equal(result.text, '{"cuts":[]}');
  assert.equal(result.usage, null); // No invented token or dollar usage.
});

test("Krea failures never submit a replacement paid turn or fall back to another provider", async () => {
  for (const terminal of [{ status: "failed", finished: true, error: "Plan lacks access" }, { status: "cancelled", finished: true }, { status: "completed", finished: true, text: "" }]) {
    let sends = 0;
    await assert.rejects(requestKreaLlm({ prompt: "Plan" }, { apiKey: "fixture", fetchImpl: async url => ({ ok: true, json: async () => url.endsWith("send-message") ? (sends++, { sessionId: "s", runId: "r" }) : terminal }) }));
    assert.equal(sends, 1);
  }
  let calls = 0;
  await assert.rejects(requestKreaLlm({ prompt: "Plan" }, { apiKey: "fixture", fetchImpl: async () => { calls++; return { ok: false, status: 403, json: async () => ({ error: "Model unavailable on plan" }) }; } }), /Model unavailable/);
  assert.equal(calls, 1);
  await assert.rejects(requestKreaLlm({ prompt: "Plan" }, { apiKey: "" }), /active Krea API key/);
});

test("MiniMax belongs to Video Model and legacy H3-only settings migrate", () => {
  assert.equal(normalizeModelProviderPreferences({ minimaxH3: "local" }).veo, "local");
  const preferences = normalizeModelProviderPreferences({ veo: "krea", minimaxH3: "local", llm: "krea" });
  assert.equal(preferences.minimaxH3, "krea");
  assert.equal(preferences.llm, "krea");
  assert.equal(modelProviderOptionState("MiniMax H3", "video", preferences).disabled, false);
  assert.equal(modelProviderOptionState("MiniMax H3", "video", { veo: "google" }).disabled, true);
  assert.equal(modelProviderOptionState("MiniMax H3", "video", { veo: "local" }).disabled, false);
  assert.equal(modelProviderOptionState("FLUX 3 Max", "video", preferences).disabled, false);
  assert.ok(providerSupportedModels("veo", "krea").includes("MiniMax H3"));
});

test("Ideogram Krea respects its API's five references, 2K output and aspect ratios", () => {
  const result = buildKreaImageInput({ modelName: "Ideogram 4.5", prompt: "Edit", referenceUrls: ["https://example.com/a.png"], aspectRatio: "21:9", resolution: "4K" });
  assert.equal(result.aspect_ratio, "2.4:1");
  assert.equal(result.resolution, "2K");
  assert.equal(kreaEndpointForModel("image", "Ideogram 4.5"), "/generate/image/ideogram/ideogram-4.5");
  assert.throws(() => buildKreaImageInput({ modelName: "Ideogram 4.5", referenceUrls: Array(6).fill("https://example.com/a.png") }), /five/);
});

test("Krea enhancement adapters preserve source size, HDR and model identity", () => {
  const metadata = { width: 640, height: 360 };
  const hdr = buildKreaEnhanceInput("Topaz SDR to HDR", { topazSdrToHdr: { outputFormat: "prores" } }, metadata, "https://example.com/a.mp4");
  assert.equal(hdr.video_output_preset, "prores-422-hq");
  assert.equal(hdr.frame_interpolation, false);
  assert.equal(hdr.crop_to_fit, false);
  const flux = buildKreaEnhanceInput("Flux Video Upscale", { fluxVideoUpscale: { creativity: 0 } }, metadata, "https://example.com/a.mp4");
  assert.equal(flux.creativity, "precise");
  const recovery = { topazImageUpscaler: { model: "Recovery V2", upscaleFactor: 2 } };
  assert.match(kreaEnhanceEndpoint("Topaz Image Upscale", recovery), /generative-enhance$/);
  const image = buildKreaEnhanceInput("Topaz Image Upscale", recovery, metadata, "https://example.com/a.png");
  assert.equal(image.model, "Recovery V2"); assert.equal(image.width, 1280);
  assert.equal(Object.hasOwn(image, "fix_compression"), false);
  assert.throws(() => buildKreaEnhanceInput("Topaz Video Upscale", { topazVideoUpscaler: { model: "Nyx XL" } }, metadata, "url"), /unavailable/);
  assert.match(kreaEnhanceEndpoint("Topaz Video Upscale", { topazVideoUpscaler: { model: "Starlight Precise 2.5" } }), /starlight-precise-25$/);
});

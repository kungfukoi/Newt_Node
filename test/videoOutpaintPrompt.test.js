import test from "node:test";
import assert from "node:assert/strict";
import { buildOutpaintAnalysisPrompt, normalizeOutpaintPromptMode } from "../src/videoOutpaintPrompt.js";
import { registerVideoOutpaintPromptRoute } from "../server/routes/videoOutpaintPrompt.js";

test("outpainting analysis describes masks, temporal boundaries and conservative anatomy", () => {
  const text = buildOutpaintAnalysisPrompt({ mode: "auto", guidance: "Invent a palace", aspectRatio: "9:16" });
  assert.match(text, /white pixels request generation, black pixels protect/);
  assert.match(text, /throughout their duration/);
  assert.match(text, /Never solve a gap with a stretched limb/);
  assert.match(text, /Target aspect ratio: 9:16/);
  assert.doesNotMatch(text, /Invent a palace/);
  assert.match(buildOutpaintAnalysisPrompt({ mode: "guided", guidance: "No windows" }), /No windows/);
  assert.equal(normalizeOutpaintPromptMode("unknown"), "guided");
  assert.throws(() => buildOutpaintAnalysisPrompt({ mode: "manual" }), /Manual/);
});

function harness(overrides = {}) {
  let handler, record, analysis;
  registerVideoOutpaintPromptRoute({ post(route, callback) { assert.equal(route, "/api/node/video-outpaint-prompt"); handler = callback; } }, {
    isLocalAssetUrl: url => url.startsWith("/outputs/"),
    analyze: async options => { analysis = options; return { text: "Preserve perspective and extend the carpet.", provider: "fal", model: "vision-model", endpoint: "video", usages: [{ input_tokens: 100 }] }; },
    estimateCost: () => ({ amountUsd: null, status: "unpriced" }),
    appendHistory: async item => { record = item; }, projectFromBody: body => ({ id: body.projectId }), nodeFromBody: body => ({ id: body.nodeId }), ...overrides
  });
  return { async call(body) { let status = 200, data; await handler({ body }, { status(value) { status = value; return this; }, json(value) { data = value; } }); return { status, data, record, analysis }; } };
}
const body = { sourceVideoUrl: "/outputs/source.mp4", maskVideoUrl: "/outputs/mask.mp4", mode: "guided", guidance: "No windows", aspectRatio: "9:16", projectId: "p", nodeId: "n" };

test("analysis records provider, usage, source/mask, direction and workflow without generating video", async () => {
  const result = await harness().call(body);
  assert.equal(result.status, 200);
  assert.equal(result.data.text, result.record.text);
  assert.deepEqual(result.analysis.inputs.map(item => item.url), [body.sourceVideoUrl, body.maskVideoUrl]);
  assert.equal(result.record.mediaType, "text");
  assert.equal(result.record.project.id, "p");
  assert.equal(result.record.node.id, "n");
  assert.equal(result.record.settings.guidance, "No windows");
  assert.equal(result.record.usage.request.input_tokens, 100);
  assert.equal(result.record.cost.status, "unpriced");
});

test("missing mask, remote sources and manual mode never call paid analysis", async () => {
  for (const patch of [{ maskVideoUrl: "" }, { sourceVideoUrl: "https://example.com/video.mp4" }, { mode: "manual" }]) {
    const result = await harness({ analyze: () => { assert.fail("Must not submit"); } }).call({ ...body, ...patch });
    assert.equal(result.status, 400);
    assert.equal(result.record, undefined);
  }
});

test("provider failures and empty responses leave the caller's prompt untouched", async () => {
  const failed = await harness({ analyze: async () => { throw new Error("Fal unavailable"); } }).call(body);
  assert.equal(failed.status, 500);
  assert.equal(failed.data.error, "Fal unavailable");
  const empty = await harness({ analyze: async () => ({ text: " " }) }).call(body);
  assert.equal(empty.status, 500);
  assert.match(empty.data.error, /existing prompt was preserved/);
  assert.equal(empty.record, undefined);
});

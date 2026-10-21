import test from "node:test";
import assert from "node:assert/strict";
import { createOutpaintVisualReviewer } from "../server/outpaint-visual-qc.js";

function fixture(text) {
  const calls = [], history = [];
  const review = createOutpaintVisualReviewer({ analyze: async request => { calls.push(request); return { text, provider: "fal", model: "vision", usages: [{ inputTokens: 100 }] }; }, estimateCost: () => ({ amountUsd: 0.01 }), appendHistory: async item => history.push(item), projectFromBody: () => ({ id: "p" }), nodeFromBody: () => ({ id: "n" }) });
  const request = { body: {}, prepared: { videoUrl: "/outputs/source.mp4", maskVideoUrl: "/outputs/mask.mp4", plan: { duration: 4 } }, output: { publicPath: "/outputs/final.mp4" } };
  return { review, request, calls, history };
}
test("visual QC compares source, mask and finished video; records paid usage separately", async () => {
  const f = fixture(JSON.stringify({ status: "needs_review", summary: "Scarf jumps across the join", issues: [{ start: 1, end: 2, category: "geometry", description: "Scarf edge is displaced." }] }));
  const report = await f.review(f.request);
  assert.equal(report.status, "needs_review"); assert.equal(report.issues[0].start, 1);
  assert.deepEqual(f.calls[0].inputs.map(i => i.url), ["/outputs/source.mp4", "/outputs/mask.mp4", "/outputs/final.mp4"]);
  assert.match(f.calls[0].prompt, /Do not recommend editing the original/);
  assert.equal(f.history.length, 1); assert.equal(f.history[0].cost.amountUsd, 0.01); assert.equal(f.history[0].project.id, "p");
});
test("invalid or uncertain reviews cannot pass and still record the paid call", async () => {
  for (const response of ["Not JSON", '{"status":"passed_checks","summary":"ok"}', JSON.stringify({ status: "passed_checks", summary: "ok", issues: [{ start: 3, end: 2, description: "bad times" }] })]) {
    const f = fixture(response);
    await assert.rejects(f.review(f.request), /invalid|incomplete/); assert.equal(f.history.length, 1);
  }
  const f = fixture(JSON.stringify({ status: "passed_checks", summary: "Looks fine except a seam", issues: [{ start: 0, end: 1, description: "Visible seam" }] }));
  assert.equal((await f.review(f.request)).status, "needs_review");
});

test("static local mattes are described geometrically without being uploaded as video", async () => {
  const f = fixture(JSON.stringify({ status: "passed_checks", summary: "No observed defects", issues: [] }));
  f.request.prepared.maskImageUrl = "/outputs/local-mask.png";
  await f.review(f.request);
  assert.deepEqual(f.calls[0].inputs.map(i => i.url), ["/outputs/source.mp4", "/outputs/final.mp4"]);
  assert.match(f.calls[0].prompt, /Reject unsupported new objects/);
  assert.match(f.calls[0].prompt, /foreground fence\/rail\/wall/);
  assert.equal(f.history[0].settings.videoInputCount, 2);
});

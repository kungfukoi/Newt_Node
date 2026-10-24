import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOutpaintReferenceRoles, outpaintRoleInstructions, assertOutpaintConsistencySupport } from "../src/outpaintReferences.js";
import { normalizeVideoOutpaintSettings, planVideoOutpaint, seedanceOutpaintPrompt } from "../src/videoOutpaint.js";
import { outpaintEditablePromptBudget, fitOutpaintPrompt, outpaintSubmissionByteLimit } from "../src/outpaintPromptBudget.js";
import { prepareSeedanceOutpaint } from "../server/seedance-outpaint.js";
import { buildOutpaintAnalysisPrompt } from "../src/videoOutpaintPrompt.js";
import { fitExtensionColor, extensionColorFilter } from "../server/outpaint-color.js";

test("shared environment and wardrobe roles survive normalization and match actual provider image order", async () => {
  assert.deepEqual(normalizeOutpaintReferenceRoles(null), []);
  assert.deepEqual(normalizeOutpaintReferenceRoles(["environment", "bad", "wardrobe"]), ["environment", "appearance", "wardrobe"]);
  assert.equal(normalizeOutpaintReferenceRoles(Array(40).fill("environment")).length, 30);
  assert.equal(normalizeVideoOutpaintSettings().matchExtensionColor, false, "Legacy finishing stays unchanged until explicitly enabled");
  const settings = { model: "seedance-2.5", matchExtensionColor: true, referenceRoles: ["environment", "wardrobe"] };
  const plan = planVideoOutpaint({ width: 1920, height: 1080, fps: 24, duration: 2 }, settings);
  const prepared = { plan, videoUrl: "/outputs/canvas.mp4" };
  for (const provider of ["fal", "atlas", "krea"]) {
    const result = await prepareSeedanceOutpaint({ model: "Seedance 2.5", videoOutpaint: settings, referenceVideoUrls: ["/outputs/source.mp4"], referenceImageUrls: ["/outputs/set.png", "/outputs/clothes.png"], prompt: "Continue the same floor." }, { provider, apiKey: "fixture", prepare: async () => prepared });
    assert.deepEqual(result.body.referenceImageLabels, ["Image1", "Image2"]);
    assert.deepEqual(result.body.referenceImageUrls, ["/outputs/set.png", "/outputs/clothes.png"]);
    assert.match(result.body.prompt, /@Image1 defines the shared set/);
    assert.match(result.body.prompt, /@Image2 defines clothing only/);
    assert.match(result.body.prompt, /Never freeze a reference frame/);
    assert.doesNotMatch(result.body.prompt, /APPEARANCE REFERENCE ONLY/);
    assert.ok(Buffer.byteLength(result.body.prompt) <= outpaintSubmissionByteLimit);
  }
  const analysis = buildOutpaintAnalysisPrompt({ mode: "guided", outpaintModel: "seedance-2.5", preparedPlan: plan, referenceImageCount: 2 });
  assert.match(analysis, /@Image1 defines the shared set/);
  assert.match(analysis, /@Image2 defines clothing only/);
  assert.equal(outpaintRoleInstructions(1, []), "", "Unassigned references retain the existing appearance-only contract");
});

test("all reference roles fit the provider budget and require a capable backend", () => {
  const roles = Array.from({ length: 30 }, (_, i) => ["environment", "wardrobe", "appearance"][i % 3]);
  const plan = planVideoOutpaint({ width: 1920, height: 1080, fps: 24, duration: 2 }, { model: "seedance-2.5", referenceRoles: roles });
  const budget = outpaintEditablePromptBudget(plan, plan.settings, 30);
  const submitted = seedanceOutpaintPrompt(fitOutpaintPrompt("Continue the floor. ".repeat(300), budget), false, [], 32, plan, 30);
  assert.ok(Buffer.byteLength(submitted) <= outpaintSubmissionByteLimit, `Bytes: ${Buffer.byteLength(submitted)}`);
  assert.match(submitted, /@Image30/);
  assert.throws(() => assertOutpaintConsistencySupport({ videoOutpaint: plan.settings }, { routes: {} }), /Restart the backend/);
  assert.doesNotThrow(() => assertOutpaintConsistencySupport({ videoOutpaint: plan.settings }, { routes: { videoOutpaintConsistency: true } }));
  assert.doesNotThrow(() => assertOutpaintConsistencySupport({}, { routes: {} }));
});

test("drafting describes complete regions and fitting preserves them ahead of generic prose", () => {
  const prompt = buildOutpaintAnalysisPrompt({ mode: "guided", outpaintModel: "seedance-2.5" });
  assert.match(prompt, /Begin exactly with "Full frame "/);
  assert.match(prompt, /completed scene visible in the FIRST frame/);
  assert.match(prompt, /only observed source actions and camera motion/);
  const fitted = fitOutpaintPrompt("Decorative description. Rich textures and wonderful surfaces. TOP: pale sky. BOTTOM: continuous gray floor.", 65);
  assert.match(fitted, /TOP: pale sky/);
  assert.match(fitted, /BOTTOM: continuous gray floor/);
  assert.doesNotMatch(fitted, /Decorative description/);
});

test("paired overlap color offsets are bounded and stable despite moving texture and outliers", () => {
  const geometry = { width: 32, height: 48, x: 0, y: 8, sw: 32, sh: 32, overlap: 4 };
  const reference = Buffer.alloc(32 * 48 * 3 * 4), generated = Buffer.alloc(reference.length);
  for (let i = 0; i < reference.length; i++) {
    reference[i] = 80 + i % 91;
    generated[i] = reference[i] - [6, -3, 9][i % 3];
    if (Math.floor(i / 3) % 17 === 0) generated[i] = 220;
  }
  const report = fitExtensionColor(reference, generated, geometry);
  assert.equal(report.applied, true);
  assert.deepEqual(report.edges.bottom.offsets, [6, -3, 9]);
  assert.equal(report.framesSampled, 4);
  assert.match(extensionColorFilter(report, { w: 32, h: 48, sw: 32, sh: 32, x: 0, y: 8 }), /geq=/);
  generated.fill(255);
  assert.equal(fitExtensionColor(reference, generated, geometry).applied, false);
  for (let i = 0; i < reference.length; i++) generated[i] = Math.max(8, reference[i] - 25);
  assert.equal(fitExtensionColor(reference, generated, geometry).applied, false, "Large mismatches must not recolor the extension");
  assert.equal(extensionColorFilter({ applied: false }, {}), "null");
});

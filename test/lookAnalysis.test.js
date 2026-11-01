import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { createLookAnalyzer, lookAnalysisInstructions } from "../server/look-analysis.js";
import { createStyleLibraryStore } from "../server/style-library.js";
import { libraryStyleSnapshot } from "../src/styleLibrary.js";

const stylePrompt = "Preserve the requested subject and composition. Apply fine, irregular ink contours with broken edges, transparent overlapping washes, muted warm paper tones and restrained crimson accents. Keep shadows soft and textured, with spare highlights and visible paper grain.";
test("Create Look requests short visual-only descriptions and catalog tags, caches separately, rejects over six images", async t => {
  const f = await fixture(t);
  const describe = createLookAnalyzer({ ...f.dependencies, analyze: async options => {
    f.calls.push(options); return { text: JSON.stringify(options.route === "look-create-analysis" ? { stylePrompt, tags: ["Techniques", "unsupported"],visualStyle:{medium:"Fine ink with transparent washes",palette:"Warm paper and restrained crimson",lighting:"Soft shadows",texture:"Visible paper grain",shape:"Broken edges",depth:"Spare depth cues",mood:"Quiet and tactile"},palette:[{name:"warm paper",hex:"#e8ddc0"}] } : { stylePrompt }), model: "gpt-6-astra", provider: "Atlas Cloud", endpoint: "/v1/chat/completions" };
  } });
  const body = { ...f.body, purpose: "create-look", categories: ["Techniques"] };
  const saved = await describe(body); assert.deepEqual(saved.tags, ["Techniques"]);
  assert.equal(saved.styleBlocks.length,7);assert.equal(saved.palette[0].hex,"#e8ddc0");assert.equal(saved.version,2);
  assert.match(f.calls[0].systemPrompt, /60–100 words/); assert.match(f.calls[0].systemPrompt, /Never carry over people/);
  assert.equal(f.calls[0].route, "look-create-analysis"); assert.equal(f.history[0].mode, "Create look analysis");
  assert.equal((await describe(body)).cached, true); assert.equal(f.calls.length, 1);
  assert.equal((await describe(f.body)).cached, false); assert.equal(f.calls.length, 2);
  await assert.rejects(describe({ ...body, examples: Array(7).fill("/uploads/a.png") }), /six images/);
  assert.equal(f.calls.length, 2);
});
async function fixture(t, override = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-look-analysis-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const image = await sharp({ create: { width: 21, height: 39, channels: 3, background: "red" } }).png().toBuffer();
  const calls = [], history = [];
  const dependencies = { directory, readAsset: async () => ({ buffer: image }),
    analyze: async options => { calls.push(options); return { text: JSON.stringify({ stylePrompt }), model: "gpt-6-astra", provider: "OpenAI", endpoint: "gpt-6-astra", usages: [{ input_tokens: 10, output_tokens: 20 }] }; },
    recordHistory: async item => history.push(item), estimateCost: options => ({ pricingStatus: "unpriced", model: options.model }), ...override };
  return { directory, dependencies, describe: createLookAnalyzer(dependencies), calls, history, body: { name: "Ink", observations: "An ink portrait of a woman", examples: ["/uploads/a.png", "/uploads/b.png"] } };
}
test("Astra receives every whole image, evidence boundaries and style-only instructions; disk cache survives restarts", async t => {
  const f = await fixture(t);
  const first = await f.describe(f.body);
  assert.equal(first.cached, false); assert.equal(first.stylePrompt, stylePrompt);
  assert.equal(f.calls[0].openAiModel, "gpt-6-astra"); assert.equal(f.calls[0].falModel, "openai/gpt-6-astra");
  assert.equal(f.calls[0].reasoningEffort, "high"); assert.equal(f.calls[0].inputs.length, 2);
  assert.equal((await sharp(f.calls[0].inputs[0].asset.buffer).metadata()).height, 39);
  assert.match(f.calls[0].prompt, /ink portrait/);
  assert.match(lookAnalysisInstructions, /untrusted evidence/); assert.match(lookAnalysisInstructions, /Never carry over people/);
  assert.equal(f.history.length, 1); assert.equal(f.history[0].modelName, "gpt-6-astra");
  assert.equal(f.history[0].cost.model, "gpt-6-astra");
  const reloaded = createLookAnalyzer({ ...f.dependencies, analyze: () => { throw new Error("must not bill again"); } });
  assert.equal((await reloaded(f.body)).cached, true);
  assert.equal((await reloaded({ ...f.body, examples: [...f.body.examples].reverse() })).cached, true);
  assert.equal(f.calls.length, 1);
});
test("Concurrent identical evidence coalesces, changed evidence creates a new description", async t => {
  const f = await fixture(t);
  await Promise.all([f.describe(f.body), f.describe(f.body)]);
  assert.equal(f.calls.length, 1);
  await f.describe({ ...f.body, observations: "Different source observations" });
  assert.equal(f.calls.length, 2);
});
test("Invalid input cannot reach a paid analysis, malformed responses record failure without a prose fallback", async t => {
  const f = await fixture(t);
  for (const examples of [[], ["https://example.com/a.png"], ["/uploads/../secret"], ["/uploads/a.png?secret"]]) await assert.rejects(f.describe({ ...f.body, examples }));
  assert.equal(f.calls.length, 0);
  const broken = createLookAnalyzer({ ...f.dependencies, analyze: async () => ({ text: '{"subject":"a woman"}', provider: "OpenAI", model: "gpt-6-astra" }) });
  await assert.rejects(broken(f.body), /incomplete planning data/);
  assert.equal(f.history.length, 1); assert.ok(f.history[0].error); assert.equal(f.history[0].text, "");
});
test("Saved description and provenance survive collection persistence; legacy workflow prompts still work", async t => {
  const f = await fixture(t), styleAnalysis = await f.describe(f.body);
  const store = createStyleLibraryStore({ directory: f.directory });
  await store.save({ revision: 0, collections: [{ id: "looks", name: "Looks", styles: [{ id: "ink", name: "Ink", prompt: f.body.observations, styleAnalysis, examples: [{ localUrl: "/uploads/a.png" }] }] }] });
  const saved = (await store.read()).collections[0].styles[0];
  assert.equal(saved.prompt, f.body.observations); assert.equal(saved.styleAnalysis.fingerprint, styleAnalysis.fingerprint);
  assert.equal(libraryStyleSnapshot(saved).prompt, stylePrompt);
  assert.equal(libraryStyleSnapshot({ prompt: "Legacy ink --sref 123" }).prompt, "Legacy ink");
});

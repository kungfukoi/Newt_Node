import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCharacterWardrobeRequest } from "../server/character-wardrobe.js";
import { nodeApi } from "../src/api/newtApi.js";
import { runCharacterWardrobeEdit } from "../src/nodeRunners/mediaModels.js";
import { generateCharacterWardrobeVariant } from "../src/characterWardrobeGeneration.js";

const legacyRequest = (model, cu = false) => ({
  model, nodeId: "character-1", nodeTitle: `Character 1${cu ? " CU Video" : ""} Wardrobe Edit`,
  prompt: "Keep the saved base and apply the outfit.",
  imagePromptUrls: ["/outputs/base.png", "/uploads/outfit.png"],
  imagePromptLabels: [`Locked Base Identity ${cu ? "CU Video" : "Character"} Sheet`, "Selected wardrobe reference; clothing only"],
  editMaskDataUrl: "data:image/png;base64,obsolete-rectangles", resolution: "4K", quality: "high"
});

for (const model of ["OpenAI Image 2", "OpenAI Image 2.5"]) {
  for (const cu of [false, true]) {
    test(`${model} ${cu ? "CU" : "regular"} legacy wardrobe request loses only its obsolete mask`, () => {
      const original = legacyRequest(model, cu);
      const { editMaskDataUrl, ...expected } = original;
      assert.deepEqual(normalizeCharacterWardrobeRequest(original), { ...expected, characterWardrobeEdit: true });
      assert.ok(original.editMaskDataUrl);
    });
  }
  test(`${model} wardrobe runner ignores obsolete caller masks and preserves notes and metadata`, async (t) => {
    const generate = t.mock.method(nodeApi, "generateImage", async () => ({ response: { ok: true }, data: { image: { localUrl: "/outputs/dressed.png", fileName: "dressed.png" } } }));
    await runCharacterWardrobeEdit({
      node: { id: "character-1", data: { title: "Character", characterSheetModel: model, characterReferenceNotes: "Keep the scar" } },
      prompt: "Change clothing only", baseSheet: { localUrl: "/outputs/base.png" }, wardrobe: { localUrl: "/uploads/outfit.png" },
      editMaskDataUrl: "data:image/png;base64,obsolete", workflowContext: { projectId: "project" }, characterTag: "Hero"
    });
    const request = generate.mock.calls[0].arguments[0];
    assert.equal(request.editMaskDataUrl, undefined);
    assert.equal(request.characterWardrobeEdit, true);
    assert.match(request.prompt, /Keep the scar/);
    assert.equal(request.projectId, "project");
    assert.deepEqual(request.imagePromptUrls, ["/outputs/base.png", "/uploads/outfit.png"]);
  });
}

test("ordinary image edits keep their intentional masks", () => {
  for (const overrides of [{ nodeId: "imageModel-1" }, { nodeTitle: "Character 1" }, { imagePromptLabels: ["Original image", "Drawing guide"] }]) {
    const request = { ...legacyRequest("OpenAI Image 2.5"), ...overrides };
    assert.strictEqual(normalizeCharacterWardrobeRequest(request), request);
  }
});

test("explicit wardrobe mode protects renamed/imported Character nodes", () => {
  const request = { ...legacyRequest("OpenAI Image 2.5"), nodeId: "imported", nodeTitle: "Renamed", characterWardrobeEdit: true };
  const normalized = normalizeCharacterWardrobeRequest(request);
  assert.equal(normalized.editMaskDataUrl, undefined);
  assert.deepEqual(normalizeCharacterWardrobeRequest(normalized), normalized);
});

test("regular and CU variants generate whole sheets without creating canvas masks", async (t) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { createElement: () => assert.fail("Wardrobe generation must not create rectangle masks") } });
  t.after(() => originalDocument ? Object.defineProperty(globalThis, "document", originalDocument) : delete globalThis.document);
  const generate = t.mock.method(nodeApi, "generateImage", async () => ({ response: { ok: true }, data: { image: { localUrl: "/outputs/dressed.png" } } }));
  const result = await generateCharacterWardrobeVariant({ id: "character-1", data: { cuVideoGeneration: true } }, { id: "outfit", url: "/uploads/outfit.png" }, {
    baseSheet: { url: "/outputs/base.png" }, baseVideoSheet: { url: "/outputs/cu.png" }, baseSignature: "base", baseVideoSignature: "cu", characterTag: "Hero"
  });
  assert.equal(generate.mock.callCount(), 2);
  for (const call of generate.mock.calls) {
    assert.equal(call.arguments[0].characterWardrobeEdit, true);
    assert.equal(call.arguments[0].editMaskDataUrl, undefined);
  }
  assert.equal(result.videoError, "");
  assert.ok(result.variant.generated);
  assert.ok(result.variant.videoGenerated);
});

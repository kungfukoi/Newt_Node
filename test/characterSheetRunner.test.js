import assert from "node:assert/strict";
import test from "node:test";
import { nodeApi } from "../src/api/newtApi.js";
import { imageModelNames } from "../src/modelOptions.js";
import { runCharacterSheetGeneration } from "../src/nodeRunners/mediaModels.js";

const responseData = {
  image: {
    localUrl: "/outputs/sheet.png",
    fileName: "sheet.png",
    thumbnailUrl: "/outputs/sheet-thumb.jpg",
    mimeType: "image/png"
  },
  cost: { amountUsd: 0.2 }
};

function captureGeneration(t) {
  const requests = [];
  t.mock.method(nodeApi, "generateImage", async (request) => {
    requests.push(request);
    return { response: { ok: true }, data: responseData };
  });
  return requests;
}

function generationOptions(data = {}) {
  return {
    node: { id: "character-1", type: "character", data: { title: "Alex", ...data } },
    prompt: "Required sheet layout.\n\nWardrobe rule.\n\nDefining physical details.",
    portrait: { localUrl: "/uploads/portrait.png" },
    wardrobe: { localUrl: "/uploads/wardrobe.png" },
    workflowContext: { projectId: "project-1", workflowPackageId: "package-1" },
    characterTag: "Alex"
  };
}

for (const model of [imageModelNames.openAiImage2, imageModelNames.nanoBananaPro, imageModelNames.seedream5Pro]) {
  for (const sheetKind of ["image", "video"]) {
    test(`Character Notes reach the ${model} ${sheetKind} sheet request`, async (t) => {
      const requests = captureGeneration(t);
      const options = generationOptions({
        characterSheetModel: model,
        characterReferenceNotes: "  Keep the freckles.\nUse scuffed boots.  "
      });
      const before = structuredClone(options);
      const result = await runCharacterSheetGeneration({ ...options, sheetKind });

      assert.equal(requests.length, 1);
      const request = requests[0];
      assert.ok(request.prompt.startsWith(options.prompt + "\n\n"));
      assert.ok(request.prompt.endsWith("Keep the freckles.\nUse scuffed boots."));
      assert.equal(request.prompt.split("Character reference notes").length, 2);
      assert.equal(request.model, model);
      assert.equal(request.resolution, model === imageModelNames.seedream5Pro ? "2K" : "4K");
      assert.equal(request.quality, model === imageModelNames.openAiImage2 ? "high" : undefined);
      assert.equal(request.aspectRatio, "16:9");
      assert.deepEqual(request.imagePromptUrls, [options.portrait.localUrl, options.wardrobe.localUrl]);
      assert.deepEqual(request.imagePromptLabels, ["The Character portrait reference", "Selected wardrobe sheet"]);
      assert.equal(request.workflowPackageId, "package-1");
      assert.equal(request.nodeId, options.node.id);
      assert.equal(request.nodeTitle, `Alex${sheetKind === "video" ? " CU Video" : ""} Character Sheet`);
      assert.equal(result.url, responseData.image.localUrl);
      assert.deepEqual(result.cost, responseData.cost);
      assert.deepEqual(options, before);
    });
  }
}

test("missing, blank, and invalid Character Notes preserve the original request prompt", async (t) => {
  const requests = captureGeneration(t);
  for (const notes of [undefined, null, "", " \n\t ", { invalid: true }]) {
    const options = generationOptions({ characterReferenceNotes: notes });
    await runCharacterSheetGeneration(options);
    assert.equal(requests.at(-1).prompt, options.prompt);
  }
});

test("notes apply independently to every wardrobe without accumulating in the prompt", async (t) => {
  const requests = captureGeneration(t);
  const options = generationOptions({ characterReferenceNotes: "Keep the freckles." });
  for (const wardrobe of [null, { localUrl: "/uploads/coat.png" }, { localUrl: "/uploads/suit.png" }]) {
    await runCharacterSheetGeneration({ ...options, wardrobe });
  }
  assert.equal(new Set(requests.map((request) => request.prompt)).size, 1);
  assert.deepEqual(requests.map((request) => request.imagePromptUrls.length), [1, 2, 2]);
});

test("Storyboard character preparation does not inherit Character Notes", async (t) => {
  const requests = captureGeneration(t);
  const options = generationOptions({ characterReferenceNotes: "Character-only notes" });
  options.node.type = "storyboard";
  await runCharacterSheetGeneration(options);
  assert.equal(requests[0].prompt, options.prompt);
});

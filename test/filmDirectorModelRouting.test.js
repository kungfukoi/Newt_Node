import assert from "node:assert/strict";
import test from "node:test";

import {
  applyFilmDirectorImageOverrides,
  composeFilmDirectorPrompt,
  explicitFilmDirectorImageIncoming,
  filmDirectorInputPortForNodeType,
  filmDirectorReferenceIsActive,
  isFilmDirectorConnection,
  mergeFilmDirectorVisualIncoming
} from "../src/filmDirectorModelRouting.js";
import { buildImageGenerationRequest } from "../src/nodeRunners/mediaModels.js";
import { composeVideoPrompt } from "../src/nodeRunners/videoModels.js";

function connection(sourceId, fromPort, toPort, url = "") {
  return {
    source: { id: sourceId, data: { resultUrl: url } },
    edge: {
      from: { nodeId: sourceId, port: fromPort },
      to: { nodeId: "model", port: toPort }
    }
  };
}

test("Director output connects to Image, Video, and Storyboard Director inputs", () => {
  assert.equal(filmDirectorInputPortForNodeType("imageModel"), "directorIn");
  assert.equal(filmDirectorInputPortForNodeType("videoModel"), "directorIn");
  assert.equal(filmDirectorInputPortForNodeType("storyboard"), "directorIn");
  assert.equal(isFilmDirectorConnection({
    sourceType: "skillDirector",
    sourcePort: "directorOut",
    targetType: "imageModel",
    targetPort: "directorIn"
  }), true);
  assert.equal(isFilmDirectorConnection({
    sourceType: "skillDirector",
    sourcePort: "directorOut",
    targetType: "imageModel",
    targetPort: "promptIn"
  }), false);
});

test("Image and Video share Director prompt propagation semantics", () => {
  const input = {
    directorPrompt: "Director still-image package",
    connectedPrompt: "Use a tighter crop.",
    fallbackPrompt: "unused"
  };
  const expected = "Director still-image package\n\nAdditional direction:\nUse a tighter crop.";
  assert.equal(composeFilmDirectorPrompt(input), expected);
  assert.equal(composeVideoPrompt(input), expected);
});

test("Director visual assets merge into Image Model references without duplicates", () => {
  const direct = connection("direct", "imageOut", "imagePromptIn", "/direct.png");
  const location = connection("location", "imageOut", "locationIn", "/location.png");
  const character = connection("character", "characterOut", "characterIn", "/character.png");
  const incoming = mergeFilmDirectorVisualIncoming(
    { imagePromptIn: [direct], characterIn: [] },
    [{ imageItems: [location, location], characterItems: [character] }],
    { imagePort: "imagePromptIn", characterPort: "characterIn" }
  );

  assert.deepEqual(incoming.imagePromptIn.map((item) => item.source.id), ["direct", "location"]);
  assert.deepEqual(incoming.characterIn.map((item) => item.source.id), ["character"]);
});

test("Director prompt tags do not add images beyond Reference Setup inputs", () => {
  const setupImages = Array.from({ length: 8 }, (_, index) => connection(`setup-${index}`, "imageOut", "imageIn", `/setup-${index}.png`));
  const setupCharacter = connection("setup-character", "characterOut", "characterIn", "/character.png");
  const separateTaggedImage = connection("tagged-witch-image", "imageOut", "imagePromptIn", "/witch-image.png");
  const taggedSources = [separateTaggedImage, ...setupImages.slice(1)];
  const tagCopies = taggedSources.map((item) => ({
    source: item.source,
    edge: {
      from: item.edge.from,
      to: { nodeId: "node-reference", port: "nodeReferenceIn" },
      nodeReferenceLabel: `@Setup${item.source.id}`
    }
  }));
  const directMoodBoard = connection("mood-board", "transferOut", "transferIn", "/mood-board.png");
  const incoming = explicitFilmDirectorImageIncoming({
    imagePromptIn: tagCopies,
    characterIn: [],
    transferIn: [directMoodBoard]
  });
  const merged = mergeFilmDirectorVisualIncoming(
    incoming,
    [{ imageItems: setupImages, characterItems: [setupCharacter] }],
    { imagePort: "imagePromptIn", characterPort: "characterIn" }
  );

  assert.equal(tagCopies.length + setupImages.length + 1, 17);
  assert.equal(merged.imagePromptIn.length + merged.characterIn.length, 9);
  assert.deepEqual(merged.imagePromptIn.map((item) => item.source.id), setupImages.map((item) => item.source.id));
  assert.deepEqual(merged.transferIn, [directMoodBoard]);
});

test("Video references reuse original outputs across direct, tag, and Director paths", () => {
  const original = connection("guy1", "characterOut", "characterIn", "/guy1.png");
  const tagged = { ...original, edge: { ...original.edge, to: { nodeId: "node-reference", port: "nodeReferenceIn" } } };
  const location = connection("room", "imageOut", "referenceImageIn", "/room.png");
  const directorLocation = { ...location, edge: { ...location.edge, to: { nodeId: "director", port: "locationIn" } } };
  const otherCharacter = connection("guy2", "characterOut", "characterIn", "/guy2.png");
  const merged = mergeFilmDirectorVisualIncoming(
    { characterIn: [original, tagged], referenceImageIn: [location] },
    [{ characterItems: [original, tagged, otherCharacter], imageItems: [directorLocation] }]
  );
  assert.deepEqual(merged.characterIn, [original, otherCharacter]);
  assert.deepEqual(merged.referenceImageIn, [location]);
  assert.equal(merged.characterIn[0].source, original.source);
  assert.deepEqual(mergeFilmDirectorVisualIncoming(merged, [{ characterItems: [tagged] }]), merged);
});

test("Director merge preserves distinct original outputs and disabled Character inputs", () => {
  const image = connection("source", "imageOut", "referenceImageIn", "/image.png");
  const frame = connection("source", "frameOut", "imageIn", "/frame.png");
  const character = connection("guy1", "characterOut", "characterIn", "/guy1.png");
  const merged = mergeFilmDirectorVisualIncoming(
    { referenceImageIn: [image], characterIn: [] },
    [{ imageItems: [frame], characterItems: [character] }],
    { includeCharacters: false }
  );
  assert.deepEqual(merged.referenceImageIn, [image, frame]);
  assert.deepEqual(merged.characterIn, []);
});

test("Director forwarding honors saved active tags when final prose omits the last tag", () => {
  const directorData = {
    resultText: "Frame @Lead inside the control room.",
    lastRunReferenceTags: ["@Lead", "@ControlRoom", "@HeroProp"]
  };

  assert.equal(filmDirectorReferenceIsActive(directorData, {
    tag: "@HeroProp",
    label: "Hero Prop",
    type: "element",
    categoryCount: 2
  }), true);
});

test("connected Style and Camera inputs explicitly override conflicting Director direction", () => {
  const prompt = applyFilmDirectorImageOverrides({
    prompt: "Director: warm painterly wide shot with a 24mm lens.",
    styleInstructions: ["Cool monochrome documentary realism."],
    cameraInstructions: ["Tight portrait on an 85mm lens."]
  });

  assert.match(prompt, /Style node is authoritative/);
  assert.match(prompt, /Camera node is authoritative/);
  assert.ok(prompt.indexOf("CONNECTED STYLE OVERRIDE") < prompt.indexOf("CONNECTED CAMERA OVERRIDE"));
  assert.ok(prompt.endsWith("Tight portrait on an 85mm lens."));
});

test("Image generation request preserves propagated Director prompt and assets", () => {
  const request = buildImageGenerationRequest({
    node: {
      id: "image-model",
      data: {
        title: "Image Model",
        model: "OpenAI Image 2.5",
        aspectRatio: "16:9",
        resolution: "2K",
        quality: "high"
      }
    },
    prompt: "Director still-image package",
    imagePromptItems: [
      { url: "/location.png", label: "@Studio" },
      { url: "/character.png", label: "@Lead" }
    ],
    workflowContext: {},
    index: 0
  });

  assert.equal(request.prompt, "Director still-image package");
  assert.deepEqual(request.imagePromptUrls, ["/location.png", "/character.png"]);
  assert.deepEqual(request.imagePromptLabels, ["@Studio", "@Lead"]);
});

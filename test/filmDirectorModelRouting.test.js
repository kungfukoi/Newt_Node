import assert from "node:assert/strict";
import test from "node:test";

import {
  composeFilmDirectorPrompt,
  filmDirectorInputPortForNodeType,
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

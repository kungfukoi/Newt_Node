import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMinimaxH3Input,
  buildMinimaxH3ReferencePrompt,
  estimateMinimaxH3Cost,
  isMinimaxH3Model,
  minimaxH3DurationOptions,
  minimaxH3Endpoint,
  minimaxH3ExactAudioSource,
  minimaxH3ReferenceAspectRatioOptions,
  minimaxH3ReferenceLimits,
  minimaxH3LocalResolutionOptions,
  minimaxH3ResolutionOptions,
  minimaxH3ResolutionOptionsForProvider,
  minimaxH3Route,
  minimaxH3TextAspectRatioOptions,
  normalizeMinimaxH3Resolution,
  validateMinimaxH3References
} from "../src/minimaxH3.js";
import { videoModelNames, videoModelOptions } from "../src/modelOptions.js";
import { buildVideoGenerationRequest, videoModelSupportsFilmDirector } from "../src/nodeRunners/videoModels.js";

test("MiniMax H3 is a contextual Video Model catalog option", () => {
  assert.equal(videoModelNames.minimaxH3, "MiniMax H3");
  assert.ok(videoModelOptions.includes("MiniMax H3"));
  assert.equal(isMinimaxH3Model("MiniMax H3"), true);
  assert.equal(videoModelSupportsFilmDirector("MiniMax H3"), true);
});

test("MiniMax H3 controls match the published Fal schemas", () => {
  assert.equal(minimaxH3DurationOptions[0], "5 seconds");
  assert.equal(minimaxH3DurationOptions.at(-1), "15 seconds");
  assert.deepEqual(minimaxH3ResolutionOptions, ["768P", "2K"]);
  assert.deepEqual(minimaxH3LocalResolutionOptions, ["576P"]);
  assert.deepEqual(minimaxH3ResolutionOptionsForProvider("fal"), ["768P", "2K"]);
  assert.deepEqual(minimaxH3ResolutionOptionsForProvider("local"), ["576P"]);
  assert.equal(normalizeMinimaxH3Resolution("4K", "fal"), "2K");
  assert.equal(normalizeMinimaxH3Resolution("768P", "local"), "576P");
  assert.equal(normalizeMinimaxH3Resolution("2K", "local"), "576P");
  assert.deepEqual(minimaxH3TextAspectRatioOptions, ["21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
  assert.deepEqual(minimaxH3ReferenceAspectRatioOptions, ["adaptive", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"]);
  assert.deepEqual(minimaxH3ReferenceLimits, {
    images: 9,
    videos: 3,
    audios: 3,
    total: 12,
    minimumMediaSeconds: 2,
    maximumMediaSeconds: 15,
    videoSeconds: 15,
    audioSeconds: 15,
    freeImages: 5,
    additionalImageCost: 0.08
  });
});

test("MiniMax H3 selects text, image, and reference routes contextually", () => {
  assert.equal(minimaxH3Route(), "text-to-video");
  assert.equal(minimaxH3Route({ referenceVideoCount: 1 }), "reference-to-video");
  assert.equal(minimaxH3Route({ hasStartFrame: true, referenceImageCount: 2 }), "image-to-video");
  assert.equal(minimaxH3Endpoint("text-to-video"), "minimax/h3/text-to-video");
  assert.equal(minimaxH3Endpoint("image-to-video"), "minimax/h3/image-to-video");
  assert.equal(minimaxH3Endpoint("reference-to-video"), "minimax/h3/reference-to-video");
});

test("MiniMax H3 uses one connected reference audio file as the exact output soundtrack", () => {
  assert.equal(minimaxH3ExactAudioSource(["/uploads/bob.wav"], "reference-to-video"), "/uploads/bob.wav");
  assert.equal(minimaxH3ExactAudioSource(["/uploads/a.wav", "/uploads/b.wav"], "reference-to-video"), "");
  assert.equal(minimaxH3ExactAudioSource(["/uploads/bob.wav"], "image-to-video"), "");
});

test("MiniMax H3 builds the route-specific Fal input shape", () => {
  assert.deepEqual(buildMinimaxH3Input({
    route: "text-to-video",
    prompt: "A camera move",
    duration: "8 seconds",
    resolution: "768p",
    aspectRatio: "9:16",
    seed: "42",
    enablePromptExpansion: false
  }), {
    prompt: "A camera move",
    duration: 8,
    resolution: "768P",
    enable_prompt_expansion: false,
    enable_safety_checker: true,
    seed: 42,
    aspect_ratio: "9:16"
  });

  const imageInput = buildMinimaxH3Input({
    route: "image-to-video",
    prompt: "Animate it",
    imageUrl: "https://example.com/start.png",
    endImageUrl: "https://example.com/end.png"
  });
  assert.equal(imageInput.image_url, "https://example.com/start.png");
  assert.equal(imageInput.end_image_url, "https://example.com/end.png");
  assert.equal("aspect_ratio" in imageInput, false);

  const referenceInput = buildMinimaxH3Input({
    route: "reference-to-video",
    prompt: "Use Image 1 and Video 1",
    aspectRatio: "adaptive",
    referenceImageUrls: ["https://example.com/ref.png"],
    referenceVideoUrls: ["https://example.com/ref.mp4"],
    referenceAudioUrls: ["https://example.com/ref.wav"]
  });
  assert.deepEqual(referenceInput.reference_image_urls, ["https://example.com/ref.png"]);
  assert.deepEqual(referenceInput.reference_video_urls, ["https://example.com/ref.mp4"]);
  assert.deepEqual(referenceInput.reference_audio_urls, ["https://example.com/ref.wav"]);
  assert.match(referenceInput.prompt, /Use Audio 1 as an audio\/voice reference/);
  assert.equal(referenceInput.aspect_ratio, "adaptive");
});

test("MiniMax H3 binds named, positional, and otherwise uncited Fal references", () => {
  assert.equal(buildMinimaxH3ReferencePrompt("Keep @Bob consistent and use @Audio1 for dialogue.", {
    imageNames: ["Bob"],
    audioNames: ["BobVoice"],
    syntax: "fal",
    ensureAllReferences: true
  }), "Keep Image 1 consistent and use Audio 1 for dialogue.");

  assert.equal(buildMinimaxH3ReferencePrompt("Use @Image, @Video, and @Audio.", {
    imageNames: ["Bob"],
    videoNames: ["CameraMove"],
    audioNames: ["BobVoice"],
    syntax: "fal",
    ensureAllReferences: true
  }), "Use Image 1, Video 1, and Audio 1.");

  assert.equal(buildMinimaxH3ReferencePrompt("A slow push in.", {
    imageNames: ["Bob"],
    videoNames: ["CameraMove"],
    audioNames: ["BobVoice"],
    syntax: "fal",
    ensureAllReferences: true
  }), [
    "A slow push in.",
    "Reference bindings: Use Image 1 (Bob) as a visual identity/style reference. Use Video 1 (CameraMove) as a motion/camera reference. Use Audio 1 (BobVoice) as an audio/voice reference."
  ].join("\n\n"));

  assert.equal(buildMinimaxH3ReferencePrompt("Use @Bob and @Audio1.", {
    imageNames: ["Bob"],
    audioNames: ["BobVoice"],
    syntax: "sglang",
    ensureAllReferences: false
  }), "Use <Picture 1> and <Audio 1>.");
});

test("MiniMax H3 rejects invalid reference combinations before submission", () => {
  assert.match(validateMinimaxH3References({ imageCount: 10 }), /up to 9 reference images/);
  assert.match(validateMinimaxH3References({ audioCount: 1 }), /requires at least one reference image or video/);
  assert.match(validateMinimaxH3References({ imageCount: 1, videoCount: 1, videoDurations: [16] }), /2-15 seconds/);
  assert.match(validateMinimaxH3References({ imageCount: 1, videoCount: 2, videoDurations: [8, 8] }), /15 seconds total/);
  assert.equal(validateMinimaxH3References({ imageCount: 2, videoCount: 1, audioCount: 1, videoDurations: [8], audioDurations: [5] }), "");
});

test("MiniMax H3 billing uses output seconds and paid reference images", () => {
  assert.equal(estimateMinimaxH3Cost({ duration: 10, resolution: "768P", referenceImageCount: 5 }).amountUsd, 0.6);
  assert.equal(estimateMinimaxH3Cost({ duration: 10, resolution: "2K", referenceImageCount: 7 }).amountUsd, 1.46);
});

test("Video runner forwards MiniMax H3 provider settings and audio labels", () => {
  const request = buildVideoGenerationRequest({
    node: {
      id: "h3-video",
      data: {
        title: "H3",
        model: "MiniMax H3",
        minimaxH3EnablePromptExpansion: false
      }
    },
    prompt: "Use @voice",
    referenceAudioUrls: ["/uploads/voice.wav"],
    referenceAudioLabels: ["voice"]
  });
  assert.deepEqual(request.minimaxH3, { enablePromptExpansion: false });
  assert.deepEqual(request.referenceAudioLabels, ["voice"]);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGeminiOmniEditPrompt,
  buildGeminiOmniFalInput,
  buildGeminiOmniGoogleInput,
  buildGeminiOmniGoogleRequestBody,
  buildGeminiOmniPrompt,
  normalizeGeminiOmniGoogleText,
  normalizeGeminiOmniAspectRatio,
  normalizeGeminiOmniDuration,
  uniqueGeminiOmniReferences
} from "../src/geminiOmni.js";

test("Gemini Omni prompt maps named assets to ordered reference tags", () => {
  const prompt = buildGeminiOmniPrompt({
    prompt: "@Kim enters @Kitchen.",
    hasStartFrame: true,
    references: [
      { label: "Kim" },
      { label: "Kitchen" }
    ],
    generateAudio: false
  });

  assert.match(prompt, /\[# Sources <FIRST_FRAME>@Image1\]/);
  assert.match(prompt, /<IMAGE_REF_0>@Image2/);
  assert.match(prompt, /<IMAGE_REF_1>@Image3/);
  assert.match(prompt, /<IMAGE_REF_0> enters <IMAGE_REF_1>/);
  assert.match(prompt, /Output silent video/);
});

test("Gemini Omni prompt maps video references separately from image references", () => {
  const prompt = buildGeminiOmniPrompt({
    prompt: "Transform @SourceClip using @Poster.",
    references: [
      { label: "SourceClip", type: "video" },
      { label: "Poster", type: "image" }
    ],
    generateAudio: true
  });

  assert.match(prompt, /<VIDEO_REF_0>@Video1/);
  assert.match(prompt, /<IMAGE_REF_0>@Image1/);
  assert.match(prompt, /Transform <VIDEO_REF_0> using <IMAGE_REF_0>/);
  assert.match(prompt, /video references as editable motion and appearance sources/);
});

test("Gemini Omni limits preview controls and de-duplicates references", () => {
  assert.equal(normalizeGeminiOmniDuration("1 second"), 3);
  assert.equal(normalizeGeminiOmniDuration("15 seconds"), 10);
  assert.equal(normalizeGeminiOmniAspectRatio("9:16 (Portrait)"), "9:16");
  assert.deepEqual(uniqueGeminiOmniReferences([{ url: "a" }, { url: "a" }, { url: "b" }]), [{ url: "a" }, { url: "b" }]);
});

test("Gemini Omni Fal input routes reference videos to the edit payload", () => {
  assert.deepEqual(
    buildGeminiOmniFalInput({
      prompt: "Edit this clip",
      aspectRatio: "9:16",
      durationSeconds: 6,
      media: [
        { url: "https://cdn.example/start.png", type: "image" },
        { url: "https://cdn.example/source.mp4", type: "video" },
        { url: "https://cdn.example/source.mp4", type: "video" }
      ]
    }),
    {
      prompt: "Edit this clip",
      video_url: "https://cdn.example/source.mp4"
    }
  );
});

test("Gemini Omni Google input sends uploaded videos as user input content", () => {
  assert.deepEqual(
    buildGeminiOmniGoogleInput({
      prompt: "Make the mug handle invisible. Keep everything else the same.",
      media: [
        { type: "video", mimeType: "video/mp4", data: "VIDEO_BASE64" },
        { type: "image", mimeType: "image/png", data: "IMAGE_BASE64" }
      ]
    }),
    [
      {
        type: "user_input",
        content: [
          { type: "video", mime_type: "video/mp4", data: "VIDEO_BASE64" },
          { type: "image", mime_type: "image/png", data: "IMAGE_BASE64" },
          { type: "text", text: "Make the mug handle invisible. Keep everything else the same." }
        ]
      }
    ]
  );
});

test("Gemini Omni Google video edits omit generation task and preserve source aspect", () => {
  assert.deepEqual(
    buildGeminiOmniGoogleRequestBody({
      model: "gemini-omni-flash-preview",
      prompt: "Make the mug handle invisible. Keep everything else the same.",
      media: [{ type: "video", mimeType: "video/mp4", data: "VIDEO_BASE64" }],
      aspectRatio: "16:9",
      task: "video_edit"
    }),
    {
      model: "gemini-omni-flash-preview",
      input: [
        {
          type: "user_input",
          content: [
            { type: "video", mime_type: "video/mp4", data: "VIDEO_BASE64" },
            { type: "text", text: "Make the mug handle invisible. Keep everything else the same." }
          ]
        }
      ],
      response_format: { type: "video", delivery: "uri" },
      background: false,
      store: true,
      stream: false
    }
  );
});

test("Gemini Omni Google text normalizes smart punctuation for API byte-string fields", () => {
  const prompt = `Keep the source video${String.fromCodePoint(0x2019)}s timing ${String.fromCodePoint(0x2014)} no changes${String.fromCodePoint(0x2026)}`;
  assert.equal(
    normalizeGeminiOmniGoogleText(prompt),
    "Keep the source video's timing - no changes..."
  );
  assert.ok(Array.from(normalizeGeminiOmniGoogleText(prompt)).every((character) => character.codePointAt(0) <= 255));
});

test("Gemini Omni edit prompt preserves the source video", () => {
  const prompt = buildGeminiOmniEditPrompt({
    prompt: "Remove the extra handle on the coffee mug.",
    generateAudio: false
  });

  assert.match(prompt, /^Remove the extra handle on the coffee mug\./);
  assert.equal(prompt, "Remove the extra handle on the coffee mug. Keep everything else the same.");
  assert.doesNotMatch(prompt, /Do not add dialogue/);
  assert.doesNotMatch(prompt, /Create a \d+-second video/);
});

test("Gemini Omni Fal input routes a lone start frame to image-to-video shape", () => {
  assert.deepEqual(
    buildGeminiOmniFalInput({
      prompt: "Animate the first frame",
      aspectRatio: "16:9",
      durationSeconds: 8,
      media: [{ url: "https://cdn.example/start.png", type: "image", role: "first-frame" }]
    }),
    {
      prompt: "Animate the first frame",
      aspect_ratio: "16:9",
      duration: 8,
      image_url: "https://cdn.example/start.png"
    }
  );
});

test("Gemini Omni Fal input routes reference images to reference-to-video shape", () => {
  assert.deepEqual(
    buildGeminiOmniFalInput({
      prompt: "Use @Product as the design",
      aspectRatio: "9:16",
      durationSeconds: 5,
      media: [
        { url: "https://cdn.example/start.png", type: "image", role: "first-frame" },
        { url: "https://cdn.example/product.png", type: "image", role: "reference" }
      ]
    }),
    {
      prompt: "Use @Product as the design",
      aspect_ratio: "9:16",
      duration: 5,
      image_urls: ["https://cdn.example/start.png", "https://cdn.example/product.png"]
    }
  );
});

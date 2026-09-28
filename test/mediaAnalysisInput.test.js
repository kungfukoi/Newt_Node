import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import sharp from "sharp";

import { buildMediaAnalysisContent } from "../server/media-analysis-input.js";

test("Atlas media analysis compacts local images before embedding them", async () => {
  const original = await sharp({
    create: { width: 3200, height: 1800, channels: 3, background: "#825f3d" }
  }).png().toBuffer();
  const content = await buildMediaAnalysisContent({
    inputs: [{ url: "/outputs/reference.png", label: "Character reference" }],
    prompt: "Describe the reference.",
    readLocalAsset: async () => ({ buffer: original, fileName: "reference.png", mimeType: "image/png" }),
    optimizeImages: true
  });

  assert.equal(content[1].text, "Character reference");
  assert.match(content[2].image_url, /^data:image\/jpeg;base64,/);
  const compact = Buffer.from(content[2].image_url.split(",")[1], "base64");
  const metadata = await sharp(compact).metadata();
  assert.ok(Math.max(metadata.width, metadata.height) <= 1024);
  assert.ok(compact.length < original.length);
});

test("Atlas media analysis shares one bounded image budget across many references", async () => {
  const width = 1200;
  const height = 800;
  const original = await sharp(randomBytes(width * height * 3), {
    raw: { width, height, channels: 3 }
  }).jpeg({ quality: 100 }).toBuffer();
  const inputs = Array.from({ length: 12 }, (_value, index) => ({
    url: `/outputs/reference-${index + 1}.jpg`,
    label: `Reference ${index + 1}`
  }));
  const content = await buildMediaAnalysisContent({
    inputs,
    prompt: "Describe every reference.",
    readLocalAsset: async () => ({ buffer: original, mimeType: "image/jpeg" }),
    optimizeImages: true
  });

  const imagePayloads = content.filter((item) => item.type === "input_image");
  assert.equal(imagePayloads.length, inputs.length);
  assert.ok(Buffer.byteLength(JSON.stringify(content)) < 2_100_000);
});

test("OpenAI media analysis retains the original inline image", async () => {
  const content = await buildMediaAnalysisContent({
    inputs: [{ url: "/outputs/reference.png" }],
    prompt: "Describe it.",
    readLocalAsset: async () => ({ buffer: Buffer.from("image"), mimeType: "image/png" })
  });

  assert.equal(content.at(-1).image_url, `data:image/png;base64,${Buffer.from("image").toString("base64")}`);
});

import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { fetchJsonApi } from "../src/api/newtApi.js";
import { prepareIdeogram45Upload } from "../server/ideogram45.js";

test("interrupted generation requests are never replayed through the other API lane", async () => {
  const previousFetch = globalThis.fetch, previousWindow = globalThis.window;
  globalThis.window = { location: { hostname: "127.0.0.1", port: "5176" } };
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError("Failed to fetch"); };
  try {
    for (const path of ["/api/node/generate-image", "/api/node/utility-image", "/api/node/edit-image"]) {
      calls = 0;
      await assert.rejects(fetchJsonApi(path, { method: "POST", body: "{}" }, "Generation"), /no request was resubmitted/);
      assert.equal(calls, 1);
    }
  } finally { globalThis.fetch = previousFetch; globalThis.window = previousWindow; }
});

test("oversized Ideogram inputs use lossless copies with identical geometry and pixels", async () => {
  const buffer = await sharp({ create: { width: 256, height: 256, channels: 4, background: "#cc884488" } }).png({ compressionLevel: 0 }).toBuffer();
  const original = { buffer, mimeType: "image/png", fileName: "source.png" };
  const prepared = await prepareIdeogram45Upload(original, 0, { maxBytes: 10000 });
  assert.ok(prepared.buffer.length < 10000);
  assert.equal(original.buffer, buffer);
  assert.deepEqual(await sharp(prepared.buffer).raw().toBuffer(), await sharp(buffer).raw().toBuffer());
  assert.equal((await sharp(prepared.buffer).metadata()).width, 256);
  await assert.rejects(prepareIdeogram45Upload(original, 0, { maxBytes: 1 }), /smaller source image/);
  assert.equal(await prepareIdeogram45Upload(original, 0), original);
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRodin25FalInput,
  isRodin25Model,
  model3DFaceCount,
  normalizeModel3DModel,
  rodin25QualityMeshOption
} from "../src/model3D.js";
import { model3DNames, model3DOptions } from "../src/modelOptions.js";

test("3D model options expose Rodin 2.5 without changing the Hunyuan default", () => {
  assert.deepEqual(model3DOptions, [model3DNames.hunyuanPro, model3DNames.rodin25]);
  assert.equal(normalizeModel3DModel("unknown model"), model3DNames.hunyuanPro);
  assert.equal(isRodin25Model(model3DNames.rodin25), true);
});

test("Rodin 2.5 maps the shared face control to supported triangle mesh options", () => {
  assert.equal(model3DFaceCount(40000, model3DNames.rodin25), 50000);
  assert.equal(model3DFaceCount(1600000, model3DNames.rodin25), 2000000);
  assert.equal(rodin25QualityMeshOption(500000), "500K Triangle");
  assert.equal(model3DFaceCount(1600000, model3DNames.hunyuanPro), 1500000);
});

test("Rodin 2.5 Fal input requests GLB output and honors texture mode", () => {
  assert.deepEqual(buildRodin25FalInput({
    imageUrls: ["https://example.test/front.png", "https://example.test/back.png"],
    generateType: "Normal",
    enablePbr: true,
    faceCount: 500000
  }), {
    image_urls: ["https://example.test/front.png", "https://example.test/back.png"],
    tier: "Gen-2.5-High",
    geometry_file_format: "glb",
    material: "PBR",
    quality_mesh_option: "500K Triangle",
    preview_render: true
  });

  assert.equal(buildRodin25FalInput({
    imageUrls: ["https://example.test/front.png"],
    generateType: "Geometry",
    enablePbr: true,
    faceCount: 150000
  }).material, "None");
});

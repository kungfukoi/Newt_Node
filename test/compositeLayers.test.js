import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import ffmpeg from "ffmpeg-static";
import { normalizeCompositeLayers, compositeInputPorts, migrateCompositeEdges, compositeLayerPortId } from "../src/compositeLayers.js";
import { buildCompositeStackArgs } from "../server/composite-stack.js";
import { compositeVideoBlendModeOptions } from "../src/modelOptions.js";
import { appendInputConnection } from "../src/nodePortBehavior.js";

test("legacy shared inputs become individual stable layers and retain overlay settings", () => {
  const node = { id: "c", data: { compositeBlendMode: "screen", compositeMixAmount: 37, compositeInvertMask: true } };
  const edges = [0, 1, 2].map((index) => ({ id: String(index), from: { nodeId: `s${index}`, port: "videoOut" }, to: { nodeId: "c", port: "referenceVideoIn" } }));
  edges.push({ id: "mask", to: { nodeId: "c", port: "maskVideoIn" } });
  const migrated = migrateCompositeEdges([node], edges, () => true);
  assert.deepEqual(migrated.map((edge) => edge.to.port), ["referenceVideoIn", "compositeLayer:layer1", "compositeLayer:legacy2", "maskVideoIn"]);
  assert.equal(node.data.compositeLayers[1].blendMode, "screen");
  assert.equal(node.data.compositeLayers[1].mixAmount, 37);
  assert.equal(node.data.compositeLayers[1].invertMask, true);
  assert.deepEqual(migrateCompositeEdges([node], migrated, () => true), migrated);
  const survivors = node.data.compositeLayers.filter((layer) => layer.id !== "layer1");
  assert.equal(compositeLayerPortId(survivors[1]), "compositeLayer:legacy2");
  assert.equal(compositeInputPorts({ compositeLayers: survivors }).length, 4);
});

test("layer normalization bounds controls and replacement keeps one asset per dot", () => {
  const layers = normalizeCompositeLayers({ compositeLayers: [{ id: "same", blendMode: "invalid", mixAmount: 150 }, { id: "same", maskBlur: -2, maskExpand: 99 }] });
  assert.equal(layers[0].mixAmount, 100);
  assert.equal(layers[0].blendMode, "normal");
  assert.notEqual(layers[0].id, layers[1].id);
  assert.equal(layers[1].maskBlur, 0);
  assert.equal(layers[1].maskExpand, 12);
  const old = { from: { nodeId: "a", port: "imageOut" }, to: { nodeId: "c", port: "referenceVideoIn" } };
  const replacement = { ...old, from: { nodeId: "b", port: "imageOut" } };
  assert.deepEqual(appendInputConnection([old], replacement, true), [replacement]);
});

test("FFmpeg composites three layers with independent masks and image alpha", async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), "newt-composite-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const image = async (name, background) => { const file = path.join(root, name); await sharp({ create: { width: 16, height: 16, channels: 4, background } }).png().toFile(file); return file; };
  const red = await image("red.png", "red");
  const blue = await image("blue.png", "blue");
  const transparent = await image("transparent.png", { r: 0, g: 255, b: 0, alpha: 0 });
  const black = await image("black.png", "black");
  const white = await image("white.png", "white");
  const render = (layers) => {
    const args = buildCompositeStackArgs({ layers: layers.map((layer) => ({ blendMode: "normal", mixAmount: 100, type: "image", maskType: "image", ...layer })), width: 16, height: 16, fps: 24, duration: 0.2 });
    const result = spawnSync(ffmpeg, [...args, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { maxBuffer: 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr.toString());
    assert.equal(result.stdout.length, 16 * 16 * 3);
    return result.stdout;
  };
  const hidden = render([{ filePath: red }, { filePath: blue, maskPath: black }, { filePath: transparent, maskPath: white }]);
  assert.ok(hidden[0] > 220 && hidden[2] < 30, "masked/transparent upper layers must preserve red base");
  const visible = render([{ filePath: red }, { filePath: blue, maskPath: black, invertMask: true }, { filePath: transparent }]);
  assert.ok(visible[2] > 220 && visible[0] < 30, "inverting only blue layer mask must reveal blue");
  for (const [blendMode] of compositeVideoBlendModeOptions) render([{ filePath: red }, { filePath: blue, blendMode, mixAmount: 50 }]);
});

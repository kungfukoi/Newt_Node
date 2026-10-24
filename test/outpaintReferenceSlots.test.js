import test from "node:test";
import assert from "node:assert/strict";
import { outpaintImageSlots, outpaintImagePayload, migrateOutpaintImageEdges } from "../src/outpaintReferenceSlots.js";
import { seedanceOutpaintPrompt } from "../src/videoOutpaint.js";
import { buildOutpaintAnalysisPrompt } from "../src/videoOutpaintPrompt.js";

const node = { id: "n", type: "utility", data: { utilityMode: "video", utilityVideoModel: "Video Outpaint" } };
const edge = i => ({ id: `e${i}`, from: { nodeId: `s${i}`, port: "imageOut" }, to: { nodeId: "n", port: "referenceImageIn" } });
test("three named slots exist before connections and sparse slots preserve roles and duplicate URLs", () => {
  const data = { outpaintReferenceNames: ["Set", "", "Clothes"], videoOutpaint: { referenceRoles: ["environment", "appearance", "wardrobe"] } };
  const slots = outpaintImageSlots(data);
  assert.equal(slots.length, 3); assert.equal(slots[1].name, "Image 2");
  assert.equal(outpaintImageSlots(data, { referenceImageIn: ["/uploads/blue%20sky.png?x=1"] })[0].name, "blue sky.png");
  assert.equal(outpaintImageSlots(data, { referenceImageIn: ["/uploads/id.png"] }, { referenceImageIn: "original.png" })[0].name, "original.png");
  assert.deepEqual(outpaintImagePayload(data, { referenceImageIn: ["/same.png"], outpaintImage3In: ["/same.png"] }), { urls: ["/same.png", "/same.png"], roles: ["environment", "wardrobe"] });
  assert.deepEqual(outpaintImagePayload(data, { outpaintImage3In: ["/third.png"] }).roles, ["wardrobe"]);
});
test("legacy wires migrate in order with IDs intact and stay stable on reload", () => {
  const edges = [edge(1), edge(2), edge(3)];
  const migrated = migrateOutpaintImageEdges([node], edges);
  assert.deepEqual(migrated.map(e => e.to.port), ["referenceImageIn", "outpaintImage2In", "outpaintImage3In"]);
  assert.deepEqual(migrated.map(e => e.id), edges.map(e => e.id));
  assert.deepEqual(migrateOutpaintImageEdges([node], migrated), migrated);
  assert.equal(edges[1].to.port, "referenceImageIn");
  assert.deepEqual(migrateOutpaintImageEdges([{ ...node, data: { ...node.data, utilityVideoModel: "Other" } }], edges), edges);
});
test("legacy bundles larger than three retain every reference and its role", () => {
  const edges = [1,2,3,4].map(edge);
  assert.deepEqual(migrateOutpaintImageEdges([node], edges), edges);
  const roles = ["environment", "wardrobe", "appearance", "environment"];
  const payload = outpaintImagePayload({ videoOutpaint: { referenceRoles: roles } }, { referenceImageIn: ["a", "b", "c", "d"] });
  assert.deepEqual(payload.roles, roles); assert.equal(payload.urls.length, 4);
});
test("source material color takes priority independently for each subject in analysis and generation", () => {
  for (const text of [buildOutpaintAnalysisPrompt({ mode: "auto" }), seedanceOutpaintPrompt("Full frame a scene.")]) {
    assert.match(text, /SOURCE COLOR PRIORITY/); assert.match(text, /Match every subject, object, surface and material independently/);
    assert.match(text, /Visible source evidence determines color/);
  }
});

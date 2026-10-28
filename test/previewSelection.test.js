import assert from "node:assert/strict";
import test from "node:test";

import { previewSelectionForNode, groupPreviewConnections } from "../src/previewSelection.js";

test("Preview groups expanded model batch results under the real producer", () => {
  const producer = { id: "model", type: "videoModel", data: { resultItems: [0, 1, 2].map(index => ({ url: `/${index}.mp4`, type: "video" })) } };
  const connections = producer.data.resultItems.map((entry, index) => ({ source: { id: `model:entry:${index}` }, batchSource: producer, batchEntry: entry, edge: { from: { nodeId: "model", port: "videoOut" } } }));
  const grouped = groupPreviewConnections(connections);
  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].source, producer);
  assert.equal(grouped[0].source.data.resultItems.length, 3);
  const selection = previewSelectionForNode({ data: { previewSourceId: "model:entry:2:videoOut", previewItemIndex: 0 } },
    [{ id: "model:videoOut", items: producer.data.resultItems, legacyPreviewSources: grouped[0].legacyPreviewSources }]);
  assert.equal(selection.item.url, "/2.mp4");
});

test("Preview groups passive Batch media and retains separate normal sources", () => {
  const batch = { id: "batch", type: "batch", data: { batchMediaType: "image" } };
  const connections = [0, 1].map(index => ({ source: { id: `batch:entry:${index}` }, batchSource: batch, batchEntry: { url: `/${index}.png`, type: "image" }, edge: { from: { nodeId: "batch", port: "batchOut" } } }));
  const normal = { source: { id: "separate", type: "image" }, edge: { from: { port: "imageOut" } } };
  const grouped = groupPreviewConnections([...connections, normal]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].source.id, "batch");
  assert.deepEqual(grouped[0].source.data.resultItems.map(item => item.url), ["/0.png", "/1.png"]);
  assert.equal(grouped[1], normal);
});

function source(id, selectedIndex = -1, count = 3) {
  return {
    id,
    items: Array.from({ length: count }, (_, index) => ({
      url: `/outputs/${id}-${index}.png`,
      type: "image",
      sourceSelectedResult: index === selectedIndex
    }))
  };
}

test("Preview follows producer selection even when its saved item index is stale", () => {
  const previewNode = {
    data: {
      previewSourceId: "image-1:imageOut",
      previewItemIndex: 2
    }
  };
  const selection = previewSelectionForNode(previewNode, [source("image-1:imageOut", 0)]);

  assert.equal(selection.source.id, "image-1:imageOut");
  assert.equal(selection.itemIndex, 0);
  assert.equal(selection.item.url, "/outputs/image-1:imageOut-0.png");
});

test("Preview rail follows the live source when its saved selection is invalid", () => {
  const previewNode = {
    data: {
      previewSourceId: "image-1:imageOut",
      previewItemIndex: 7
    }
  };
  const selection = previewSelectionForNode(previewNode, [source("image-1:imageOut", 1, 2)]);

  assert.equal(selection.itemIndex, 1);
});

test("Preview rail follows the active source when its saved source was disconnected", () => {
  const previewNode = {
    data: {
      previewSourceId: "removed:imageOut",
      previewItemIndex: 0
    }
  };
  const inactiveSource = source("image-1:imageOut", -1, 1);
  const activeSource = source("image-2:imageOut", 0, 1);
  const selection = previewSelectionForNode(previewNode, [inactiveSource, activeSource]);

  assert.equal(selection.source.id, "image-2:imageOut");
});

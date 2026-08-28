import assert from "node:assert/strict";
import test from "node:test";

import { previewSelectionForNode } from "../src/previewSelection.js";

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

test("Preview rail keeps its saved selection across source rerenders", () => {
  const previewNode = {
    data: {
      previewSourceId: "image-1:imageOut",
      previewItemIndex: 2
    }
  };
  const selection = previewSelectionForNode(previewNode, [source("image-1:imageOut", 0)]);

  assert.equal(selection.source.id, "image-1:imageOut");
  assert.equal(selection.itemIndex, 2);
  assert.equal(selection.item.url, "/outputs/image-1:imageOut-2.png");
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

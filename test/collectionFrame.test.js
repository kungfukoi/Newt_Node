import test from "node:test";
import assert from "node:assert/strict";
import { collectionRows, collectionRowsFromDrag, collectionRowHeight, collectionRowGap, collectionFrameHeight, collectionHeightFromDrag, collectionRowsFromHeight, collectionFrameChrome } from "../src/collectionFrame.js";

test("Collection row preferences remain bounded and tolerate missing or corrupt saved values", () => {
  for (const value of [undefined, null, "bad", NaN, Infinity, -5, 0]) assert.equal(collectionRows(value), 1);
  assert.equal(collectionRows("3"), 3); assert.equal(collectionRows(999), 12);
});
test("A fixed drag origin snaps complete rows in either direction without accumulating jitter", () => {
  const step = collectionRowHeight + collectionRowGap;
  assert.equal(collectionRowsFromDrag(1, 20), 1);
  assert.equal(collectionRowsFromDrag(1, step), 2);
  assert.equal(collectionRowsFromDrag(1, step * 2), 3);
  assert.equal(collectionRowsFromDrag(3, -step * 2), 1);
  assert.equal(collectionRowsFromDrag(1, -1000), 1);
  assert.equal(collectionRowsFromDrag(1, 9999), 12);
});

test("Frames follow sub-row pointer distances continuously and settle to the nearest row", () => {
  const start=collectionFrameHeight(2);
  assert.equal(collectionHeightFromDrag(2,40),start+40);
  assert.equal(collectionRowsFromHeight(start+40),2);
  assert.equal(collectionRowsFromHeight(start+(collectionRowHeight+collectionRowGap)*0.75),3);
  assert.equal(collectionHeightFromDrag(1,-500),collectionFrameHeight(1));
  assert.equal(collectionHeightFromDrag(12,500),collectionFrameHeight(12));
  const customHeight=collectionFrameHeight(1)+20;
  assert.equal(collectionHeightFromDrag(2,10,customHeight),customHeight+10);
});

test("Every settled frame reserves scrollbar and padding space beyond the tile rows", () => {
  for(const rows of [1,2,3,12]) assert.equal(collectionFrameHeight(rows)-(rows*collectionRowHeight+(rows-1)*collectionRowGap),collectionFrameChrome);
});

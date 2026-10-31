import test from "node:test";
import assert from "node:assert/strict";
import { collectionRows, collectionRowsFromDrag, collectionRowHeight, collectionRowGap } from "../src/collectionFrame.js";

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

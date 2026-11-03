export const collectionRowHeight = 239.375;
export const collectionRowGap = 18;
// Padding and horizontal scrollbar space sit outside the complete tile rows.
export const collectionFrameChrome = 32;
export const collectionMaxRows = 12;
export function collectionRows(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(collectionMaxRows, Math.max(1, Math.round(number))) : 1;
}
export function collectionRowsFromDrag(startRows, distance) {
  return collectionRows(collectionRows(startRows) + Math.round(distance / (collectionRowHeight + collectionRowGap)));
}
export function collectionFrameHeight(rows) {
  const count = collectionRows(rows);
  return count * collectionRowHeight + (count - 1) * collectionRowGap + collectionFrameChrome;
}
export function collectionHeightFromDrag(startRows, distance, startHeight = collectionFrameHeight(startRows)) {
  return Math.min(collectionFrameHeight(collectionMaxRows), Math.max(collectionFrameHeight(1), startHeight + distance));
}
export function collectionRowsFromHeight(height) {
  return collectionRows(1 + Math.round((height - collectionFrameChrome - collectionRowHeight) / (collectionRowHeight + collectionRowGap)));
}

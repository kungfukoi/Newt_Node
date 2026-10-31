export const collectionRowHeight = 190;
export const collectionRowGap = 18;
export const collectionMaxRows = 12;
export function collectionRows(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(collectionMaxRows, Math.max(1, Math.round(number))) : 1;
}
export function collectionRowsFromDrag(startRows, distance) {
  return collectionRows(collectionRows(startRows) + Math.round(distance / (collectionRowHeight + collectionRowGap)));
}

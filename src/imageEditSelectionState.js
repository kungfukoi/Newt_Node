import { validateEditBoxes } from "./imageEditBoxes.js";
import { validateBoxObject } from "./imageEditBoxModels.js";
import { validateSam2Settings } from "./objectSelection.js";

export function normalizeImageEditSelectionState(value) {
  if (!value || !Array.isArray(value.marks) || value.marks.length > 256 || JSON.stringify(value).length > 12 * 1024 * 1024) throw new Error("Invalid saved selections.");
  const marks = value.marks.map(mark => {
    if (mark.layer === "boxes") {
      const box = validateEditBoxes([mark])[0];
      return { ...box, layer: "boxes", tool: "box", selectionDerived: Boolean(mark.selectionDerived), ...(mark.sourceMask ? { sourceMask: validateBoxObject(mark.sourceMask) } : {}) };
    }
    if (mark.layer !== "selection") throw new Error("Only selections and boxes can be saved.");
    if (mark.tool === "object") return { layer: "selection", tool: "object", subtract: Boolean(mark.subtract), mask: { ...validateBoxObject(mark.mask), id: String(mark.mask.id || "saved") } };
    if (!["pen", "eraser", "rectangle", "ellipse"].includes(mark.tool) || !Array.isArray(mark.points) || !mark.points.length || mark.points.length > 12000 || !mark.points.every(p => [p.x, p.y].every(n => Number.isFinite(n) && n >= 0 && n <= 1)) || !Number.isFinite(mark.size) || mark.size <= 0 || mark.size > 1) throw new Error("Invalid saved selection stroke.");
    return { layer: "selection", tool: mark.tool, points: mark.points.map(({ x, y }) => ({ x, y })), size: mark.size, opacity: 1, color: "#ffffff" };
  });
  validateEditBoxes(marks.filter(mark => mark.layer === "boxes"));
  return { version: 1, marks, sam2Settings: validateSam2Settings(value.sam2Settings), selectedBoxId: String(value.selectedBoxId || "").slice(0, 80), selectionName: String(value.selectionName || "").slice(0, 300) };
}

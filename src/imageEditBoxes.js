export const maxEditBoxes = 8;
export const editBoxModes = { new: "New", keep: "Keep", move: "Move", remove: "Remove", reference: "From Reference", text: "Text" };
export const clampBoxValue = (value, min, max) => Math.max(min, Math.min(max, value));

export function boxCorners(rect, width, height) {
  const angle = (rect.rotation || 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => {
    const dx = x * rect.w * width / 2, dy = y * rect.h * height / 2;
    return { x: rect.x * width + dx * c - dy * s, y: rect.y * height + dx * s + dy * c };
  });
}

export function validateEditBoxes(value = []) {
  if (!Array.isArray(value) || value.length > maxEditBoxes) throw new Error(`Use up to ${maxEditBoxes} edit boxes.`);
  const ids = new Set();
  return value.map(box => {
    if (!box || typeof box.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/.test(box.id) || ids.has(box.id)) throw new Error("Each edit box needs a unique ID.");
    ids.add(box.id);
    if (!Object.hasOwn(editBoxModes, box.mode)) throw new Error("Choose a supported box mode.");
    if (typeof box.label !== "string" || !box.label.trim() || box.label.length > 200) throw new Error("Describe each boxed object in 1–200 characters.");
    for (const rect of [box.source, box.target]) {
      if (!rect || !["x", "y", "w", "h", "rotation"].every(key => typeof rect[key] === "number" && Number.isFinite(rect[key]))) throw new Error("Invalid box transform.");
      if (rect.x < 0 || rect.x > 1 || rect.y < 0 || rect.y > 1 || rect.w < .005 || rect.w > 2 || rect.h < .005 || rect.h > 2 || Math.abs(rect.rotation) > 180) throw new Error("Box transform is outside the supported range.");
    }
    if (box.source.rotation !== 0 || box.source.x - box.source.w / 2 < -.00001 || box.source.x + box.source.w / 2 > 1.00001 || box.source.y - box.source.h / 2 < -.00001 || box.source.y + box.source.h / 2 > 1.00001) throw new Error("Draw the source box inside the original image.");
    const clean = rect => Object.fromEntries(["x", "y", "w", "h", "rotation"].map(key => [key, rect[key]]));
    if (box.mode === "text" && (typeof box.text !== "string" || !box.text.trim() || box.text.length > 500)) throw new Error("Enter 1–500 characters for each Text box.");
    if (box.mode === "reference" && (typeof box.referenceUrl !== "string" || !box.referenceUrl)) throw new Error("Upload a reference image for each From Reference box.");
    return { id: box.id, mode: box.mode, label: box.label.trim(), text: box.mode === "text" ? box.text.trim() : "", referenceUrl: box.mode === "reference" ? box.referenceUrl : "", source: clean(box.source), target: clean(box.target) };
  });
}

export function boxFromDrag(start, end, id) {
  const rect = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2, w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y), rotation: 0 };
  return { id, mode: "move", label: "Object", text: "", referenceUrl: "", source: rect, target: { ...rect }, layer: "boxes", tool: "box" };
}

export function transformEditBox(box, operation, start, point, width, height) {
  const target = { ...box.target };
  if (operation === "translate") {
    target.x = clampBoxValue(target.x + point.x - start.x, 0, 1);
    target.y = clampBoxValue(target.y + point.y - start.y, 0, 1);
  } else if (operation === "rotate") {
    const angle = p => Math.atan2((p.y - target.y) * height, (p.x - target.x) * width);
    target.rotation = ((target.rotation + (angle(point) - angle(start)) * 180 / Math.PI + 540) % 360) - 180;
  } else if (operation === "scale") {
    const radius = p => Math.hypot((p.x - target.x) * width, (p.y - target.y) * height);
    const ratio = clampBoxValue(radius(point) / Math.max(1, radius(start)), Math.max(.005 / target.w, .005 / target.h), Math.min(2 / target.w, 2 / target.h));
    target.w *= ratio; target.h *= ratio;
  }
  if (["keep", "remove"].includes(box.mode)) {
    target.w = Math.min(1, target.w); target.h = Math.min(1, target.h);
    target.x = clampBoxValue(target.x, target.w / 2, 1 - target.w / 2);
    target.y = clampBoxValue(target.y, target.h / 2, 1 - target.h / 2);
  }
  return ["keep", "remove"].includes(box.mode) ? { ...box, sourceMask: undefined, source: { ...target, rotation: 0 }, target: { ...target, rotation: 0 } } : { ...box, target };
}

export function editBoxesPrompt(boxes, guideIndex, referenceIndices = {}, staged = []) {
  if (!boxes.length) return "";
  return [
    `BOX INSTRUCTIONS: Image ${guideIndex} is a placement guide over ${staged.length ? "the prepared composite, with the moved subjects already placed and their old locations cleared" : "the original"}. Red dashed boxes identify source regions; cyan boxes show destinations; yellow boxes mark protected regions. Numbered pairs refer to the same object. Guide lines and labels are instructions only: remove all of them from the output.`,
    "Follow each box's operation. Preserve object identity and details when moving or using a reference, apply the requested scale and clockwise rotation, and integrate edges, lighting and shadows. Keep everything outside the editable regions unchanged. Coordinates below are percentages of the original frame, measured from the top-left; x/y locate the center, width/height are unrotated dimensions.",
    ...boxes.map((box, index) => {
      const position = r => `center (${(r.x * 100).toFixed(2)}%, ${(r.y * 100).toFixed(2)}%), width ${(r.w * 100).toFixed(2)}%, height ${(r.h * 100).toFixed(2)}%`;
      const description = `Box ${index + 1}: ${JSON.stringify(box.label)}.`;
      const destination = `Destination ${position(box.target)}. Rotate ${box.target.rotation.toFixed(2)} degrees clockwise.`;
      if (box.mode === "keep") return `${description} KEEP this original region unchanged: ${position(box.source)}.`;
      if (box.mode === "remove") return `${description} REMOVE the described object at ${position(box.source)} and reconstruct the background. Do not add a replacement.`;
      if (box.mode === "new") return `${description} ADD the described new object. ${destination}`;
      if (box.mode === "text") return `${description} Render exactly this visible text: ${JSON.stringify(box.text)}. The description specifies its appearance. ${destination}`;
      if (box.mode === "reference") return `${description} Place the subject from reference image ${referenceIndices[box.referenceUrl]} in this scene. ${destination}`;
      if (staged.includes(box.id)) return `${description} The isolated object is ALREADY positioned and rotated at its destination in image 1. REMOVE the neutral gray placeholder at ${position(box.source)} and reconstruct background only. Do not recreate the moved object at its old location. Remove old shadows and blend destination edges and shadows, preserving any moved objects overlapping this source region. Preserve the placed subject; do not move it again. ${destination}`;
      return `${description} MOVE the original object from ${position(box.source)}. ${destination} Reconstruct the vacated background and do not leave a duplicate at the source.`;
    })
  ].join("\n");
}

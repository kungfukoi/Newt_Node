export const flowNodeNoDragSelector = [
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "summary",
  "label",
  "a[href]",
  "video",
  "audio",
  "canvas",
  "[contenteditable='true']",
  "[draggable='true']",
  "[role='button']",
  "[role='tab']",
  "[role='tablist']",
  "[role='slider']",
  "[role='checkbox']",
  "[role='radio']",
  "[role='switch']",
  "[role='menuitem']",
  "[role='dialog']",
  "[role='toolbar']",
  "[data-node-drag-block]",
  ".inline-port",
  ".react-flow__resize-control",
  ".media-preview",
  ".preview-stage",
  ".result-carousel",
  ".composer-node-preview",
  ".camera-viewport-shell",
  ".model-3d-viewer",
  ".edit-trim-timeline",
  ".edit-image-tool-surface",
  ".edit-brush-dialog",
  ".edit-live-preview",
  ".color-id-picker"
].join(",");

export const flowNodeNoDragObserverOptions = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["draggable", "role", "data-node-drag-block"]
};

// React can replace an imperatively added class during a render. Repair the
// boundary synchronously, before React Flow's native mousedown drag listener.
// pointerdown propagation alone does not block that separate mouse event.
export function guardFlowNodeMouseDown(event) {
  const element = event.target?.closest?.(flowNodeNoDragSelector);
  if (element && event.currentTarget.contains(element)) {
    if (!element.classList.contains("nodrag")) element.classList.add("nodrag");
  }
}

// Native media controls can consume mouseup. D3 then keeps its window-level
// mousemove listener alive, even with buttons === 0. End that same gesture via
// its normal release path before it processes another movement.
export function installFlowDragReleaseRecovery(targetWindow) {
  let pending = false;
  let lastPoint = { clientX: 0, clientY: 0 };
  function release(event = lastPoint) {
    if (!pending) return;
    pending = false;
    targetWindow.dispatchEvent(new targetWindow.MouseEvent("mouseup", {
      bubbles: true, cancelable: true, view: targetWindow,
      button: 0, buttons: 0,
      clientX: event.clientX ?? lastPoint.clientX,
      clientY: event.clientY ?? lastPoint.clientY
    }));
  }
  function down(event) {
    if (event.button !== 0) return;
    release(event);
    pending = Boolean(event.target?.closest?.(".newt-react-flow .react-flow__node"));
    if (pending) lastPoint = { clientX: event.clientX, clientY: event.clientY };
  }
  function move(event) {
    if (pending && (event.buttons & 1) === 0) release(event);
    lastPoint = { clientX: event.clientX, clientY: event.clientY };
  }
  function key(event) { if (event.key === "Escape") release(); }
  targetWindow.addEventListener("mousedown", down, true);
  targetWindow.addEventListener("mousemove", move, true);
  targetWindow.addEventListener("pointermove", move, true);
  targetWindow.addEventListener("blur", release);
  targetWindow.addEventListener("keydown", key, true);
  return () => {
    release();
    targetWindow.removeEventListener("mousedown", down, true);
    targetWindow.removeEventListener("mousemove", move, true);
    targetWindow.removeEventListener("pointermove", move, true);
    targetWindow.removeEventListener("blur", release);
    targetWindow.removeEventListener("keydown", key, true);
  };
}

export function markFlowNodeNoDragElements(root) {
  if (!root || typeof root.matches !== "function") return;
  const matches = root.matches(flowNodeNoDragSelector) ? [root] : [];
  root.querySelectorAll?.(flowNodeNoDragSelector).forEach((element) => matches.push(element));
  matches.forEach((element) => {
    if (!element.classList.contains("nodrag")) element.classList.add("nodrag");
  });
}

export function markFlowNodeNoDragMutations(records = []) {
  records.forEach((record) => {
    if (record.type === "attributes") {
      markFlowNodeNoDragElements(record.target);
      return;
    }
    record.addedNodes?.forEach(markFlowNodeNoDragElements);
  });
}

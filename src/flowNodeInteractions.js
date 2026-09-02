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

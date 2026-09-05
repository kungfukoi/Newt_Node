export function nodePortGeometrySignature(card) {
  const rect = card.getBoundingClientRect();
  const scale = rect.width / card.offsetWidth || 1;
  const coordinate = (value) => Math.round(value / scale * 100) / 100;
  return [card.offsetWidth, card.offsetHeight, ...[...card.querySelectorAll("[data-port-key]")].map((port) => {
    const bounds = port.getBoundingClientRect();
    return [port.dataset.portKey, coordinate(bounds.x - rect.x), coordinate(bounds.y - rect.y), coordinate(bounds.width), coordinate(bounds.height)].join(":");
  })].join("|");
}

export function observeNodePortGeometry(card, invalidate, runtime = globalThis) {
  if (!card) return () => {};
  let frame = null;
  let signature = "";
  let disposed = false;
  const observed = new Set();
  function measure() {
    frame = null;
    if (disposed) return;
    const next = nodePortGeometrySignature(card);
    if (next !== signature) {
      signature = next;
      invalidate();
    }
  }
  function schedule() {
    if (!disposed && frame === null) frame = runtime.requestAnimationFrame(measure);
  }
  const resize = runtime.ResizeObserver ? new runtime.ResizeObserver(schedule) : null;
  function observeLayout() {
    const targets = new Set([card]);
    for (const port of card.querySelectorAll("[data-port-key]")) {
      for (let element = port; element && card.contains(element); element = element.parentElement) targets.add(element);
    }
    for (const element of observed) if (!targets.has(element)) { resize?.unobserve(element); observed.delete(element); }
    for (const element of targets) if (!observed.has(element)) { resize?.observe(element); observed.add(element); }
  }
  const mutation = runtime.MutationObserver ? new runtime.MutationObserver((changes) => {
    if (changes.every((change) => change.target.closest?.(".generation-progress"))) return;
    if (changes.some((change) => change.type === "childList")) observeLayout();
    schedule();
  }) : null;
  observeLayout();
  mutation?.observe(card, { attributes: true, attributeFilter: ["style", "class", "hidden", "open"], childList: true, subtree: true, characterData: true });
  for (const type of ["load", "loadedmetadata", "scroll", "toggle"]) card.addEventListener(type, schedule, true);
  measure();
  return () => {
    disposed = true;
    mutation?.disconnect();
    resize?.disconnect();
    if (frame !== null) runtime.cancelAnimationFrame(frame);
    for (const type of ["load", "loadedmetadata", "scroll", "toggle"]) card.removeEventListener(type, schedule, true);
  };
}

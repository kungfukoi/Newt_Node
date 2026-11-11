export const seedream55Sizes = ["1K", "2K"];
export const seedream55AspectRatios = ["auto", "1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9", "4:5", "5:4"];
export const seedream55Backgrounds = ["auto", "transparent", "opaque"];
export const seedream55Formats = ["png", "jpeg"];

const han = /\p{Script=Han}/u;

export async function prepareSeedreamLabelTranslator() {
  const api = globalThis.Translator;
  if (!api) return null;
  try {
    const options = { sourceLanguage: "zh", targetLanguage: "en" };
    if (await api.availability(options) === "unavailable") return null;
    return await api.create(options);
  } catch { return null; }
}

export async function translateSeedreamLabels(items, translatorReady) {
  if (!items.some(item => han.test(item.label))) return items;
  const signal = AbortSignal.timeout(3500);
  const translator = await Promise.race([translatorReady, new Promise(resolve => {
    signal.addEventListener("abort", () => resolve(null), { once: true });
  })]);
  return Promise.all(items.map(async item => {
    if (!han.test(item.label)) return item;
    let label = "";
    try { label = (await translator?.translate(item.label, { signal }))?.trim() || ""; } catch { /* Use a numbered label. */ }
    return { ...item, label: label && !han.test(label) ? label.slice(0, 160) : `Layer ${item.layer.index}` };
  }));
}

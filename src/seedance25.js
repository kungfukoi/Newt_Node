export const seedance25ModelName = "Seedance 2.5";
export const seedance25EndpointRoot = "bytedance/seedance-2.5";

export const seedance25DurationValues = [
  "auto",
  ...Array.from({ length: 27 }, (_value, index) => String(index + 4))
];
export const seedance25DurationOptions = seedance25DurationValues.map((value) =>
  value === "auto" ? value : `${value} seconds`
);
export const seedance25ResolutionOptions = ["1080p", "720p", "480p"];
export const seedance25AspectRatioValues = ["auto", "21:9", "16:9", "4:3", "1:1", "3:4", "9:16"];
export const seedance25AspectRatioOptions = ["auto", "21:9", "16:9 (Landscape)", "4:3", "1:1", "3:4", "9:16 (Portrait)"];

export const seedance25ReferenceLimits = Object.freeze({
  images: 30,
  videos: 10,
  audios: 10,
  total: 50,
  minimumMediaSeconds: 1.8,
  videoSeconds: 30.2,
  audioSeconds: 30.2
});

export function isSeedance25Model(model) {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized.includes("seedance") && (normalized.includes("2.5") || normalized.includes("2-5"));
}

export function normalizeSeedance25Duration(value) {
  const normalized = String(value || "auto").trim().toLowerCase();
  if (normalized === "auto") return "auto";
  const seconds = Number(normalized.match(/\d+/)?.[0]);
  return Number.isInteger(seconds) && seconds >= 4 && seconds <= 30 ? String(seconds) : "auto";
}

// Same model/endpoint, different operation. Never infer editing from a prompt.
// Fal and Atlas reference-to-video schemas verified 2026-10-06.
export function validateSeedance25Task({ model, seedanceTask = "reference", provider,
  videos = [], startFrames = [], endFrames = [], filmDirector } = {}) {
  const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!["reference", "edit"].includes(seedanceTask)) fail("Unknown Seedance task. Choose Generate Video or Edit Existing Video.");
  if (seedanceTask === "reference") return false;
  if (!isSeedance25Model(model)) fail("Edit Existing Video requires Seedance 2.5.");
  if (provider && !["atlas", "fal"].includes(provider)) fail("Seedance video editing is verified for Fal and Atlas only. No provider has been changed.");
  if (!Array.isArray(videos) || videos.length !== 1) fail("Edit Existing Video requires exactly one connected Reference Video.");
  if (!Array.isArray(startFrames) || !Array.isArray(endFrames)) fail("Invalid frame inputs for Edit Existing Video.");
  if (startFrames.length || endFrames.length) fail("Edit Existing Video cannot use Start or End Frames. Connect the look reference to Reference Image instead.");
  if (filmDirector) fail("Disconnect Director before editing an existing video; its scene timing must not override the source clip.");
  return true;
}

export function validateSeedance25EditDuration(duration) {
  if (!Number.isFinite(duration) || duration < 4 || duration > 30) {
    throw Object.assign(new Error("Edit Existing Video requires a readable source video between 4 and 30 seconds. No generation was submitted."), { status: 400 });
  }
  return duration;
}

export function validateSeedance25ReferenceTags(prompt, { images = 0, videos = 0, audio = 0 } = {}) {
  const counts = { image: images, video: videos, audio };
  const invalid = [...String(prompt || "").matchAll(/(?<![A-Za-z0-9._%+-])@([A-Za-z0-9_-]+)|\[(Image\d+|Video\d+|Audio\d+)\]/gi)]
    .map((match) => match[1] || match[2]).filter((tag) => {
      const match = tag.match(/^(Image|Video|Audio)([1-9]\d*)$/i);
      return !match || Number(match[2]) > counts[match[1].toLowerCase()];
    });
  if (invalid.length) throw Object.assign(new Error(`Unmatched reference tags: ${[...new Set(invalid)].map((tag) => `@${tag}`).join(", ")}. Match the connected node names exactly, or use numbered references such as @Image1 and @Video1.`), { status: 400 });
}

export function normalizeSeedance25Resolution(value) {
  const normalized = String(value || "720p").trim().toLowerCase();
  return seedance25ResolutionOptions.includes(normalized) ? normalized : "720p";
}

export function normalizeSeedance25AspectRatio(value, routeKind = "text-to-video") {
  if (routeKind === "image-to-video") return "auto";
  const normalized = String(value || "auto").trim().toLowerCase();
  if (normalized === "auto") return "auto";
  const ratio = normalized.match(/\d+:\d+/)?.[0] || "auto";
  return seedance25AspectRatioValues.includes(ratio) ? ratio : "auto";
}

export function seedance25Endpoint(routeKind) {
  const route = ["text-to-video", "image-to-video", "reference-to-video"].includes(routeKind)
    ? routeKind
    : "text-to-video";
  return `${seedance25EndpointRoot}/${route}`;
}


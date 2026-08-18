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


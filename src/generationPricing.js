import { estimateKreaImageCost, estimateKreaKlingCost, estimateKreaMiniMaxH3Cost, supportsKreaModel } from "./kreaApi.js";
import { estimateKreaSeedanceCost } from "./kreaSeedance.js";
import { estimateMinimaxH3Cost, isMinimaxH3Model } from "./minimaxH3.js";
import { estimateNanoBanana2Cost } from "./nanoBanana2.js";
import { estimateLegacyOpenAiImage2Cost, estimateOpenAiImage2Cost } from "./openAiImage2.js";
import { reve21CostPerImage } from "./reve21.js";
import { isSeedance25Model } from "./seedance25.js";
import { normalizeModelProviderPreferences } from "./modelProviderRouting.js";
import { isGptImage25Model, isLegacyOpenAiImage2Model } from "./modelOptions.js";

const falImageRates = Object.freeze({
  "Nano Banana Pro": Object.freeze({ "1K": 0.15, "2K": 0.15, "4K": 0.3 }),
  "Krea 2 Large": Object.freeze({ standard: 0.06, reference: 0.065 })
});

const googleImageRates = Object.freeze({
  "Nano Banana Pro": Object.freeze({ "1K": 0.134, "2K": 0.134, "4K": 0.24 })
});

const falKlingRates = Object.freeze({
  pro: Object.freeze({ silent: 0.112, audio: 0.14 }),
  "4k": Object.freeze({ silent: 0.42, audio: 0.42 })
});

const seedanceDimensions = Object.freeze({
  "480p": Object.freeze({
    "21:9": [992, 432], "16:9": [864, 496], "4:3": [752, 560],
    "1:1": [640, 640], "3:4": [560, 752], "9:16": [496, 864]
  }),
  "720p": Object.freeze({
    "21:9": [1470, 630], "16:9": [1280, 720], "4:3": [1112, 834],
    "1:1": [960, 960], "3:4": [834, 1112], "9:16": [720, 1280]
  }),
  "1080p": Object.freeze({
    "21:9": [2352, 1008], "16:9": [2048, 1152], "4:3": [1792, 1344],
    "1:1": [1536, 1536], "3:4": [1344, 1792], "9:16": [1152, 2048]
  }),
  "4k": Object.freeze({
    "21:9": [3840, 1648], "16:9": [3840, 2160], "4:3": [2880, 2160],
    "1:1": [2160, 2160], "3:4": [2160, 2880], "9:16": [2160, 3840]
  })
});

export function generationProviderForModel({
  model,
  mediaType,
  providerPreferences = {},
  providerAvailability = {}
} = {}) {
  const preferences = normalizeModelProviderPreferences(providerPreferences, providerAvailability);
  const normalized = String(model || "").toLowerCase();

  if (mediaType === "video") {
    if (normalized.includes("seedance")) return preferences.seedance;
    if (isMinimaxH3Model(model)) return preferences.minimaxH3;
    if (normalized.includes("gemini") && normalized.includes("omni")) return preferences.veo;
    if (normalized.includes("kling") && (normalized.includes("o3") || normalized.includes("03"))) {
      return automaticFalKreaProvider(providerAvailability);
    }
    return normalized.includes("wan") || normalized.includes("aurora") || normalized.includes("sam 3") ? "fal" : null;
  }

  if (mediaType === "image") {
    if (isGptImage25Model(model)) return "fal";
    if (model === "Nano Banana Pro") return preferences.imageGeneration;
    if (supportsKreaModel("image", model)) return automaticFalKreaProvider(providerAvailability);
    return ["REVE 2.1", "SAM 3 Image"].includes(model) ? "fal" : null;
  }

  return null;
}

export function estimateImageRunCost({
  model,
  resolution = "2K",
  aspectRatio = "16:9",
  quality = "high",
  referenceCount = 0,
  batchCount = 1,
  provider = "fal"
} = {}) {
  const references = Math.max(0, Number(referenceCount) || 0);
  let unitCost = null;

  if (isGptImage25Model(model)) {
    unitCost = estimateOpenAiImage2Cost({
      resolution,
      size: orientationSize(aspectRatio),
      quality,
      edit: references > 0
    });
  } else if (isLegacyOpenAiImage2Model(model)) {
    unitCost = provider === "krea"
      ? estimateKreaImageCost({ modelName: model, resolution, referenceCount: references }).amountUsd
      : estimateLegacyOpenAiImage2Cost({
          resolution,
          size: orientationSize(aspectRatio),
          quality,
          edit: references > 0
        });
  } else if (model === "Nano Banana 2") {
    unitCost = provider === "krea"
      ? estimateKreaImageCost({ modelName: model, resolution, referenceCount: references }).amountUsd
      : estimateNanoBanana2Cost(resolution);
  } else if (model === "Nano Banana Pro") {
    if (provider === "krea") {
      unitCost = estimateKreaImageCost({ modelName: model, resolution, referenceCount: references }).amountUsd;
    } else {
      const rates = provider === "google" ? googleImageRates[model] : falImageRates[model];
      unitCost = rates?.[normalizedImageResolution(resolution)] ?? null;
    }
  } else if (model === "REVE 2.1" && provider === "fal") {
    unitCost = reve21CostPerImage;
  } else if (model === "Krea 2 Large") {
    unitCost = provider === "krea"
      ? estimateKreaImageCost({ modelName: model, resolution, referenceCount: references }).amountUsd
      : references > 0 ? falImageRates[model].reference : falImageRates[model].standard;
  }

  return totalEstimate(unitCost, batchCount);
}

export function estimateVideoRunCost({
  model,
  duration = "5 seconds",
  resolution = "720p",
  aspectRatio = "16:9",
  generateAudio = true,
  hasVideoReference = false,
  referenceImageCount = 0,
  batchCount = 1,
  provider = "fal"
} = {}) {
  if (String(duration || "").trim().toLowerCase() === "auto") return null;
  const seconds = durationSeconds(duration);
  if (seconds === null) return null;
  let unitCost = null;

  if (model === "Seedance 2.0" || isSeedance25Model(model)) {
    if (provider === "krea") {
      unitCost = estimateKreaSeedanceCost({
        modelName: model,
        durationSeconds: seconds,
        resolution: normalizedVideoResolution(resolution),
        hasVideoReference
      }).amountUsd;
    } else if (provider === "fal" && !(isSeedance25Model(model) && hasVideoReference)) {
      unitCost = estimateFalSeedanceCost({ model, seconds, resolution, aspectRatio });
    }
  } else if (model === "Kling O3 Pro" || model === "Kling O3 4K") {
    const mode = model === "Kling O3 4K" ? "4k" : "pro";
    unitCost = provider === "krea"
      ? estimateKreaKlingCost({ durationSeconds: seconds, generateAudio, mode }).amountUsd
      : provider === "fal" ? seconds * falKlingRates[mode][generateAudio ? "audio" : "silent"] : null;
  } else if (isMinimaxH3Model(model)) {
    unitCost = provider === "local"
      ? 0
      : provider === "krea"
        ? estimateKreaMiniMaxH3Cost({ durationSeconds: seconds, referenceImageCount }).amountUsd
        : provider === "fal"
          ? estimateMinimaxH3Cost({ duration: seconds, resolution, referenceImageCount }).amountUsd
          : null;
  } else if (model === "Gemini Omni Flash") {
    unitCost = provider === "google" ? seconds * 0.1 : provider === "fal" ? seconds * 0.13 : null;
  }

  return totalEstimate(unitCost, batchCount);
}

export function formatRunCost(amountUsd) {
  if (amountUsd === null || amountUsd === undefined || amountUsd === "") return "";
  const amount = Number(amountUsd);
  if (!Number.isFinite(amount)) return "";
  if (amount > 0 && amount < 0.01) return "<$0.01";
  return `$${amount.toFixed(2)}`;
}

export function formatPricedRunLabel(label, amountUsd) {
  const cost = formatRunCost(amountUsd);
  return cost ? `${label} (${cost} est.)` : label;
}

function automaticFalKreaProvider(availability = {}) {
  if (availability.fal) return "fal";
  if (availability.krea) return "krea";
  return null;
}

function estimateFalSeedanceCost({ model, seconds, resolution, aspectRatio }) {
  const normalizedResolution = normalizedVideoResolution(resolution);
  const ratio = String(aspectRatio || "16:9").match(/\d+(?:\.\d+)?:\d+(?:\.\d+)?/)?.[0] || "16:9";
  const [width, height] = seedanceDimensions[normalizedResolution]?.[ratio] || seedanceDimensions[normalizedResolution]?.["16:9"] || [];
  if (!width || !height) return null;
  const rate = isSeedance25Model(model)
    ? normalizedResolution === "1080p" ? 0.0234 : 0.0214
    : normalizedResolution === "4k" ? 0.008 : 0.014;
  const units = (width * height * seconds * 24) / 1024 / 1000;
  return roundCurrency(units * rate);
}

function totalEstimate(unitCost, batchCount) {
  if (unitCost === null || unitCost === undefined || unitCost === "") return null;
  const numeric = Number(unitCost);
  if (!Number.isFinite(numeric)) return null;
  const count = Math.max(1, Math.round(Number(batchCount) || 1));
  return roundCurrency(numeric * count);
}

function durationSeconds(value) {
  const seconds = Number(String(value || "").match(/\d+/)?.[0]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function normalizedImageResolution(value) {
  const resolution = String(value || "2K").toUpperCase();
  return ["1K", "2K", "4K"].includes(resolution) ? resolution : "2K";
}

function normalizedVideoResolution(value) {
  const resolution = String(value || "720p").toLowerCase();
  return ["480p", "720p", "1080p", "4k"].includes(resolution) ? resolution : "720p";
}

function orientationSize(aspectRatio) {
  const ratio = String(aspectRatio || "16:9").match(/\d+(?:\.\d+)?:\d+(?:\.\d+)?/)?.[0] || "16:9";
  const [width, height] = ratio.split(":").map(Number);
  return `${width || 16}x${height || 9}`;
}

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
}

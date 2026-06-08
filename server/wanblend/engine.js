import path from "node:path";
import { File } from "node:buffer";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";

const comfyBaseUrl = (process.env.WANBLEND_COMFY_URL || process.env.WANWARP_COMFY_URL || "http://127.0.0.1:8188").replace(/\/+$/, "");
const defaultComfyTimeoutMs = 4 * 60 * 60 * 1000;
const comfyPollIntervalMs = 2000;
const templatePath = new URL("./templates/context-smashing.json", import.meta.url);
const outputNodeId = "37";
const contextImageNodeIds = ["20", "21", "22", "23", "24", "25"];
const contextScaleNodeIds = ["14", "15", "16", "17", "18", "19"];
const ipAdapterNodeIds = ["2", "4", "5", "6", "7", "8"];
const wanBlendImageSlotDefinitions = [
  { channel: "red", label: "Red", maskIndex: 0 },
  { channel: "green", label: "Green", maskIndex: 1 },
  { channel: "blue", label: "Blue", maskIndex: 2 },
  { channel: "cyan", label: "Cyan", maskIndex: 3 },
  { channel: "magenta", label: "Magenta", maskIndex: 4 },
  { channel: "yellow", label: "Yellow", maskIndex: 5 },
  { channel: "black", label: "Black", maskIndex: 6 },
  { channel: "white", label: "White", maskIndex: 7 }
];

const imageMimeTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);
const samplerOptions = new Set(["euler", "euler_ancestral", "lcm", "uni_pc", "dpmpp_2m", "dpmpp_sde"]);
const schedulerOptions = new Set(["simple", "sgm_uniform", "karras", "exponential", "ddim_uniform", "beta", "normal", "linear_quadratic", "kl_optimal", "bong_tangent", "beta57"]);

export async function createWanBlendComfyResult({
  body,
  prompt = "",
  referenceImageUrls = [],
  referenceVideoUrls = [],
  selectedVideoModel = null,
  helpers
}) {
  const requestId = randomUUID();
  const options = normalizeWanBlendOptions(body.wanBlend || {}, body);
  const promptText = String(prompt || body.prompt || "").trim() || options.positivePrompt || "4k";
  const sourceImageSlots = normalizeContextImageSlots(options.imageSlots, referenceImageUrls);
  const sourceImageUrls = sourceImageSlots.map((slot) => slot.url);
  const sourceVideoUrl = helpers.firstLocalOutput(referenceVideoUrls);

  if (!sourceImageSlots.length) {
    const error = new Error("WanBlend requires at least one connected context image. Connect only the color-mask slots you want to use.");
    error.status = 400;
    throw error;
  }

  if (!sourceVideoUrl) {
    const error = new Error("WanBlend requires a connected color-mask animation video.");
    error.status = 400;
    throw error;
  }

  await assertComfyAvailable();

  const imageAssets = await Promise.all(sourceImageSlots.map((slot) => helpers.resolveLocalAssetPathFromUrl(slot.url)));
  const colorMapVideo = await helpers.resolveLocalAssetPathFromUrl(sourceVideoUrl);
  const imageNames = await Promise.all(imageAssets.map((asset) => uploadImageToComfy(asset.filePath, asset.fileName)));
  const imageSlots = sourceImageSlots.map((slot, index) => ({
    ...slot,
    imageName: imageNames[index]
  }));

  const comfyPrompt = await buildWanBlendPrompt({
    requestId,
    prompt: promptText,
    negativePrompt: options.negativePrompt,
    imageSlots,
    colorMapVideoPath: colorMapVideo.filePath,
    options
  });

  const queued = await queueComfyPrompt(comfyPrompt, requestId);
  const history = await waitForComfyPrompt(queued.prompt_id || queued.promptId);
  const comfyVideo = findComfyVideo(history, outputNodeId);
  if (!comfyVideo) {
    const error = new Error("Comfy completed WanBlend but returned no video.");
    error.status = 502;
    error.raw = history?.outputs || history;
    throw error;
  }

  const output = await helpers.createManagedAssetTarget({ body }, "wanblend", "mp4", helpers.workflowPackageOutputDirName);
  await copyComfyVideoToOutput(comfyVideo, output.filePath);
  const [outputStats, metadata] = await Promise.all([
    stat(output.filePath),
    helpers.probeVideoFile(output.filePath)
  ]);
  const video = helpers.enrichVideoMetadata(
    {
      type: "video",
      label: "WanBlend",
      localUrl: output.publicPath,
      fileName: output.fileName,
      mimeType: "video/mp4",
      seed: options.seed ?? null
    },
    metadata
  );
  const text = "WanBlend generated a context-smashing attention-mask video.";
  const cost = {
    amountUsd: 0,
    currency: "USD",
    unitRateUsd: 0,
    units: 1,
    unit: "local ComfyUI workflow",
    mediaType: "video",
    pricingBasis: "Local ComfyUI WanBlend context-smashing run",
    pricingSource: "local-comfyui"
  };

  await helpers.appendHistory({
    id: requestId,
    createdAt: new Date().toISOString(),
    mediaType: "video",
    provider: "local-comfyui",
    modelName: selectedVideoModel?.displayName || "WanBlend",
    endpoint: "local/wanblend/comfyui/context-smashing",
    mode: "WanBlend context smashing attention mask",
    prompt: promptText,
    submittedPrompt: promptText,
    project: helpers.projectFromBody(body),
    node: helpers.nodeFromBody(body),
    settings: {
      model: selectedVideoModel?.displayName || "WanBlend",
      comfyUrl: comfyBaseUrl,
      comfyPromptId: queued.prompt_id || queued.promptId || "",
      outputNodeId,
      sourceImageCount: sourceImageUrls.length,
      imageSlots: sourceImageSlots.map(({ channel, label, maskIndex }) => ({ channel, label, maskIndex })),
      colorMapVideoUrl: sourceVideoUrl,
      fps: options.fps,
      width: options.width,
      height: options.height,
      steps: options.steps,
      cfg: options.cfg,
      crf: options.crf,
      selectEveryNth: options.selectEveryNth,
      frameLoadCap: options.frameLoadCap,
      ipAdapterWeight: options.ipAdapterWeight,
      motionLoraStrength: options.motionLoraStrength,
      workflow: "context-smashing"
    },
    cost,
    localVideo: video.localUrl,
    localVideos: [video.localUrl],
    outputFileName: video.fileName,
    outputFileNames: [video.fileName],
    outputLabels: [video.label],
    outputBytes: outputStats.size,
    text
  });

  return {
    requestId,
    endpoint: "local/wanblend/comfyui/context-smashing",
    modelName: selectedVideoModel?.displayName || "WanBlend",
    text,
    seed: options.seed ?? null,
    cost,
    video,
    videos: [video],
    resultItems: [video]
  };
}

async function buildWanBlendPrompt({
  requestId,
  prompt,
  negativePrompt,
  imageSlots,
  colorMapVideoPath,
  options
}) {
  const comfyPrompt = JSON.parse(await readFile(templatePath, "utf8"));

  patchWanBlendIpAdapterChain(comfyPrompt, imageSlots, options);

  comfyPrompt["10"].inputs.video = JSON.stringify(colorMapVideoPath);
  comfyPrompt["10"].inputs.frame_load_cap = options.frameLoadCap;
  comfyPrompt["10"].inputs.skip_first_frames = options.skipFirstFrames;
  comfyPrompt["10"].inputs.select_every_nth = options.selectEveryNth;
  comfyPrompt["13"].inputs.width = options.width;
  comfyPrompt["13"].inputs.height = options.height;
  comfyPrompt["35"].inputs.width = options.width;
  comfyPrompt["35"].inputs.height = options.height;
  comfyPrompt["26"].inputs.seed = options.seed ?? Math.floor(Math.random() * 2147483647);
  comfyPrompt["26"].inputs.steps = options.steps;
  comfyPrompt["26"].inputs.cfg = options.cfg;
  comfyPrompt["26"].inputs.sampler_name = options.samplerName;
  comfyPrompt["26"].inputs.scheduler = options.scheduler;
  comfyPrompt["26"].inputs.denoise = options.denoise;
  comfyPrompt["27"].inputs.text = negativePrompt;
  comfyPrompt["28"].inputs.text = prompt;
  comfyPrompt["31"].inputs.context_length = options.contextLength;
  comfyPrompt["31"].inputs.context_overlap = options.contextOverlap;
  comfyPrompt["33"].inputs.strength = options.motionLoraStrength;
  comfyPrompt["34"].inputs.strength_model = options.lcmLoraStrength;
  comfyPrompt["34"].inputs.strength_clip = options.lcmLoraStrength;
  comfyPrompt["37"].inputs.filename_prefix = `wanblend-${requestId}`;
  comfyPrompt["37"].inputs.frame_rate = options.fps;
  comfyPrompt["37"].inputs.crf = options.crf;
  comfyPrompt["37"].inputs.save_output = true;

  return comfyPrompt;
}

function patchWanBlendIpAdapterChain(comfyPrompt, imageSlots = [], options = {}) {
  const activeNodeIds = new Set();
  let previousModel = ["3", 0];

  imageSlots.forEach((slot, index) => {
    const imageNodeId = contextImageNodeIds[index] || String(9000 + index);
    const scaleNodeId = contextScaleNodeIds[index] || String(9020 + index);
    const adapterNodeId = ipAdapterNodeIds[index] || String(9040 + index);
    activeNodeIds.add(imageNodeId);
    activeNodeIds.add(scaleNodeId);
    activeNodeIds.add(adapterNodeId);

    comfyPrompt[imageNodeId] = {
      inputs: {
        image: slot.imageName
      },
      class_type: "LoadImage"
    };
    comfyPrompt[scaleNodeId] = {
      inputs: {
        image: [imageNodeId, 0],
        upscale_method: "bilinear",
        megapixels: 0.56,
        resolution_steps: 1
      },
      class_type: "ImageScaleToTotalPixels"
    };
    comfyPrompt[adapterNodeId] = {
      inputs: {
        model: previousModel,
        ipadapter: ["3", 1],
        image: [scaleNodeId, 0],
        attn_mask: ["9", slot.maskIndex],
        weight: options.ipAdapterWeight,
        weight_type: "linear",
        combine_embeds: "concat",
        start_at: options.ipAdapterStartAt,
        end_at: options.ipAdapterEndAt,
        embeds_scaling: "V only"
      },
      class_type: "IPAdapterAdvanced"
    };
    previousModel = [adapterNodeId, 0];
  });

  comfyPrompt["30"].inputs.model = previousModel;

  [...contextImageNodeIds, ...contextScaleNodeIds, ...ipAdapterNodeIds].forEach((nodeId) => {
    if (!activeNodeIds.has(nodeId)) delete comfyPrompt[nodeId];
  });
}

function normalizeContextImageSlots(rawSlots = [], fallbackUrls = []) {
  const slotDefinitionsByChannel = new Map(wanBlendImageSlotDefinitions.map((slot) => [slot.channel, slot]));
  const normalizedSlots = Array.isArray(rawSlots)
    ? rawSlots
        .map((item) => {
          const channel = String(item?.channel || "").trim().toLowerCase();
          const definition = slotDefinitionsByChannel.get(channel);
          const url = String(item?.url || "").trim();
          if (!definition || !isNewtLocalAssetUrl(url)) return null;
          return {
            channel: definition.channel,
            label: definition.label,
            maskIndex: definition.maskIndex,
            url
          };
        })
        .filter(Boolean)
    : [];

  if (normalizedSlots.length) return normalizedSlots;

  return fallbackUrls
    .filter(isNewtLocalAssetUrl)
    .slice(0, wanBlendImageSlotDefinitions.length)
    .map((url, index) => ({
      ...wanBlendImageSlotDefinitions[index],
      url
    }));
}

function normalizeWanBlendOptions(options = {}, body = {}) {
  const seed = optionalInteger(options.seed ?? body.seed);
  const samplerName = normalizeChoice(options.samplerName, samplerOptions, "lcm");
  const scheduler = normalizeChoice(options.scheduler, schedulerOptions, "sgm_uniform");
  return {
    positivePrompt: String(options.positivePrompt || ""),
    negativePrompt: String(options.negativePrompt || "nsfw, nude"),
    width: clampInteger(options.width ?? body.transitionBuilder?.width, 128, 2048, 512),
    height: clampInteger(options.height ?? body.transitionBuilder?.height, 128, 2048, 512),
    fps: clampInteger(options.fps, 1, 60, 24),
    steps: clampInteger(options.steps, 1, 100, 11),
    cfg: clampNumber(options.cfg, 0, 100, 1.2),
    denoise: clampNumber(options.denoise, 0, 1, 1),
    crf: clampInteger(options.crf, 0, 51, 19),
    frameLoadCap: clampInteger(options.frameLoadCap, 0, 4096, 0),
    skipFirstFrames: clampInteger(options.skipFirstFrames, 0, 4096, 0),
    selectEveryNth: clampInteger(options.selectEveryNth, 1, 120, 2),
    contextLength: clampInteger(options.contextLength, 1, 128, 16),
    contextOverlap: clampInteger(options.contextOverlap, 0, 128, 4),
    ipAdapterWeight: clampNumber(options.ipAdapterWeight, -1, 5, 1),
    ipAdapterStartAt: clampNumber(options.ipAdapterStartAt, 0, 1, 0),
    ipAdapterEndAt: clampNumber(options.ipAdapterEndAt, 0, 1, 1),
    motionLoraStrength: clampNumber(options.motionLoraStrength, 0, 10, 0.5),
    lcmLoraStrength: clampNumber(options.lcmLoraStrength, -100, 100, 0.1),
    imageSlots: Array.isArray(options.imageSlots) ? options.imageSlots : [],
    samplerName,
    scheduler,
    seed
  };
}

async function assertComfyAvailable() {
  let response;
  try {
    response = await fetch(`${comfyBaseUrl}/system_stats`);
  } catch (error) {
    const next = new Error(`WanBlend could not reach ComfyUI at ${comfyBaseUrl}. Start Comfy Desktop and try again.`);
    next.status = 503;
    next.cause = error;
    throw next;
  }
  if (!response.ok) {
    const error = new Error(`WanBlend could not reach ComfyUI at ${comfyBaseUrl}: ${response.status} ${response.statusText}`);
    error.status = 503;
    throw error;
  }
}

async function uploadImageToComfy(filePath, fileName = "") {
  const extension = path.extname(fileName || filePath).toLowerCase();
  const safeName = `wanblend_${Date.now()}_${randomUUID().slice(0, 8)}${extension || ".png"}`;
  const bytes = await readFile(filePath);
  const form = new FormData();
  form.append("image", new File([bytes], safeName, { type: imageMimeTypes.get(extension) || "image/png" }));
  form.append("type", "input");
  form.append("overwrite", "true");

  const response = await fetch(`${comfyBaseUrl}/upload/image`, {
    method: "POST",
    body: form
  });
  const data = await responseJson(response, "Comfy image upload failed.");
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

async function queueComfyPrompt(prompt, clientId) {
  const response = await fetch(`${comfyBaseUrl}/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, client_id: clientId })
  });
  return responseJson(response, "Comfy prompt queue failed.");
}

async function waitForComfyPrompt(promptId) {
  if (!promptId) {
    const error = new Error("Comfy did not return a prompt id.");
    error.status = 502;
    throw error;
  }

  const timeoutMs = Math.max(60000, Number(process.env.WANBLEND_COMFY_TIMEOUT_MS || process.env.WANWARP_COMFY_TIMEOUT_MS) || defaultComfyTimeoutMs);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${comfyBaseUrl}/history/${encodeURIComponent(promptId)}`);
    const data = await responseJson(response, "Comfy history polling failed.");
    const history = data[promptId];
    if (history) {
      const status = history.status || {};
      if (status.status_str === "error") {
        const error = new Error(status.messages?.at(-1)?.[1]?.exception_message || "Comfy reported a WanBlend error.");
        error.status = 502;
        error.raw = status;
        throw error;
      }
      if (status.status_str === "success") return history;
      if (!status.status_str && history.outputs && Object.keys(history.outputs).length > 0) return history;
    }
    await delay(comfyPollIntervalMs);
  }

  const elapsedMinutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const timeoutMinutes = Math.round(timeoutMs / 60000);
  const error = new Error(`WanBlend timed out waiting for ComfyUI after ${elapsedMinutes} minutes. Comfy prompt id: ${promptId}. The render may still be running in ComfyUI.`);
  error.status = 504;
  error.promptId = promptId;
  error.timeoutMs = timeoutMs;
  error.timeoutMinutes = timeoutMinutes;
  throw error;
}

function findComfyVideo(history, preferredNodeId) {
  const outputs = history?.outputs || {};
  const candidates = [
    ...(outputs[preferredNodeId]?.gifs || []),
    ...Object.values(outputs).flatMap((output) => output?.gifs || [])
  ];
  return candidates.find((item) => String(item?.filename || "").toLowerCase().endsWith(".mp4")) || candidates[0] || null;
}

async function copyComfyVideoToOutput(video, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  if (video.fullpath && existsSync(video.fullpath)) {
    await copyFile(video.fullpath, outputPath);
    return;
  }

  const params = new URLSearchParams({
    filename: video.filename || "",
    subfolder: video.subfolder || "",
    type: video.type || "output"
  });
  const response = await fetch(`${comfyBaseUrl}/view?${params.toString()}`);
  if (!response.ok) {
    const error = new Error(`Could not download Comfy output video: ${response.status} ${response.statusText}`);
    error.status = 502;
    throw error;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, bytes);
}

async function responseJson(response, fallback) {
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Comfy occasionally returns plain text for errors.
  }
  if (!response.ok) {
    const error = new Error(formatComfyError(data) || `${fallback} ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.raw = data;
    throw error;
  }
  return data || {};
}

function formatComfyError(data) {
  const error = data?.error;
  const parts = [];
  const headline = [error?.message, error?.details].map((value) => String(value || "").trim()).filter(Boolean).join(": ");
  if (headline) parts.push(headline);

  const nodeErrors = data?.node_errors && typeof data.node_errors === "object" ? data.node_errors : {};
  Object.entries(nodeErrors).forEach(([nodeId, nodeError]) => {
    const classType = nodeError?.class_type || "Unknown";
    const details = Array.isArray(nodeError?.errors)
      ? nodeError.errors
          .map((item) => [item?.message, item?.details].map((value) => String(value || "").trim()).filter(Boolean).join(": "))
          .filter(Boolean)
          .join("; ")
      : "";
    parts.push(details ? `${classType} #${nodeId}: ${details}` : `${classType} #${nodeId}`);
  });

  const fallback = typeof error === "string" ? error : "";
  return (parts.join(" | ") || fallback).slice(0, 1200);
}

function normalizeChoice(value, choices, fallback) {
  const normalized = String(value ?? "").trim();
  return choices.has(normalized) ? normalized : fallback;
}

function isNewtLocalAssetUrl(value) {
  const raw = String(value || "").trim();
  if (/^\/(?:uploads|outputs|workflow-assets)\//.test(raw)) return true;

  try {
    const parsed = new URL(raw, "http://localhost");
    return /^\/(?:uploads|outputs|workflow-assets)\//.test(decodeURIComponent(parsed.pathname || ""));
  } catch {
    return false;
  }
}

function optionalInteger(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isInteger(number) ? number : undefined;
}

function clampInteger(value, min, max, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

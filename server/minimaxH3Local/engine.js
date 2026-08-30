import { execFile as execFileCallback } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

export const defaultMinimaxH3LocalUrl = "http://127.0.0.1:30010";
export const defaultMinimaxH3LocalModel = "MiniMaxAI/MiniMax-H3";
export const minimaxH3LocalResolution = "768P";

const execFile = promisify(execFileCallback);
let localVariantQueue = Promise.resolve();

export function minimaxH3LocalConfigFromEnv(env = process.env) {
  const url = normalizeMinimaxH3LocalUrl(env.MINIMAX_H3_LOCAL_URL || defaultMinimaxH3LocalUrl);
  const referenceUrl = normalizeMinimaxH3LocalUrl(env.MINIMAX_H3_LOCAL_REF_URL || url);
  const hostMediaRoot = String(env.MINIMAX_H3_LOCAL_HOST_MEDIA_ROOT || "").trim();
  const engineMediaRoot = String(env.MINIMAX_H3_LOCAL_ENGINE_MEDIA_ROOT || "").trim();
  if (Boolean(hostMediaRoot) !== Boolean(engineMediaRoot)) {
    throw new Error("MINIMAX_H3_LOCAL_HOST_MEDIA_ROOT and MINIMAX_H3_LOCAL_ENGINE_MEDIA_ROOT must be configured together.");
  }
  return {
    url,
    referenceUrl,
    model: String(env.MINIMAX_H3_LOCAL_MODEL || defaultMinimaxH3LocalModel).trim() || defaultMinimaxH3LocalModel,
    timeoutMs: positiveInteger(env.MINIMAX_H3_LOCAL_TIMEOUT_MS, 6 * 60 * 60 * 1000),
    pollIntervalMs: positiveInteger(env.MINIMAX_H3_LOCAL_POLL_INTERVAL_MS, 1000),
    wslDistro: safeWslName(env.MINIMAX_H3_LOCAL_WSL_DISTRO, "MINIMAX_H3_LOCAL_WSL_DISTRO"),
    wslUser: safeWslName(env.MINIMAX_H3_LOCAL_WSL_USER || "root", "MINIMAX_H3_LOCAL_WSL_USER"),
    fl2vaService: safeSystemdUnit(env.MINIMAX_H3_LOCAL_WSL_FL2VA_SERVICE || "minimax-h3-fl2va.service"),
    ref2vaService: safeSystemdUnit(env.MINIMAX_H3_LOCAL_WSL_REF2VA_SERVICE || "minimax-h3-ref2va.service"),
    startupTimeoutMs: positiveInteger(env.MINIMAX_H3_LOCAL_STARTUP_TIMEOUT_MS, 30 * 60 * 1000),
    startupPollIntervalMs: positiveInteger(env.MINIMAX_H3_LOCAL_STARTUP_POLL_INTERVAL_MS, 5000),
    hostMediaRoot,
    engineMediaRoot
  };
}

export function normalizeMinimaxH3LocalUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || defaultMinimaxH3LocalUrl).trim());
  } catch {
    throw new Error("MiniMax H3 Local URL must be a valid loopback HTTP URL.");
  }
  const hostname = parsed.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname) || !["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("MiniMax H3 Local URL must use localhost or a loopback address.");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function minimaxH3LocalFileUri(filePath, config = minimaxH3LocalConfigFromEnv()) {
  if (!String(filePath || "").trim()) throw new Error("MiniMax H3 Local input path is missing.");
  const resolvedPath = path.resolve(String(filePath || ""));
  if (!config.hostMediaRoot && !config.engineMediaRoot) return pathToFileURL(resolvedPath).href;

  const hostRoot = path.resolve(config.hostMediaRoot);
  const relativePath = path.relative(hostRoot, resolvedPath);
  if (!relativePath || relativePath === ".") throw new Error("MiniMax H3 Local input must be a file below the configured host media root.");
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("MiniMax H3 Local input is outside MINIMAX_H3_LOCAL_HOST_MEDIA_ROOT.");
  }
  return mappedEngineFileUri(config.engineMediaRoot, relativePath);
}

export function buildMinimaxH3LocalRequest({
  route,
  prompt,
  duration,
  resolution,
  aspectRatio,
  seed,
  model = defaultMinimaxH3LocalModel,
  firstFrameUri = "",
  lastFrameUri = "",
  referenceImageUris = [],
  referenceVideoUris = [],
  referenceAudioUris = [],
  numInferenceSteps = 50,
  flowShift = 12,
  audioFlowShift = 3
} = {}) {
  const normalizedRoute = normalizedLocalRoute(route);
  const normalizedResolution = String(resolution || "").trim().toUpperCase();
  if (normalizedResolution !== minimaxH3LocalResolution) {
    throw new Error(`MiniMax H3 Local currently supports ${minimaxH3LocalResolution} only. Select 768P on the Video Model node.`);
  }

  const seconds = Math.min(15, Math.max(5, Math.round(Number(duration) || 5)));
  const conditions = [];
  if (normalizedRoute === "image-to-video") {
    if (!firstFrameUri) throw new Error("MiniMax H3 Local image-to-video requires a Start Frame.");
    conditions.push({ type: "image", uri: firstFrameUri, role: "keyframe", frame_index: 0 });
    if (lastFrameUri) conditions.push({ type: "image", uri: lastFrameUri, role: "keyframe", frame_index: -1 });
  }
  if (normalizedRoute === "reference-to-video") {
    referenceImageUris.filter(Boolean).forEach((uri) => conditions.push({ type: "image", uri, role: "reference" }));
    referenceVideoUris.filter(Boolean).forEach((uri) => conditions.push({ type: "video", uri, role: "reference" }));
    referenceAudioUris.filter(Boolean).forEach((uri) => conditions.push({ type: "audio", uri, role: "reference" }));
    if (!conditions.length) throw new Error("MiniMax H3 Local reference-to-video requires reference media.");
  }

  const input = {
    model: String(model || defaultMinimaxH3LocalModel).trim() || defaultMinimaxH3LocalModel,
    prompt: String(prompt || "").trim(),
    seconds,
    task: localTaskForRoute(normalizedRoute),
    conditions,
    target: {
      short_edge: 768,
      aspect_ratio: normalizedRoute === "image-to-video" ? "auto" : String(aspectRatio || "16:9"),
      duration_seconds: seconds
    },
    num_outputs_per_prompt: 1,
    num_inference_steps: positiveInteger(numInferenceSteps, 50),
    flow_shift: Number.isFinite(Number(flowShift)) ? Number(flowShift) : 12,
    audio_flow_shift: Number.isFinite(Number(audioFlowShift)) ? Number(audioFlowShift) : 3
  };
  const normalizedSeed = Number(seed);
  if (seed !== "" && seed !== null && seed !== undefined && Number.isInteger(normalizedSeed)) input.seed = normalizedSeed;
  return input;
}

export async function readMinimaxH3LocalStatus({ fetchImpl = fetch, env = process.env } = {}) {
  let config;
  try {
    config = minimaxH3LocalConfigFromEnv(env);
  } catch (error) {
    return { available: false, engine: "SGLang", url: "", message: error.message };
  }

  try {
    const response = await fetchWithTimeout(`${config.url}/health`, {}, 5000, fetchImpl);
    if (!response.ok) {
      return {
        available: false,
        engine: "SGLang",
        url: config.url,
        message: `Local MiniMax H3 returned HTTP ${response.status}.`
      };
    }
    return {
      available: true,
      engine: "SGLang",
      url: config.url,
      referenceUrl: config.referenceUrl,
      model: config.model,
      message: "Local MiniMax H3 is ready."
    };
  } catch (error) {
    return {
      available: false,
      engine: "SGLang",
      url: config.url,
      referenceUrl: config.referenceUrl,
      model: config.model,
      message: `Could not reach Local MiniMax H3 at ${config.url}: ${error.message}`
    };
  }
}

export async function runMinimaxH3LocalJob({
  input,
  fetchImpl = fetch,
  env = process.env,
  onProgress = () => {},
  execFileImpl = execFile
} = {}) {
  const config = minimaxH3LocalConfigFromEnv(env);
  const baseUrl = input?.task === "ref2va" ? config.referenceUrl : config.url;
  if (!config.wslDistro) return runPreparedMinimaxH3LocalJob({ input, fetchImpl, config, baseUrl, onProgress });

  return withLocalVariantLock(async () => {
    await ensureMinimaxH3LocalVariant({ task: input?.task, baseUrl, config, fetchImpl, execFileImpl, onProgress });
    return runPreparedMinimaxH3LocalJob({ input, fetchImpl, config, baseUrl, onProgress });
  });
}

export async function ensureMinimaxH3LocalVariant({
  task,
  baseUrl,
  config,
  fetchImpl = fetch,
  execFileImpl = execFile,
  onProgress = () => {}
} = {}) {
  if (!config?.wslDistro) return;
  const reference = task === "ref2va";
  const service = reference ? config.ref2vaService : config.fl2vaService;
  onProgress({ status: "loading-model", percent: 0, variant: reference ? "ref2va" : "fl2va" });
  try {
    await execFileImpl("wsl.exe", [
      "-d", config.wslDistro,
      "-u", config.wslUser,
      "--", "systemctl", "start", service
    ], { windowsHide: true, timeout: config.startupTimeoutMs });
  } catch (error) {
    const detail = String(error?.stderr || error?.stdout || error?.message || error).trim();
    throw new Error(`Could not start MiniMax H3 ${reference ? "Ref2VA" : "FL2VA"} in WSL: ${detail}`);
  }

  const startedAt = Date.now();
  let lastError = "service is not ready";
  while (Date.now() - startedAt <= config.startupTimeoutMs) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/health`, {}, 5000, fetchImpl);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await wait(config.startupPollIntervalMs);
  }
  throw new Error(`MiniMax H3 ${reference ? "Ref2VA" : "FL2VA"} did not become ready within ${Math.round(config.startupTimeoutMs / 60000)} minutes: ${lastError}`);
}

async function runPreparedMinimaxH3LocalJob({ input, fetchImpl, config, baseUrl, onProgress }) {
  const submitted = await fetchJson(`${baseUrl}/v1/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input || {})
  }, fetchImpl);
  const requestId = String(submitted?.id || submitted?.video_id || submitted?.request_id || "").trim();
  if (!requestId) throw localServiceError("Local MiniMax H3 returned no job id.", submitted);

  onProgress({ status: normalizedJobStatus(submitted?.status) || "queued", percent: progressPercent(submitted), requestId });
  const startedAt = Date.now();
  let job = submitted;
  while (!completedJobStatus(job?.status)) {
    if (failedJobStatus(job?.status)) throw localServiceError(localJobFailureMessage(job), job);
    if (Date.now() - startedAt > config.timeoutMs) {
      throw new Error(`Local MiniMax H3 timed out after ${Math.round(config.timeoutMs / 60000)} minutes. Job ${requestId} may still be running.`);
    }
    await wait(config.pollIntervalMs);
    job = await fetchJson(`${baseUrl}/v1/videos/${encodeURIComponent(requestId)}`, {}, fetchImpl);
    onProgress({ status: normalizedJobStatus(job?.status) || "generating", percent: progressPercent(job), requestId });
  }

  const contentUrl = localContentUrl(job, baseUrl, requestId);
  onProgress({ status: "completed", percent: 100, requestId });
  return {
    requestId,
    contentUrl,
    endpoint: `${baseUrl}/v1/videos`,
    seed: job?.seed ?? submitted?.seed ?? input?.seed ?? null,
    status: job
  };
}

async function withLocalVariantLock(operation) {
  const previous = localVariantQueue;
  let release;
  localVariantQueue = new Promise((resolve) => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

function normalizedLocalRoute(route) {
  const value = String(route || "text-to-video");
  return ["text-to-video", "image-to-video", "reference-to-video"].includes(value) ? value : "text-to-video";
}

function localTaskForRoute(route) {
  if (route === "image-to-video") return "fl2va";
  if (route === "reference-to-video") return "ref2va";
  return "t2va";
}

function mappedEngineFileUri(engineRoot, relativePath) {
  const suffix = relativePath.split(/[\\/]+/).filter(Boolean).map(encodeURIComponent).join("/");
  if (/^file:\/\//i.test(engineRoot)) return `${engineRoot.replace(/\/+$/, "")}/${suffix}`;
  if (/^[A-Za-z]:[\\/]/.test(engineRoot)) return pathToFileURL(path.join(engineRoot, relativePath)).href;
  const normalizedRoot = String(engineRoot).replace(/\\/g, "/").replace(/\/+$/, "");
  return `file://${normalizedRoot.startsWith("/") ? "" : "/"}${normalizedRoot}/${suffix}`;
}

async function fetchJson(url, options, fetchImpl) {
  const response = await fetchWithTimeout(url, options, 60000, fetchImpl);
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: text };
  }
  if (!response.ok) throw localServiceError(`Local MiniMax H3 returned HTTP ${response.status}.`, body);
  return body;
}

async function fetchWithTimeout(url, options, timeoutMs, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function localServiceError(fallback, body) {
  const message = String(body?.error?.message || body?.error || body?.detail || body?.message || fallback).trim() || fallback;
  const error = new Error(message);
  error.status = 502;
  error.localStatus = body;
  return error;
}

function localJobFailureMessage(job) {
  return `Local MiniMax H3 job failed: ${String(job?.error?.message || job?.error || job?.detail || job?.message || job?.status || "unknown error")}`;
}

function normalizedJobStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function completedJobStatus(value) {
  return ["completed", "complete", "succeeded", "success"].includes(normalizedJobStatus(value));
}

function failedJobStatus(value) {
  return ["failed", "error", "cancelled", "canceled"].includes(normalizedJobStatus(value));
}

function progressPercent(job) {
  const value = Number(job?.progress_percent ?? job?.progress?.percent ?? job?.progress ?? job?.percent);
  if (Number.isFinite(value)) return Math.max(0, Math.min(100, value <= 1 ? value * 100 : value));
  return null;
}

function localContentUrl(job, baseUrl, requestId) {
  const candidate = String(job?.output?.url || job?.video?.url || job?.content_url || "").trim();
  if (candidate) return new URL(candidate, `${baseUrl}/`).href;
  return `${baseUrl}/v1/videos/${encodeURIComponent(requestId)}/content`;
}

function positiveInteger(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function safeWslName(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  if (!/^[A-Za-z0-9_.-]+$/.test(normalized)) throw new Error(`${label} contains unsupported characters.`);
  return normalized;
}

function safeSystemdUnit(value) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z0-9_.@-]+\.service$/.test(normalized)) {
    throw new Error("MiniMax H3 WSL service names must be valid .service unit names.");
  }
  return normalized;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

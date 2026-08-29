import { apiErrorMessage } from "../apiErrors.js";

const localApiPort = import.meta.env?.VITE_API_PORT || "3336";
const localApiBaseUrl = `http://127.0.0.1:${localApiPort}`;
const localControlApiPort = import.meta.env?.VITE_CONTROL_API_PORT || "3337";
const localControlApiBaseUrl = `http://127.0.0.1:${localControlApiPort}`;

function ensureOk(response, data, fallbackMessage) {
  if (!response.ok) {
    throw new Error(apiErrorMessage(data?.error ?? data, fallbackMessage || "Request failed."));
  }

  return data;
}

export async function fetchJsonApi(path, options = {}, label = "Request", { retryLocalApi = true, preferClientProxy = false, preferControlServer = false, timeoutMs = 0 } = {}) {
  const requestUrl = preferClientProxy ? path : preferControlServer ? `${localControlApiBaseUrl}${path}` : localApiFetchUrl(path);
  let response;
  try {
    response = await fetchWithTimeout(requestUrl, options, timeoutMs);
  } catch (error) {
    if (retryLocalApi && requestUrl === path && canRetryLocalApi(path)) {
      try {
        const fallbackBaseUrl = preferControlServer ? localControlApiBaseUrl : localApiBaseUrl;
        response = await fetchWithTimeout(`${fallbackBaseUrl}${path}`, options, timeoutMs);
      } catch {
        throw new Error(`${label} failed. Could not reach the local app server. Restart npm run dev and try again. ${error.message || ""}`.trim());
      }
    } else if (requestUrl !== path && retryLocalApi) {
      try {
        response = await fetchWithTimeout(path, options, timeoutMs);
      } catch {
        throw new Error(`${label} failed. Could not reach the local app server. Restart npm run dev and try again. ${error.message || ""}`.trim());
      }
    } else {
      throw new Error(`${label} failed. Could not reach the local app server. Restart npm run dev and try again. ${error.message || ""}`.trim());
    }
  }

  try {
    return {
      response,
      data: await readJsonResponse(response, label)
    };
  } catch (error) {
    if (!retryLocalApi || !error.htmlApiResponse || !canRetryLocalApi(path) || requestUrl !== path) throw error;

    try {
      const healthResponse = await fetch(`${localApiBaseUrl}/api/health`);
      const healthData = await readJsonResponse(healthResponse, "Server health");
      const routeKey = localApiRouteKey(path);
      if (!healthResponse.ok || (routeKey && !healthData?.routes?.[routeKey])) {
        throw new Error("The backend is running, but it does not have the updated API routes.");
      }

      const retryResponse = await fetch(`${localApiBaseUrl}${path}`, options);
      return {
        response: retryResponse,
        data: await readJsonResponse(retryResponse, label)
      };
    } catch (retryError) {
      throw new Error(
        `${label} failed. ${retryError.message || "Could not reach the updated backend route."} Restart npm run dev so the updated server is active.`
      );
    }
  }
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const duration = Math.max(0, Number(timeoutMs) || 0);
  if (!duration || options?.signal) return fetch(url, options);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), duration);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(response, label) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const looksLikeHtml = text.trim().startsWith("<");
    const statusText = response?.status ? `HTTP ${response.status}` : "unknown status";
    const responseUrl = response?.url || "unknown URL";
    const contentType = response?.headers?.get?.("content-type") || "unknown content type";
    const error = new Error(
      `${label} failed. ${
        looksLikeHtml
          ? `The server returned an HTML page instead of API data from ${responseUrl} (${statusText}, ${contentType}). Restart npm run dev so the updated backend route is active.`
          : "The server returned a response that was not valid JSON."
      }`
    );
    error.htmlApiResponse = looksLikeHtml;
    throw error;
  }
}

function localApiFetchUrl(path) {
  if (!canRetryLocalApi(path)) return path;
  return `${localApiBaseUrl}${path}`;
}

function canRetryLocalApi(path) {
  if (!String(path || "").startsWith("/api/")) return false;
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "0.0.0.0";
  return isLocalhost && window.location.port !== localApiPort;
}

function localApiRouteKey(path) {
  if (path.includes("saved-workflows/autosave")) return "workflowAutosave";
  if (path.includes("open-project-output-folder")) return "projectOutputFolder";
  if (path.includes("edit-preview")) return "editPreview";
  if (path.includes("edit-media")) return "editMedia";
  if (path.includes("utility-image")) return "utilityImage";
  if (path.includes("utility-video")) return "utilityVideo";
  if (path.includes("extract-video-frame")) return "extractVideoFrame";
  if (path.includes("color-id-matte")) return "colorIdMatte";
  if (path.includes("composer-frame")) return "composerFrame";
  if (path.includes("composer-poses")) return "composerPoses";
  if (path.includes("preview-inpaint")) return "previewInpaint";
  if (path.includes("run-skill-director")) return "skillDirector";
  if (path.includes("storyboard-qc")) return "storyboardQc";
  if (path.includes("generate-3d")) return "generate3d";
  if (path.includes("preview-output")) return "previewOutput";
  if (path.includes("save-output")) return "saveOutput";
  if (path.includes("settings")) return "settings";
  if (path.includes("comfy-wan")) return "comfyWanStatus";
  return "";
}

async function requestData(path, options, fallbackMessage) {
  const { response, data } = await fetchJsonApi(path, options, fallbackMessage || "Request");
  return ensureOk(response, data, fallbackMessage);
}

export async function getJson(path, fallbackMessage) {
  return requestData(path, { method: "GET" }, fallbackMessage);
}

export async function postJson(path, body, fallbackMessage) {
  return requestData(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  }, fallbackMessage);
}

export async function postForm(path, form, fallbackMessage) {
  return requestData(path, {
    method: "POST",
    body: form
  }, fallbackMessage);
}

export async function deleteJson(path, fallbackMessage) {
  return requestData(path, {
    method: "DELETE"
  }, fallbackMessage);
}

export const historyApi = {
  listSummary({ limit = 200, cursor = "" } = {}) {
    const params = new URLSearchParams({
      summary: "1",
      limit: String(limit)
    });
    if (cursor) params.set("cursor", cursor);
    return getJson(`/api/history?${params.toString()}`, "Could not load generation history.");
  },

  remove(id) {
    return deleteJson(`/api/history/${encodeURIComponent(id)}`, "Could not remove this generation.");
  }
};

export const statsApi = {
  load() {
    return getJson("/api/stats", "Could not load stats.");
  },

  loadHistoryFallback() {
    return getJson("/api/history", "Could not load generation history.");
  }
};

export const generationProgressApi = {
  list() {
    return getJson("/api/generation-progress", "Could not load generation progress.");
  }
};

export const generationApi = {
  generateVideo(form) {
    return postForm("/api/generate", form, "Generation failed.");
  },

  uploadAsset(file) {
    const form = new FormData();
    form.append("asset", file);
    return postForm("/api/node/upload-asset", form, "Could not upload an asset.");
  },

  generateImage(body) {
    return postJson("/api/node/generate-image", body, "Image generation failed.");
  },

  generateNodeVideo(body) {
    return postJson("/api/node/generate-video", body, "Video generation failed.");
  }
};

export const nodeApi = {
  uploadAsset(form, label = "Asset upload") {
    return fetchJsonApi("/api/node/upload-asset", { method: "POST", body: form }, label);
  },

  uploadVideoAsset(form, label = "Video import") {
    return fetchJsonApi("/api/node/upload-video-asset", { method: "POST", body: form }, label);
  },

  uploadTransferCollage(form, label = "Mood Board compile") {
    return fetchJsonApi("/api/node/upload-transfer-collage", { method: "POST", body: form }, label);
  },

  composerFrame(body, label = "Composer capture") {
    return fetchJsonApi("/api/node/composer-frame", jsonBody(body), label);
  },

  processText(body, label = "Text processing") {
    return fetchJsonApi("/api/node/process-text", jsonBody(body), label);
  },

  runSkillDirector(body, label = "Film Director") {
    return fetchJsonApi("/api/node/run-skill-director", jsonBody(body), label);
  },

  qwenCameraEdit(body, label = "Camera edit") {
    return fetchJsonApi("/api/node/qwen-camera-edit", jsonBody(body), label);
  },

  utilityImage(body, label = "Utility image generation") {
    return fetchJsonApi("/api/node/utility-image", jsonBody(body), label);
  },

  colorIdMatte(body, label = "Color ID to Matte") {
    return fetchJsonApi("/api/node/color-id-matte", jsonBody(body), label);
  },

  colorIdMatteForm(form, label = "Color ID to Matte") {
    return fetchJsonApi("/api/node/color-id-matte", { method: "POST", body: form }, label);
  },

  generateImage(body, label = "Image generation") {
    return fetchJsonApi("/api/node/generate-image", jsonBody(body), label);
  },

  previewInpaint(body, label = "Preview inpainting") {
    return fetchJsonApi("/api/node/preview-inpaint", jsonBody(body), label);
  },

  planStoryboard(body, label = "Storyboard planning") {
    return fetchJsonApi("/api/node/storyboard-plan", jsonBody(body), label);
  },

  reviewStoryboardFrame(body, label = "Storyboard frame QC") {
    return fetchJsonApi("/api/node/storyboard-qc", jsonBody(body), label);
  },

  exportStoryboardFrame(body, label = "Storyboard frame export") {
    return fetchJsonApi("/api/node/storyboard-export-frame", jsonBody(body), label);
  },

  exportStoryboardBoard(body, label = "Storyboard board export") {
    return fetchJsonApi("/api/node/storyboard-export-board", jsonBody(body), label);
  },

  generate3d(body, label = "3D generation") {
    return fetchJsonApi("/api/node/generate-3d", jsonBody(body), label);
  },

  generateVideo(body, label = "Video generation") {
    return fetchJsonApi("/api/node/generate-video", jsonBody(body), label);
  },

  utilityVideo(body, label = "Utility video generation") {
    return fetchJsonApi("/api/node/utility-video", jsonBody(body), label);
  },

  saveOutput(body, label = "Output save") {
    return fetchJsonApi("/api/node/save-output", jsonBody(body), label);
  },

  previewOutput(body, label = "Output filename preview") {
    return fetchJsonApi("/api/node/preview-output", jsonBody(body), label);
  },

  editMedia(body, label = "Edit media") {
    return fetchJsonApi("/api/node/edit-media", jsonBody(body), label);
  },

  editPreview(body, label = "Edit preview") {
    return fetchJsonApi("/api/node/edit-preview", jsonBody(body), label);
  },

  assemblyProbe(body, label = "Timeline media probe") {
    return fetchJsonApi("/api/node/assembly-probe", jsonBody(body), label);
  },

  assemblyRender(body, label = "Timeline render") {
    return fetchJsonApi("/api/node/assembly-render", jsonBody(body), label);
  }
};

export const systemApi = {
  selectFolder(body) {
    return systemDialogRequest("/api/system/select-folder", body, "Folder picker");
  },

  selectLoraFile(body) {
    return systemDialogRequest("/api/system/select-lora-file", body, "LoRA file picker");
  },

  selectSavePath(body) {
    return systemDialogRequest("/api/system/select-save-path", body, "Save picker");
  },

  openWorkflowFile(body, label = "Open workflow") {
    return systemDialogRequest("/api/system/open-workflow-file", body, label);
  },

  saveWorkflowFile(body, label = "Save workflow") {
    return controlJsonApi("/api/system/save-workflow-file", jsonBody(body), label, { timeoutMs: 15000 });
  },

  comfyWanStatus({ workflow = "", rootPath = "" } = {}) {
    const params = new URLSearchParams();
    if (workflow) params.set("workflow", workflow);
    if (rootPath) params.set("rootPath", rootPath);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    return getJson(`/api/comfy-wan/status${suffix}`, "Could not check ComfyUI.");
  },

  minimaxH3LocalStatus() {
    return getJson("/api/minimax-h3-local/status", "Could not check Local MiniMax H3.");
  },

  async openProjectOutputFolder(body, label = "Open output folder") {
    const path = "/api/system/open-project-output-folder";
    const lane = await selectControlLane(path, label);
    return controlJsonApi(path, jsonBody(body), label, { preferClientProxy: lane === "proxy", timeoutMs: 5000 });
  },

  projectOutputPath(body) {
    return controlJsonApi("/api/system/project-output-path", jsonBody(body), "Project output path");
  }
};

async function systemDialogRequest(path, body, label) {
  await exitFullscreenForSystemDialog();
  const lane = await selectControlLane(path, label);
  return controlJsonApi(path, jsonBody(body), label, { preferClientProxy: lane === "proxy" });
}

function controlJsonApi(path, options, label, requestOptions = {}) {
  // Generations keep long-lived requests open against the primary API origin.
  // A dedicated loopback origin keeps desktop controls in their own browser
  // connection pool without depending on the Vite proxy.
  return fetchJsonApi(path, options, label, { preferControlServer: true, ...requestOptions });
}

async function controlRequestData(path, options, fallbackMessage) {
  const { response, data } = await controlJsonApi(path, options, fallbackMessage);
  return ensureOk(response, data, fallbackMessage);
}

async function selectControlLane(path, label) {
  if (!canRetryLocalApi(path)) return "direct";

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), 3000);
  try {
    return await Promise.any([
      fetch(`${localControlApiBaseUrl}/api/system/control-health`, { signal: controller.signal })
        .then(requireHealthyResponse)
        .then(() => "direct"),
      fetch("/api/system/control-health", { signal: controller.signal })
        .then(requireHealthyResponse)
        .then(() => "proxy")
    ]);
  } catch {
    throw new Error(`${label} could not open because the local app server is offline. Restart NewtNode and try again.`);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function requireHealthyResponse(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

async function exitFullscreenForSystemDialog() {
  if (typeof document === "undefined") return;

  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }
    if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch {
    // The picker can still open if the browser declines the fullscreen exit.
  }
}

export const settingsApi = {
  load() {
    return getJson("/api/settings?includeSecrets=1", "Could not load settings.");
  },

  save(body) {
    return postJson("/api/settings", body, "Could not save settings.");
  },

  validateKeys() {
    return postJson("/api/settings/validate-keys", {}, "Could not validate API keys.");
  },

  update(body) {
    return postJson("/api/settings/update", body, "Could not update NewtNode.");
  },

  restart() {
    return postJson("/api/settings/restart", {}, "Could not restart NewtNode.");
  }
};

export const composerApi = {
  listPoses() {
    return fetchJsonApi("/api/composer-poses", { method: "GET" }, "Pose library");
  },

  savePose(pose) {
    return fetchJsonApi("/api/composer-poses", jsonBody({ pose }), "Pose save");
  },

  deletePose(poseId) {
    return fetchJsonApi(`/api/composer-poses/${encodeURIComponent(poseId)}`, { method: "DELETE" }, "Pose delete");
  }
};

export const workflowApi = {
  listSummary() {
    return controlRequestData("/api/saved-workflows?summary=1", { method: "GET" }, "Could not load saved workflows.");
  },

  open(fileName) {
    return controlRequestData(`/api/saved-workflows/${encodeURIComponent(fileName)}`, { method: "GET" }, "Could not load workflow.");
  },

  save(workflow) {
    return controlRequestData("/api/saved-workflows", jsonBody(workflow), "Could not save workflow.");
  },

  autosave(body) {
    return controlRequestData("/api/saved-workflows/autosave", jsonBody(body), "Could not autosave workflow.");
  },

  registerPackage(workflow) {
    return controlRequestData("/api/saved-workflows/register-package", jsonBody(workflow), "Could not register workflow package.");
  },

  remove(fileName) {
    return controlRequestData(
      `/api/saved-workflows/${encodeURIComponent(fileName)}`,
      { method: "DELETE" },
      "Could not remove workflow from the dropdown."
    );
  }
};

export const storageApi = {
  diagnostics() {
    return getJson("/api/storage/diagnostics", "Could not load storage diagnostics.");
  }
};

function jsonBody(body) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  };
}

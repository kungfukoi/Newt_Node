export const geminiOmniDisplayName = "Gemini Omni Flash";
export const geminiOmniGoogleModel = "gemini-omni-flash-preview";
export const geminiOmniFalTextEndpoint = "google/gemini-omni-flash";
export const geminiOmniFalImageEndpoint = "google/gemini-omni-flash/image-to-video";
export const geminiOmniFalReferenceEndpoint = "google/gemini-omni-flash/reference-to-video";
export const geminiOmniFalEditEndpoint = "google/gemini-omni-flash/edit";

export function isGeminiOmniModel(model) {
  const normalized = String(model || "").toLowerCase();
  return normalized.includes("gemini") && normalized.includes("omni");
}

export function normalizeGeminiOmniDuration(value) {
  const seconds = Number.parseInt(String(value || "8").match(/\d+/)?.[0] || "8", 10);
  return Math.min(10, Math.max(3, Number.isFinite(seconds) ? seconds : 8));
}

export function normalizeGeminiOmniAspectRatio(value) {
  return String(value || "16:9").includes("9:16") ? "9:16" : "16:9";
}

export function uniqueGeminiOmniReferences(items = [], limit = 6) {
  const seen = new Set();
  return items
    .filter((item) => {
      const url = String(item?.url || "").trim();
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    })
    .slice(0, limit);
}

export function buildGeminiOmniPrompt({ prompt, hasStartFrame = false, references = [], generateAudio = true }) {
  const declarations = [];
  const tagMap = new Map();
  let imagePosition = 1;
  let imageReferenceIndex = 0;
  let videoPosition = 1;
  let videoReferenceIndex = 0;

  if (hasStartFrame) {
    declarations.push(`[# Sources <FIRST_FRAME>@Image${imagePosition}]`);
    imagePosition += 1;
  }

  references.forEach((reference) => {
    const isVideo = reference?.type === "video";
    const token = isVideo ? `<VIDEO_REF_${videoReferenceIndex}>` : `<IMAGE_REF_${imageReferenceIndex}>`;
    declarations.push(isVideo ? `[# References ${token}@Video${videoPosition}]` : `[# References ${token}@Image${imagePosition}]`);
    if (isVideo) {
      videoReferenceIndex += 1;
      videoPosition += 1;
    } else {
      imageReferenceIndex += 1;
      imagePosition += 1;
    }

    const label = cleanGeminiOmniTag(reference?.label || reference?.tag);
    if (label) tagMap.set(label.toLowerCase(), token);
  });

  let rewrittenPrompt = String(prompt || "").trim();
  rewrittenPrompt = rewrittenPrompt.replace(/@([A-Za-z0-9_-]+)/g, (match, name) => tagMap.get(name.toLowerCase()) || match);

  const guidance = [];
  if (hasStartFrame) guidance.push("Use the first image as the starting frame.");
  if (references.some((reference) => reference?.type !== "video")) guidance.push("Use the remaining images as visual references, not literal initial frames.");
  if (references.some((reference) => reference?.type === "video")) guidance.push("Use the video references as editable motion and appearance sources for the requested transformation.");
  guidance.push(generateAudio ? "Generate synchronized natural audio as directed by the scene." : "No dialogue, music, ambience, or sound effects. Output silent video.");

  return [declarations.join(" "), rewrittenPrompt, guidance.join(" ")].filter(Boolean).join("\n\n");
}

export function buildGeminiOmniEditPrompt({ prompt, generateAudio = true } = {}) {
  const instruction = String(prompt || "").trim();
  const preserveInstruction = "Keep everything else the same.";
  const alreadyPreserves = /\b(keep|preserve|retain|maintain)\b[\s\S]{0,80}\b(same|rest|everything|timing|framing|motion|composition|continuity)\b/i.test(instruction);
  return [
    instruction || "Edit the source video.",
    alreadyPreserves ? "" : preserveInstruction
  ].filter(Boolean).join(" ");
}

export function buildGeminiOmniFalInput({ prompt, aspectRatio = "16:9", durationSeconds = 8, media = [] } = {}) {
  const videoUrls = uniqueMediaUrls(media.filter((item) => item?.type === "video").map((item) => item?.url));
  if (videoUrls.length) {
    return {
      prompt,
      video_url: videoUrls.at(-1)
    };
  }

  const firstFrameUrls = uniqueMediaUrls(media.filter((item) => item?.role === "first-frame").map((item) => item?.url));
  const imageReferenceUrls = uniqueMediaUrls(media.filter((item) => item?.type !== "video" && item?.role !== "first-frame").map((item) => item?.url));
  const input = {
    prompt,
    aspect_ratio: aspectRatio,
    duration: durationSeconds
  };
  if (imageReferenceUrls.length) {
    input.image_urls = uniqueMediaUrls([...firstFrameUrls, ...imageReferenceUrls]);
  } else if (firstFrameUrls.length) {
    input.image_url = firstFrameUrls[0];
  }
  return input;
}

export function buildGeminiOmniGoogleInput({ prompt, media = [] } = {}) {
  const content = [];

  media.forEach((item) => {
    const type = item?.type === "video" ? "video" : item?.type === "image" ? "image" : "";
    if (!type) return;

    const data = String(item?.data || "").trim();
    const uri = String(item?.uri || "").trim();
    if (!data && !uri) return;

    const mimeType = String(item?.mimeType || item?.mime_type || (type === "video" ? "video/mp4" : "image/png")).trim();
    const part = { type, mime_type: mimeType };
    if (uri) {
      part.uri = uri;
    } else {
      part.data = data;
    }
    content.push(part);
  });

  content.push({ type: "text", text: normalizeGeminiOmniGoogleText(prompt) });
  return content.some((item) => item.type === "video")
    ? [{ type: "user_input", content }]
    : content;
}

export function normalizeGeminiOmniGoogleText(value) {
  return Array.from(String(value || "").trim())
    .map((character) => {
      const code = character.codePointAt(0);
      if (code === 0x2018 || code === 0x2019 || code === 0x201A || code === 0x201B) return "'";
      if (code === 0x201C || code === 0x201D || code === 0x201E || code === 0x201F) return "\"";
      if (code === 0x2013 || code === 0x2014 || code === 0x2212) return "-";
      if (code === 0x2026) return "...";
      if (code === 0x00A0) return " ";
      if (code > 255) return "";
      if (code < 32 && character !== "\n" && character !== "\r" && character !== "\t") return " ";
      return character;
    })
    .join("")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function buildGeminiOmniGoogleRequestBody({
  model = geminiOmniGoogleModel,
  prompt,
  media = [],
  aspectRatio = "16:9",
  task = "text_to_video"
} = {}) {
  const input = buildGeminiOmniGoogleInput({ prompt, media });
  const hasVideoReference = input.some((item) => Array.isArray(item?.content) && item.content.some((part) => part?.type === "video"));
  const body = {
    model,
    input,
    response_format: hasVideoReference
      ? { type: "video", delivery: "uri" }
      : { type: "video", aspect_ratio: aspectRatio, delivery: "uri" },
    background: false,
    store: true,
    stream: false
  };

  if (!hasVideoReference) {
    body.generation_config = { video_config: { task } };
  }

  return body;
}

function uniqueMediaUrls(urls = []) {
  const seen = new Set();
  return urls
    .map((url) => String(url || "").trim())
    .filter((url) => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

function cleanGeminiOmniTag(value) {
  return String(value || "")
    .replace(/^@+/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "")
    .slice(0, 64);
}

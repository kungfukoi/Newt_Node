export const defaultFalTextModel = "openai/gpt-5.6-terra";
export const defaultFalVideoTextModel = "google/gemini-3.1-pro-preview";
export const falVideoTextEndpoint = "openrouter/router/video";

export function nativeVideoAnalysisInput({ videoUrls = [], videoInputs = [], model = defaultFalVideoTextModel } = {}) {
  return {
    video_urls: videoUrls,
    prompt: nativeVideoAnalysisPrompt(videoInputs),
    system_prompt: "Return only concise, production-useful video context. Do not use markdown.",
    model,
    reasoning: true
  };
}

export function nativeVideoAnalysisPrompt(videoInputs = []) {
  const labels = videoInputs
    .map((item, index) => `Video ${index + 1}: ${item?.label || "Connected video"}`)
    .join("\n");

  return [
    "Analyze the connected videos in order as native video, including their temporal progression and audio when present.",
    labels ? `Video labels:\n${labels}` : "",
    "Describe the subjects, actions, blocking, setting, shot progression, lighting, visual style, mood, continuity, dialogue, narration, music, and important sound cues.",
    "Identify camera behavior precisely when visible: locked-off, pan, tilt, push-in, pull-back, optical zoom, handheld motion, tracking, orbit, crane, pedestal, roll, rack focus, or reframing.",
    "Include timestamps for important actions, cuts, and camera changes. Distinguish subject motion from camera motion and qualify anything uncertain.",
    "Return concise, production-useful prompt context rather than a transcript unless spoken words materially affect the result."
  ]
    .filter(Boolean)
    .join("\n\n");
}

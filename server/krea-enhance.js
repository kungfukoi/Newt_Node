// Request adapters for the public Krea OpenAPI checked 2026-10-21.
const generativeModels = ["Recovery", "Redefine", "Recovery V2", "Standard MAX", "Wonder 3"];
export const kreaTopazImageModels = ["Standard V2", "Low Resolution V2", "CGI", "High Fidelity V2", "Text Refine", ...generativeModels];
export const kreaTopazVideoModels = { "Proteus": "prob-4", "Artemis HQ": "ahq-12", "Artemis MQ": "amq-13", "Artemis LQ": "alq-13", "Nyx": "nyx-3", "Nyx Fast": "nxf-1", "Gaia HQ": "ghq-5", "Gaia CG": "gcg-5", "Starlight HQ": "thd-3", "Starlight Mini": "thm-2", "Starlight Sharp": "thf-4" };
const specialVideoModels = { "Starlight Precise 2": "starlight-precise", "Starlight Precise 2.5": "starlight-precise-25" };
export function kreaEnhanceEndpoint(model, body = {}) {
  if (model === "Topaz Image Upscale") return "/generate/enhance/topaz/" + (generativeModels.includes(body.topazImageUpscaler?.model) ? "generative-enhance" : "standard-enhance");
  if (model === "Topaz Video Upscale") return "/generate/enhance/topaz/" + (specialVideoModels[body.topazVideoUpscaler?.model] || "video-upscale");
  if (model === "Flux Video Upscale") return "/generate/enhance/black-forest-labs/flux-video-upscale";
  if (model === "Topaz SDR to HDR") return "/generate/enhance/topaz/hyperion";
  return "";
}
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const number = (value, fallback) => value === undefined || value === "" ? fallback : Number(value);
export function buildKreaEnhanceInput(model, body, metadata, url) {
  if (model === "Flux Video Upscale") {
    const options = body.fluxVideoUpscale || {};
    return { video_url: url, upscale_factor: Math.min(3, Math.max(1.5, number(options.upscaleFactor, 2))), creativity: Number(options.creativity) === 0 ? "precise" : "creative", ...(body.prompt ? { prompt: body.prompt } : {}) };
  }
  if (model === "Topaz SDR to HDR") {
    return { video_url: url, frame_interpolation: false, crop_to_fit: false, video_output_preset: body.topazSdrToHdr?.outputFormat === "prores" ? "prores-422-hq" : "h265-main10" };
  }
  if (model === "Topaz Image Upscale") {
    const options = body.topazImageUpscaler || {};
    const selected = options.model || "Standard V2";
    if (!kreaTopazImageModels.includes(selected)) fail(`${selected} is unavailable through Krea's Topaz image API. Choose ${kreaTopazImageModels.join(", ")} or use Fal.`);
    const scale = number(options.upscaleFactor, 2);
    const input = { image_url: url, width: Math.round(metadata.width * scale), height: Math.round(metadata.height * scale), model: selected,
      image_scaling_factor: scale, upscaling_activated: true, crop_to_fill: Boolean(options.cropToFill), output_format: options.outputFormat === "jpeg" ? "jpg" : "png",
      subject_detection: options.subjectDetection || "All", face_enhancement: options.faceEnhancement !== false,
      face_enhancement_creativity: number(options.faceEnhancementCreativity, 0), face_enhancement_strength: number(options.faceEnhancementStrength, 0.8),
      sharpen: number(options.sharpen, 0.5), denoise: number(options.denoise, 0.5), fix_compression: number(options.fixCompression, 0.5), strength: number(options.strength, 0.5), prompt: options.prompt || "" };
    if (input.width > 32000 || input.height > 32000) fail("Krea Topaz output must be at most 32000 pixels per side.");
    if (generativeModels.includes(selected)) {
      delete input.fix_compression; delete input.strength;
      Object.assign(input, { creativity: number(options.creativity, 3), texture: number(options.texture, 3), detail: number(options.detail, 0.5) });
    }
    return input;
  }
  if (model === "Topaz Video Upscale") {
    const options = body.topazVideoUpscaler || {};
    const selected = options.model || "Proteus";
    if (!kreaTopazVideoModels[selected] && !specialVideoModels[selected]) fail(`${selected} is unavailable through Krea's Topaz video API. Choose ${Object.keys(kreaTopazVideoModels).join(", ")} or use Fal.`);
    const scale = number(options.upscaleFactor, 2);
    if (metadata.width * scale > 8000 || metadata.height * scale > 8000) fail("Krea Topaz output must be at most 8000 pixels per side.");
    const fps = Number(options.targetFps);
    const base = { video_url: url, target_width: Math.round(metadata.width * scale), target_height: Math.round(metadata.height * scale), crop_to_fit: false,
      frame_interpolation: Number.isFinite(fps) && fps > 0, ...(fps > 0 ? { frame_interpolation_fps: Math.min(240, Math.max(15, fps)) } : {}), video_output_preset: options.h264Output ? "h264-high" : "h265-main" };
    if (specialVideoModels[selected]) return base;
    return { ...base,
      enhancement: true, enhancement_video_type: "Progressive", enhancement_model: kreaTopazVideoModels[selected], enhancement_parameters: "Manual",
      enhancement_compression: number(options.compression, 0.1), enhancement_recover_details: number(options.recoverDetail, 0.7), enhancement_reduce_noise: number(options.noise, 0.3), enhancement_reduce_halo: number(options.halo, 0.4),
      frame_interpolation: Number.isFinite(fps) && fps > 0, ...(fps > 0 ? { frame_interpolation_fps: Math.min(240, Math.max(15, fps)) } : {}),
      grain: number(options.grain, 0) > 0, grain_strength: number(options.grain, 0), video_output_preset: options.h264Output ? "h264-high" : "h265-main" };
  }
  fail(`${model} is unavailable through Krea.`);
}

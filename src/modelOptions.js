export const characterTraitOptions = ["serious", "pleasant", "happy", "angry", "sad", "silly", "confident", "content", "excited", "passionate", "fanatic", "anxious", "scared", "arrogant", "stubborn", "curious"];
export const batchOptions = ["1", "2", "3", "4"];
export const imageBatchOptions = Array.from({ length: 9 }, (_value, index) => String(index + 1));
export const imageModelAutoAspectRatio = "Auto";
export const imageModelNames = {
  zImage: "Z-Image",
  nanoBananaPro: "Nano Banana Pro",
  openAiImage2: "OpenAI Image 2",
  krea2Large: "Krea 2 Large",
  lumaDreamMachine: "Luma Dream Machine"
};
export const imageModelOptions = [
  imageModelNames.zImage,
  imageModelNames.nanoBananaPro,
  imageModelNames.openAiImage2,
  imageModelNames.krea2Large,
  imageModelNames.lumaDreamMachine
];
export const nanoImageAspectRatios = ["21:9", "16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4"];
export const openAiImageAspectRatios = nanoImageAspectRatios;
export const krea2AspectRatios = ["16:9", "1:1", "4:3", "3:2", "2.35:1", "4:5", "2:3", "9:16"];
export const krea2CreativityOptions = ["raw", "low", "medium", "high"];
export const lumaImageAspectRatios = ["21:9", "16:9", "9:16", "1:1", "4:3", "3:4", "9:21"];
export const imageResolutionOptions = ["2K", "1K", "4K"];
export const seedanceVideoDurationOptions = ["15 seconds", "10 seconds", "5 seconds"];
export const seedanceVideoResolutionOptions = ["720p", "480p", "1080p"];
export const seedanceVideoAspectRatioOptions = ["16:9 (Landscape)", "21:9", "9:16 (Portrait)", "1:1"];
export const lumaVideoDurationOptions = ["5 seconds", "9 seconds"];
export const lumaVideoResolutionOptions = ["540p", "720p", "1080p"];
export const lumaVideoAspectRatioOptions = ["16:9", "9:16", "4:3", "3:4", "21:9", "9:21"];
export const happyHorseDurationOptions = Array.from({ length: 13 }, (_value, index) => `${index + 3} seconds`);
export const voidVideoFrameOptions = [69, 77, 85, 93, 101, 109, 117, 125, 133, 141, 149, 157, 165, 173, 181, 189, 197];

export const stylePresetPrompts = {
  None: "",
  Cinematic:
    "High-end cinematic still frame, shot on ARRI Alexa 35, high quality prime lens, high dynamic range, shallow depth of field, atmospheric cinematography, high production value, feature film look.",
  Storyboard:
    "Hand-drawn digital storyboard frame, black ink line drawing with minimal grayscale shading, cinematic composition, production-planning style, loose but intentional drawing, simple tonal blocking, clear visual storytelling. A black and white line drawing. No color. No pencil or charcoal sketches. Not a realistic black-and-white photograph, not photorealistic grayscale, no photographic skin texture, no photo lighting, no 3D render. No text or numbers unless described. No frame borders.",
  Commercial:
    "Polished commercial image, premium advertising style, clean composition, bright refined lighting, shallow depth of field, elevated brand look, modern campaign aesthetic, crisp details, visually appealing.",
  Anime:
    "Stylized anime illustration, clean linework, expressive design, cinematic art lighting, vibrant controlled color palette, detailed background art, dynamic framing, polished animated look, emotionally engaging atmosphere.",
  Claymation:
    "Handmade claymation style, stop-motion look, sculpted clay characters, environment, and props, tactile surfaces, visible handmade imperfections, miniature set design, soft lighting, charming handcrafted aesthetic.",
  "2D Animation":
    "Clean 2D animation style, bold graphic shapes, smooth color blocking, expressive poses, simplified forms, clear silhouettes, modern animated design, playful and readable composition.",
  "3D Animation":
    "Stylized 3D animation look, polished modeling, soft global illumination, appealing textures, expressive forms, cinematic framing, animated feature quality, clean rendering, vibrant and dimensional.",
  "Dark as Fuk":
    "Haunting atmospheric style, eerie stillness, very disturbing and unsettling mood, quiet tension, ghostly lighting, muted colors, shadows, liminal spaces, subtle surreal details, lonely composition, restrained horror tone, dreamlike unease, beautiful but disturbing visual atmosphere.",
  "Pop as Fuk":
    "Poppy fun style, bright bold colors, playful composition, energetic, upbeat mood, glossy visual polish, cheerful, vibrant contrast, whimsical details, modern campaign-ready look, colorful and instantly engaging, super poppy music video vibes.",
  "Sexy as Fuk":
    "High-fashion edgy style, natural, anatomy allure, elegant sensuality, bare skin, bare anatomy, minimal, sculptural, flattering dramatic lighting, skin highlights, premium fashion photography, magnetic presence, sophisticated mood, form and shape, soft skin texture, risky high fashion, edgy.",
  "Strange as Fuk":
    "Strange surreal style, offbeat visual logic, unexpected shapes, odd proportions, unusual textures, dreamlike atmosphere, slightly unsettling but playful tone, surreal composition, imaginative art direction, weird in a smart and intentional way, strange morphs, unexpected abstract realism.",
  "Custom Palette": ""
};
export const stylePresetNames = Object.keys(stylePresetPrompts);

export const shotPresetPrompts = {
  None: "",
  CU: "A close up shot.",
  MS: "A medium shot.",
  WS: "A wide shot.",
  ECU: "An extreme close up shot.",
  EWS: "An extreme wide shot."
};
export const lensPresetPrompts = {
  None: "",
  "18mm": "Shot on a wide 18mm prime lens.",
  "35mm": "Shot on a wide 35mm prime lens.",
  "50mm": "Shot on a 50mm prime lens.",
  "85mm": "Shot on a long 85mm prime lens.",
  "120mm": "Shot on a long 120mm prime lens.",
  Macro: "Shot on a macro probe lens."
};
export const typePresetPrompts = {
  None: "",
  "Low Angle": "A low angle shot.",
  "High Angle": "A high angle shot.",
  "Extreme High": "A bird's eye view from extremely high angled shot.",
  "Extreme Low": "A worm's eye view from extremely low angled shot.",
  Portrait: "A portrait shot.",
  Profile: "A profile shot."
};
export const shotPresetNames = Object.keys(shotPresetPrompts);
export const lensPresetNames = Object.keys(lensPresetPrompts);
export const typePresetNames = Object.keys(typePresetPrompts);

export const qwenCameraDefaults = {
  horizontalAngle: 90,
  verticalAngle: 0,
  zoom: 5,
  additionalPrompt: "",
  loraScale: 1,
  guidanceScale: 4.5,
  numInferenceSteps: 28
};

export const videoModelNames = {
  seedance: "Seedance 2.0",
  seedanceFast: "Seedance 2.0 Fast",
  lumaDreamMachine: "Luma Dream Machine",
  happyHorse: "Happy Horse",
  wanFunControl: "Wan Fun Control",
  wan27Reference: "Wan 2.7 Reference-to-Video",
  aurora: "Creatify Aurora",
  sam3Video: "SAM 3 Video"
};
export const videoModelOptions = [
  videoModelNames.seedance,
  videoModelNames.seedanceFast,
  videoModelNames.wan27Reference,
  videoModelNames.happyHorse,
  videoModelNames.lumaDreamMachine,
  videoModelNames.aurora
];
export const videoWorkspaceModelOptions = videoModelOptions.filter((model) => model !== videoModelNames.aurora);
export const wan27ReferenceDurationOptions = ["2 seconds", "3 seconds", "4 seconds", "5 seconds", "6 seconds", "7 seconds", "8 seconds", "9 seconds", "10 seconds"];
export const wan27ReferenceResolutionOptions = ["1080p", "720p"];
export const wan27ReferenceAspectRatioOptions = ["16:9", "9:16", "1:1", "4:3", "3:4"];

export const model3DNames = {
  hunyuanPro: "Hunyuan 3D 3.1 Pro"
};
export const model3DViewInputs = [
  { id: "frontImageIn", view: "front", label: "Front" },
  { id: "backImageIn", view: "back", label: "Back" },
  { id: "leftImageIn", view: "left", label: "Left" },
  { id: "rightImageIn", view: "right", label: "Right" },
  { id: "topImageIn", view: "top", label: "Top" },
  { id: "bottomImageIn", view: "bottom", label: "Bottom" },
  { id: "leftFrontImageIn", view: "leftFront", label: "Left Front" },
  { id: "rightFrontImageIn", view: "rightFront", label: "Right Front" }
];
export const model3DDescription =
  "Generates a GLB 3D model from connected view images. Front is required; Back, Left, Right, Top, Bottom, Left Front, and Right Front are optional.";

export const utilityImageModelNames = {
  colorIdMatte: "Color ID to Matte",
  imageToId: "Image to Color ID",
  qwenCameraEdit: "Qwen Camera Edit",
  stillFrame: "Grab Still Frame",
  dwpose: "DWPose",
  depthAnything: "Depth Anything",
  topazUpscaler: "Topaz Image Upscale",
  patina: "Patina",
  sam3Image: "SAM 3 Image",
  birefnetImage: "BiRefNet Image"
};
export const utilityImageModelOptions = [
  utilityImageModelNames.colorIdMatte,
  utilityImageModelNames.imageToId,
  utilityImageModelNames.stillFrame,
  utilityImageModelNames.dwpose,
  utilityImageModelNames.depthAnything,
  utilityImageModelNames.topazUpscaler,
  utilityImageModelNames.patina,
  utilityImageModelNames.birefnetImage,
  utilityImageModelNames.sam3Image
];
export const utilityImageToIdPrompt = `Create a professional Cryptomatte-style ID matte / segmentation map from the input image.

Analyze the entire image and separate every distinct object, character, prop, material group, clothing element, foreground object, background object, and environmental region into individual flat-color masks.

CRITICAL REQUIREMENT:
No two segmented objects with different IDs are allowed to share the exact same edge boundary color contact in an ambiguous way. Adjacent object regions must remain visually and mathematically separable for clean matte extraction.

IMPORTANT EDGE SEPARATION RULES:

* Every object must have its own completely unique solid RGB color.
* Adjacent objects must NEVER use similar hues or values.
* Neighboring segmentation regions must maintain crisp separation.
* Prevent color bleeding between objects.
* Preserve ultra-clean object boundaries.
* Prioritize matte extraction usability over artistic appearance.
* Do not merge touching objects into one region unless they are truly the same object.
* Create slight separation logic between tightly packed objects so masks remain individually selectable.
* Ensure thin objects, overlapping objects, and touching surfaces remain independently isolated.
* Preserve internal negative space and holes accurately.
* Complex intersections like hair, fingers, cables, reflections, transparent objects, paint splashes, smoke, cloth folds, and layered surfaces should still produce readable isolated IDs.

STYLE RULES:

* Flat colors only.
* No gradients.
* No shading.
* No lighting.
* No texture.
* No reflections.
* No transparency.
* No glow.
* No antialiasing blur.
* No outlines unless necessary for separation clarity.
* No labels, text, numbers, symbols, or UI.
* No artistic stylization.

TECHNICAL GOAL:
The result should function like a real VFX Cryptomatte or segmentation EXR utility pass intended for compositing software such as Nuke, Fusion, or After Effects.

The output should:

* allow fast color-based object selection
* isolate objects cleanly with magic wand or color picker tools
* maximize clean keyability
* maintain stable object regions
* avoid adjacent same-color contamination
* preserve original object silhouettes precisely

VISUAL STYLE:
flat segmentation map, cryptomatte preview, object ID matte, VFX utility render pass, machine vision segmentation map, semantic segmentation visualization, clean RGB object isolation pass.

The final output should resemble a professionally rendered Cryptomatte pass generated from a high-end CG renderer.`;
export const colorIdToMatteImageEditPrompt = `Use the connected image labeled "Original RGB source image" as the original image when it is available. Otherwise, use the user's other connected RGB/source image reference as the original image. Use the connected black-and-white image labeled "Color ID to Matte edit mask" as the edit mask for this Image Model run.

The user's prompt describes the desired change. Apply that change only inside the white matte region. Treat black regions as locked original-image content. Treat gray or softened edge pixels, if present, as feathered transition pixels.

Do not render the matte itself. Do not add visible mask outlines, halos, seams, borders, glow, blur rings, color fringes, or hard edges. Blend the edited region naturally into the original image by matching lighting, color, texture, shadows, reflections, camera perspective, depth of field, grain, and compression. Preserve all unmasked subjects, objects, background areas, framing, resolution, and aspect ratio.`;
export const patinaMapOptions = [
  { id: "basecolor", label: "Basecolor" },
  { id: "normal", label: "Normal" },
  { id: "roughness", label: "Roughness" },
  { id: "metalness", label: "Metalness" },
  { id: "height", label: "Height" }
];
export const utilityVideoModelNames = {
  wanFunControl: "Wan Fun Control",
  extractFrame: "Extract Frame",
  colorIdMatte: "Color ID to Matte",
  compositeVideo: "Composite Video",
  depthAnythingVideo: "Depth Anything Video",
  wanBlend: "WanBlend",
  videoStitch: "WanWarp",
  transitionBuilder: "WanSegment",
  wanVaceMaskToVideo: "Wan VACE Mask-to-Video",
  wanVaceInpainting: "Wan VACE 14B Inpainting",
  wan22A14bT2v: "Wan 2.2 A14B LoRA Text-to-Video",
  wan22A14bI2v: "Wan 2.2 A14B LoRA Image-to-Video",
  wan22VaceDepth: "Wan 2.2 VACE Fun A14B Depth",
  wan22VacePose: "Wan 2.2 VACE Fun A14B Pose",
  wan22VaceInpainting: "Wan 2.2 VACE Fun A14B Inpainting",
  sam3Video: "SAM 3 Video",
  voidVideoInpainting: "VOID Video Inpainting",
  birefnetVideo: "BiRefNet Video",
  rifeVideo: "RIFE Video",
  bytedanceUpscaler: "Bytedance Video Upscaler",
  topazUpscaler: "Topaz Video Upscale"
};
export const utilityVideoModelOptions = [
  utilityVideoModelNames.wanFunControl,
  utilityVideoModelNames.extractFrame,
  utilityVideoModelNames.colorIdMatte,
  utilityVideoModelNames.compositeVideo,
  utilityVideoModelNames.depthAnythingVideo,
  utilityVideoModelNames.wanBlend,
  utilityVideoModelNames.videoStitch,
  utilityVideoModelNames.transitionBuilder,
  utilityVideoModelNames.wanVaceMaskToVideo,
  utilityVideoModelNames.wanVaceInpainting,
  utilityVideoModelNames.wan22A14bT2v,
  utilityVideoModelNames.wan22A14bI2v,
  utilityVideoModelNames.wan22VaceDepth,
  utilityVideoModelNames.wan22VacePose,
  utilityVideoModelNames.wan22VaceInpainting,
  utilityVideoModelNames.sam3Video,
  utilityVideoModelNames.voidVideoInpainting,
  utilityVideoModelNames.birefnetVideo,
  utilityVideoModelNames.rifeVideo,
  utilityVideoModelNames.bytedanceUpscaler,
  utilityVideoModelNames.topazUpscaler
];

export const modelPreferenceGroups = {
  image: imageModelOptions,
  video: videoModelOptions,
  utilityImage: utilityImageModelOptions,
  utilityVideo: utilityVideoModelOptions
};
export const defaultModelPreferences = Object.fromEntries(
  Object.entries(modelPreferenceGroups).map(([kind, options]) => [kind, Object.fromEntries(options.map((model) => [model, true]))])
);
export function normalizeModelPreferences(value = {}) {
  const normalized = {};

  Object.entries(modelPreferenceGroups).forEach(([kind, options]) => {
    const incoming = value?.[kind] && typeof value[kind] === "object" ? value[kind] : {};
    normalized[kind] = Object.fromEntries(options.map((model) => [model, Boolean(incoming[model] ?? defaultModelPreferences[kind]?.[model])]));
    if (!Object.values(normalized[kind]).some(Boolean) && options[0]) normalized[kind][options[0]] = true;
  });

  return normalized;
}
export function enabledImageModelOptions(preferences) {
  const normalized = normalizeModelPreferences(preferences);
  return imageModelOptions.filter((model) => normalized.image[model]);
}
export function enabledVideoModelOptions(preferences, { workspaceOnly = false } = {}) {
  const normalized = normalizeModelPreferences(preferences);
  const options = workspaceOnly ? videoWorkspaceModelOptions : videoModelOptions;
  return options.filter((model) => normalized.video[model]);
}
export function enabledUtilityImageModelOptions(preferences) {
  const normalized = normalizeModelPreferences(preferences);
  return utilityImageModelOptions.filter((model) => normalized.utilityImage[model]);
}
export function enabledUtilityVideoModelOptions(preferences) {
  const normalized = normalizeModelPreferences(preferences);
  return utilityVideoModelOptions.filter((model) => normalized.utilityVideo[model]);
}
export function firstEnabledImageModel(preferences) {
  return enabledImageModelOptions(preferences)[0] || imageModelNames.zImage;
}
export function firstEnabledVideoModel(preferences, { workspaceOnly = false } = {}) {
  return enabledVideoModelOptions(preferences, { workspaceOnly })[0] || videoModelNames.seedance;
}

export const birefnetModelOptions = ["General Use (Light)", "General Use (Light 2K)", "General Use (Heavy)", "Matting", "Portrait", "General Use (Dynamic)"];
export const birefnetResolutionOptions = ["1024x1024", "2048x2048", "2304x2304"];
export const depthAnythingVideoModelOptions = ["VDA-Small", "VDA-Base", "VDA-Large"];
export const depthAnythingVideoColormapOptions = ["grayscale", "turbo", "inferno", "magma", "viridis"];
export const depthAnythingVideoResolutionOptions = ["auto", "360p", "480p", "720p", "1080p"];
export const bytedanceUpscalerResolutionOptions = ["1080p", "2k", "4k"];
export const bytedanceUpscalerFpsOptions = ["30fps", "60fps"];
export const bytedanceUpscalerPresetOptions = ["general", "ugc", "short_series", "aigc", "old_film"];
export const bytedanceUpscalerTierOptions = ["fast", "standard", "pro"];
export const bytedanceUpscalerFidelityOptions = ["high", "medium"];
export const topazImageUpscalerModelOptions = [
  "Low Resolution V2",
  "Standard V2",
  "CGI",
  "High Fidelity V2",
  "Text Refine",
  "Recovery",
  "Redefine",
  "Recovery V2",
  "Standard MAX",
  "Wonder",
  "Wonder 3"
];
export const topazImageUpscalerOutputFormatOptions = ["png", "jpeg"];
export const topazImageUpscalerSubjectOptions = ["All", "Foreground", "Background"];
export const topazImageUpscalerEnhancementStrengthOptions = ["auto", "low", "medium", "high"];
export const topazUpscalerModelOptions = [
  "Proteus",
  "Artemis HQ",
  "Artemis MQ",
  "Artemis LQ",
  "Nyx",
  "Nyx Fast",
  "Nyx XL",
  "Nyx HF",
  "Gaia HQ",
  "Gaia CG",
  "Gaia 2",
  "Starlight Precise 1",
  "Starlight Precise 2",
  "Starlight Precise 2.5",
  "Starlight HQ",
  "Starlight Mini",
  "Starlight Sharp",
  "Starlight Fast 1",
  "Starlight Fast 2"
];
export const topazUpscalerFpsOptions = ["source", "30", "60"];
export const topazUpscalerBillingTierOptions = [
  ["auto", "Auto"],
  ["up-to-720p", "Up to 720p"],
  ["720p-1080p", "720p to 1080p"],
  ["above-1080p", "Above 1080p"]
];
export const colorIdMatteVideoOutputOptions = [
  ["mp4", "MP4 mask"],
  ["webm", "WebM mask"],
  ["mov", "ProRes mask"]
];
export const wan22A14bResolutionOptions = ["480p", "580p", "720p"];
export const wan22A14bT2vAspectRatioOptions = ["16:9", "9:16", "1:1"];
export const wan22A14bI2vAspectRatioOptions = ["auto", "16:9", "9:16", "1:1"];
export const wan22A14bAccelerationOptions = ["regular", "none"];
export const wan22A14bInterpolatorOptions = ["none", "film", "rife"];
export const wanVaceResolutionOptions = ["480p", "580p", "720p"];
export const wanVaceAspectRatioOptions = ["auto", "16:9", "9:16"];
export const wanVaceInpaintingResolutionOptions = ["auto", "240p", "360p", "480p", "580p", "720p"];
export const wanVaceInpaintingAspectRatioOptions = ["auto", "16:9", "1:1", "9:16"];
export const wanVaceSamplerOptions = ["unipc", "dpm++", "euler"];
export const wanVaceAccelerationOptions = ["regular", "low", "none"];
export const wanVaceInterpolatorOptions = ["film", "rife"];
export const wanVaceTransparencyOptions = ["content_aware", "white", "black"];

export const utilityModelDescriptions = {
  [utilityImageModelNames.colorIdMatte]: "Creates a black and white matte from a picked source-image Color ID.",
  [utilityImageModelNames.imageToId]: "Uses OpenAI Image 2 to convert a connected image into a flat Cryptomatte-style RGB Color ID pass.",
  [utilityImageModelNames.qwenCameraEdit]: "Reframes a connected image with Qwen camera controls.",
  [utilityImageModelNames.stillFrame]: "Extracts a still PNG frame from a connected video locally, without an API call.",
  [utilityImageModelNames.dwpose]: "Creates pose/control maps from a source image for character and body-guided generation.",
  [utilityImageModelNames.depthAnything]: "Extracts a depth map from an image for depth-aware control and composition.",
  [utilityImageModelNames.topazUpscaler]: "Upscales and enhances a connected image with Topaz image enhancement models.",
  [utilityImageModelNames.patina]: "Generates PBR texture maps such as basecolor, normal, roughness, metalness, and height.",
  [utilityImageModelNames.sam3Image]: "Segments prompted objects in an image and returns the masked result.",
  [utilityImageModelNames.birefnetImage]: "Removes an image background with BiRefNet and can optionally return the mask.",
  [utilityVideoModelNames.wanFunControl]: "Legacy Wan Fun Control alias. New runs route to Wan 2.2 VACE Fun A14B Depth.",
  [utilityVideoModelNames.extractFrame]: "Captures the current frame from a connected video and outputs it as a still image.",
  [utilityVideoModelNames.colorIdMatte]: "Creates a black and white matte video from picked source-video Color IDs.",
  [utilityVideoModelNames.compositeVideo]: "Locally composites a generated layer video over a base video through a connected matte video.",
  [utilityVideoModelNames.depthAnythingVideo]: "Creates a temporally consistent depth-map video from a connected source video with Video Depth Anything.",
  [utilityVideoModelNames.wanBlend]: "Runs the local ComfyUI context-smashing attention-mask workflow from connected color-region images and a color-mask video.",
  [utilityVideoModelNames.videoStitch]: "Runs the local ComfyUI WanWarp workflow from connected WanSegment configs or refines a WanBlend video with motion/depth controls.",
  [utilityVideoModelNames.transitionBuilder]: "Defines one WanWarp segment: keyframe, prompt, schedule, and optional motion/depth sources.",
  [utilityVideoModelNames.wanVaceMaskToVideo]: "Uses Fal Wan VACE to create a prompted video from a reference image inside a connected mask video.",
  [utilityVideoModelNames.wanVaceInpainting]: "Uses Fal Wan VACE 14B with source video, mask video, prompt, and optional reference images for masked video generation.",
  [utilityVideoModelNames.wan22A14bT2v]: "Uses Fal Wan 2.2 A14B text-to-video with optional LoRA weights, frame interpolation, guidance, and quality controls.",
  [utilityVideoModelNames.wan22A14bI2v]: "Uses Fal Wan 2.2 A14B image-to-video with optional LoRA weights from a connected start image and optional end image.",
  [utilityVideoModelNames.wan22VaceDepth]: "Uses Fal Wan 2.2 VACE Fun A14B Depth for prompted video generation from a source or precomputed depth video.",
  [utilityVideoModelNames.wan22VacePose]: "Uses Fal Wan 2.2 VACE Fun A14B Pose for prompted video generation from a source or precomputed pose video.",
  [utilityVideoModelNames.wan22VaceInpainting]: "Uses Fal Wan 2.2 VACE Fun A14B for prompted masked video generation with optional first/last frames and references.",
  [utilityVideoModelNames.sam3Video]: "Segments prompted objects through a video and returns a mask video.",
  [utilityVideoModelNames.voidVideoInpainting]: "Removes an object from a video and inpaints the affected background over time.",
  [utilityVideoModelNames.birefnetVideo]: "Removes a video background with BiRefNet and can optionally return the mask video.",
  [utilityVideoModelNames.rifeVideo]: "Interpolates in-between frames with RIFE optical-flow style motion estimation to smooth low-FPS video.",
  [utilityVideoModelNames.bytedanceUpscaler]: "Upscales video with Bytedance's Fal upscaler using resolution, FPS, preset, tier, and fidelity controls.",
  [utilityVideoModelNames.topazUpscaler]: "Upscales and enhances video with Topaz Video AI models, with optional interpolation and billing-tier tracking."
};

export const sam3SegmentationModelsEnabled = false; // Flip back to true when revisiting SAM 3 segmentation.

import {
  buildAtlasImageRequest,
  buildAtlasVideoRequest,
  estimateAtlasVideoCost
} from "../src/atlasMedia.js";
import { prepareAtlasSeedanceImageAsset } from "./atlas-video-input.js";
import { seedanceDraftCost } from "../src/seedanceDraft.js";
import { estimateAtlasImageCost as catalogImageCost } from "../src/atlasPricing.js";

export function createAtlasMedia({ client, readLocalAsset, imageSize, labelPrompt, prepareVideoSource = null, quoteInput = async () => null }) {
  async function uploadSource(source, key, kind = "", model = "", onReferencePrepared) {
    let asset = kind === "videos" && typeof prepareVideoSource === "function"
      ? await prepareVideoSource(source)
      : typeof source === "string" ? await readLocalAsset(source) : source;
    if (["images", "start", "end"].includes(kind) && /^Seedance 2\.[05]$/i.test(model) && asset?.buffer) {
      asset = await prepareAtlasSeedanceImageAsset(asset);
      if (asset.atlasNormalization) onReferencePrepared?.({ role: kind, source: typeof source === "string" ? source : asset.fileName, ...asset.atlasNormalization });
    }
    return client.upload(asset, key);
  }

  async function image({
    model,
    variant,
    prompt,
    imageInputs = [],
    aspectRatio,
    resolution = "2K",
    quality = "high",
    background = "auto",
    size: requestedSize = "",
    editMaskInput = null
  }, key) {
    const submittedPrompt = labelPrompt(prompt, imageInputs);
    const placeholderImages = imageInputs.map((_asset, index) => `https://reference.invalid/image-${index + 1}.png`);
    buildAtlasImageRequest({
      model,
      variant,
      prompt: submittedPrompt,
      images: placeholderImages,
      aspectRatio,
      resolution,
      quality,
      background,
      size: model.startsWith("OpenAI Image") ? requestedSize || imageSize({ aspectRatio, resolution }) : undefined,
      maskUrl: editMaskInput ? "https://reference.invalid/mask.png" : ""
    });
    const uploadedImages = [];
    for (const asset of imageInputs) uploadedImages.push(await client.upload(asset, key));
    const maskUrl = editMaskInput ? await client.upload(editMaskInput, key) : "";
    const size = model.startsWith("OpenAI Image") ? requestedSize || imageSize({ aspectRatio, resolution }) : undefined;
    const input = buildAtlasImageRequest({
      model,
      variant,
      prompt: submittedPrompt,
      images: uploadedImages,
      aspectRatio,
      resolution,
      quality,
      background,
      size,
      maskUrl
    });
    const fallback = catalogImageCost({ model: input.model, resolution: input.resolution ?? resolution, referenceCount: imageInputs.length,
      enableWebSearch: input.enable_web_search, enableImageSearch: input.enable_image_search, numImages: input.n });
    let quote = await quoteInput(input, key).catch(() => null);
    const result = await client.generate({ mediaType: "image", input, key });
    if (!quote) quote = await quoteInput(input, key).catch(() => null);
    return {
      ...result,
      endpoint: input.model,
      provider: "Atlas Cloud",
      cost: { ...fallback, ...quote },
      remoteImage: { url: result.url, content_type: "image/png" },
      size,
      quality: input.quality || quality,
      background: input.background || background,
      variant,
      submittedPrompt,
      resultText: ""
    };
  }

  async function prepareVideo({
    model,
    prompt,
    startImage = "",
    endImage = "",
    images = [],
    videos = [],
    audios = [],
    onReferencePrepared,
    ...options
  }, key) {
    const placeholder = "https://reference.invalid/media";
    buildAtlasVideoRequest({
      model,
      prompt,
      ...options,
      startImage: startImage ? placeholder : "",
      endImage: endImage ? placeholder : "",
      images: images.map(() => placeholder),
      videos: videos.map(() => placeholder),
      audios: audios.map(() => placeholder)
    });
    const uploaded = { images: [], videos: [], audios: [] };
    for (const [kind, sources] of Object.entries({ images, videos, audios })) {
      for (const source of sources) uploaded[kind].push(await uploadSource(source, key, kind, model, onReferencePrepared));
    }
    const input = buildAtlasVideoRequest({
      model,
      prompt,
      ...options,
      ...uploaded,
      startImage: startImage ? await uploadSource(startImage, key, "start", model, onReferencePrepared) : "",
      endImage: endImage ? await uploadSource(endImage, key, "end", model, onReferencePrepared) : ""
    });
    return input;
  }

  async function videoCost(input, options, key) {
    const hasVideoReference = Boolean(options.videos?.length);
    if (input.draft && !hasVideoReference) return { cost: seedanceDraftCost("preview", "atlas"), quoted: false };
    const quote = await quoteInput(input, key).catch(() => null);
    const estimate = estimateAtlasVideoCost({ model: options.model, duration: input.duration, resolution: input.resolution,
      referenceImageCount: options.images?.length || 0, hasVideoReference, endpoint: input.model });
    const cost = { ...(input.draft ? seedanceDraftCost("preview", "atlas") : estimate), ...quote };
    return { cost, quoted: Boolean(quote) };
  }

  async function video(options, key) {
    const input = await prepareVideo(options, key);
    const { cost, quoted } = await videoCost(input, options, key);
    const result = await client.generate({ mediaType: "video", input, key });
    const refreshedQuote = quoted || input.draft ? null : await quoteInput(input, key).catch(() => null);
    return {
      ...result,
      endpoint: input.model,
      provider: "Atlas Cloud",
      cost: { ...cost, ...refreshedQuote },
      input,
      remoteVideo: { url: result.url, content_type: "video/mp4" }
    };
  }

  return { image, video, prepareVideo, videoCost };
}

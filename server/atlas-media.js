import {
  buildAtlasImageRequest,
  buildAtlasVideoRequest,
  estimateAtlasImageCost,
  estimateAtlasVideoCost
} from "../src/atlasMedia.js";

export function createAtlasMedia({ client, readLocalAsset, imageSize, labelPrompt }) {
  async function uploadSource(source, key) {
    return client.upload(typeof source === "string" ? await readLocalAsset(source) : source, key);
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
    const result = await client.generate({ mediaType: "image", input, key });
    return {
      ...result,
      endpoint: input.model,
      provider: "Atlas Cloud",
      cost: estimateAtlasImageCost({ model, resolution, referenceCount: imageInputs.length, endpoint: input.model }),
      remoteImage: { url: result.url, content_type: "image/png" },
      size,
      quality: input.quality || quality,
      background: input.background || background,
      variant,
      submittedPrompt,
      resultText: ""
    };
  }

  async function video({
    model,
    prompt,
    startImage = "",
    endImage = "",
    images = [],
    videos = [],
    audios = [],
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
      for (const source of sources) uploaded[kind].push(await uploadSource(source, key));
    }
    const input = buildAtlasVideoRequest({
      model,
      prompt,
      ...options,
      ...uploaded,
      startImage: startImage ? await uploadSource(startImage, key) : "",
      endImage: endImage ? await uploadSource(endImage, key) : ""
    });
    const result = await client.generate({ mediaType: "video", input, key });
    return {
      ...result,
      endpoint: input.model,
      provider: "Atlas Cloud",
      cost: estimateAtlasVideoCost({
        model,
        duration: options.duration,
        resolution: options.resolution,
        referenceImageCount: images.length,
        endpoint: input.model
      }),
      input,
      remoteVideo: { url: result.url, content_type: "video/mp4" }
    };
  }

  return { image, video };
}

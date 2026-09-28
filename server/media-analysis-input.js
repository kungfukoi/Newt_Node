import sharp from "sharp";

const atlasAnalysisTotalImageBytes = 1_500_000;
const atlasAnalysisMinimumImageBytes = 24_000;
const atlasAnalysisProfiles = Object.freeze([
  { maximumDimension: 1024, quality: 72 },
  { maximumDimension: 896, quality: 68 },
  { maximumDimension: 768, quality: 64 },
  { maximumDimension: 640, quality: 58 },
  { maximumDimension: 512, quality: 50 },
  { maximumDimension: 384, quality: 42 },
  { maximumDimension: 256, quality: 35 }
]);

export async function buildMediaAnalysisContent({
  inputs = [],
  mediaType = "image",
  prompt = "",
  readLocalAsset,
  optimizeImages = false
} = {}) {
  const content = [{ type: "input_text", text: prompt }];
  const imageCount = mediaType === "image" ? Math.max(1, inputs.length) : 1;
  const maximumImageBytes = Math.max(
    atlasAnalysisMinimumImageBytes,
    Math.floor(atlasAnalysisTotalImageBytes / imageCount)
  );

  for (const item of inputs) {
    if (mediaType !== "image") {
      content.push({ type: "input_text", text: `${item.label || "Video reference"}: ${item.url}` });
      continue;
    }

    const asset = await readLocalAsset(item.url);
    if (item.label) content.push({ type: "input_text", text: item.label });
    const prepared = optimizeImages ? await compactAnalysisImage(asset, maximumImageBytes) : asset;
    content.push({
      type: "input_image",
      image_url: `data:${prepared.mimeType || "image/png"};base64,${prepared.buffer.toString("base64")}`
    });
  }

  return content;
}

async function compactAnalysisImage(asset, maximumBytes) {
  const source = sharp(asset.buffer, {
    animated: false,
    failOn: "none",
    limitInputPixels: 100_000_000
  })
    .rotate()
    .flatten({ background: "#ffffff" });

  let buffer = asset.buffer;
  for (const profile of atlasAnalysisProfiles) {
    buffer = await source
      .clone()
      .resize({
        width: profile.maximumDimension,
        height: profile.maximumDimension,
        fit: "inside",
        withoutEnlargement: true
      })
      .jpeg({ quality: profile.quality, mozjpeg: true })
      .toBuffer();
    if (buffer.length <= maximumBytes) break;
  }

  return { ...asset, buffer, mimeType: "image/jpeg" };
}

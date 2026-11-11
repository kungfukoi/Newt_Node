import { isFlux3Model, flux3ResolutionOptions } from "../../src/flux3.js";
import { validateEditBoxes } from "../../src/imageEditBoxes.js";
import { isNanoBanana21Model, nanoBanana21ResolutionOptions } from "../../src/nanoBanana21.js";
import { imageEditRequiresFal, imageEditUsesSelectionGuide, isSeedream55Edit } from "../../src/imageEdit.js";
import { seedream55AspectRatios, seedream55Backgrounds, seedream55Formats, seedream55Sizes } from "../../src/seedream55Editor.js";
import { isOpenAiImage26Model, normalizeOpenAiImage26Model, openAiImage26Variant } from "../../src/openAiImageModels.js";
import multer from "multer";
import { createHash, randomUUID } from "node:crypto";
import { prepareImageEdit, finishImageEdit } from "../image-edit.js";
import { openAiImage2QualityOptions } from "../../src/openAiImage2.js";
import { imageModelNames } from "../../src/modelOptions.js";
import { imageEditModelOptions, normalizeImageEditModel } from "../../src/imageEdit.js";
import { isIdeogram45Model, ideogram45QualityOptions } from "../../src/ideogram45.js";
import sharp from "sharp";
import { boxSelectionDocument, readSelectionMetadata } from "../../src/imageEditBoxExport.js";

export function registerImageEditRoutes(app, { limiter, getProvider, readSource, generate, decompose, readGenerated = readImageEditResult, save, recordHistory, estimateCost, sendError }) {
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 24 * 1024 * 1024, files: 3, fields: 48, fieldSize: 100000 } });
  const jobs = new Map();
  app.post("/api/node/save-image-selection", upload.single("selection"), async (req, res) => {
    try {
      let metadata, image;
      try {
        if (!req.file?.buffer) throw new Error("No selection image supplied.");
        metadata = readSelectionMetadata(req.file.buffer);
        if (metadata?.format !== "newtnode-box-selections" || metadata.version !== 1 || typeof metadata.prompt !== "string") throw new Error("Selection metadata is missing or unsupported.");
        image = await sharp(req.file.buffer).metadata();
        if (image.format !== "png" || image.width !== metadata.source?.width || image.height !== metadata.source?.height) throw new Error("Selection image dimensions do not match its metadata.");
        const validated = boxSelectionDocument(metadata.boxes, image, {}, metadata.prompt);
        if (!validated.boxes.length || validated.boxes.some((box, i) => box.tag !== metadata.boxes[i].tag)) throw new Error("Selection tags must match the box descriptions.");
      } catch (error) { throw Object.assign(error, { status: 400 }); }
      await readSource(req.body.sourceUrl);
      const output = await save(req, req.file.buffer);
      const cost = { amountUsd: 0, currency: "USD", source: "Local selection export", estimated: false };
      const item = { ...output, type: "image", mimeType: "image/png", label: "Image Selection", provider: "local", sourceUrl: req.body.sourceUrl, width: image.width, height: image.height, selectionMetadata: metadata, cost };
      let warning = "";
      try {
        await recordHistory({ id: randomUUID(), createdAt: new Date().toISOString(), mediaType: "image", provider: "local", modelName: "Image Selection", endpoint: "local/image-selection", mode: "Image Selection", prompt: metadata.prompt,
          project: { id: req.body.projectId || "node-workspace", name: req.body.projectName || "Node workspace" },
          node: { id: req.body.nodeId, title: req.body.nodeTitle || "Image Edit" },
          settings: { sourceUrl: req.body.sourceUrl, boxes: metadata.boxes, selectionMetadata: "NewtNodeSelections" },
          localImage: item.url, localThumbnail: item.thumbnailUrl, outputFileName: item.fileName, cost });
      } catch { warning = "Selection saved, but it could not be added to History."; }
      res.json({ item, warning });
    } catch (error) { sendError(res, error, "Could not save selection."); }
  });
  app.post("/api/node/edit-image", limiter, upload.fields([{ name: "drawing", maxCount: 1 }, { name: "selection", maxCount: 1 }, { name: "boxObjects", maxCount: 1 }]), async (req, res) => {
    try {
      const model = !req.body.model || isOpenAiImage26Model(req.body.model)
        ? normalizeImageEditModel(normalizeOpenAiImage26Model(req.body.model, "sunburst"))
        : req.body.model;
      if (!imageEditModelOptions.includes(model)) throw Object.assign(new Error("Choose a supported image editor model."), { status: 400 });
      if (imageEditRequiresFal(model) && req.body.provider !== "fal") throw Object.assign(new Error(`${model} edits require Fal. Enable a Fal key in Settings.`), { status: 400 });
      const seedream = isSeedream55Edit(model);
      const { sourceUrl, requestId, prompt = "", mode = "edit", quality = "high" } = req.body;
      if (mode === "layers" && (!seedream || req.body.provider !== "atlas")) throw Object.assign(new Error("Seedream 5.5 layer separation requires Atlas Cloud."), { status: 400 });
      if (mode !== "layers" && seedream !== (req.body.provider === "krea")) throw Object.assign(new Error("Seedream 5.5 edits require Krea."), { status: 400 });
      const provider = getProvider?.(req, String(req.body.provider || "").trim().toLowerCase()) || "";
      if (!["fal", "atlas", "krea"].includes(provider)) throw Object.assign(new Error("Enable an active key for the selected image editor provider."), { status: 400 });
      const options = seedream ? seedreamOptions(req.body, mode) : undefined;
      if (!/^[a-z0-9-]{16,80}$/i.test(requestId || "")) throw Object.assign(new Error("An edit request ID is required."), { status: 400 });
      if (!(isIdeogram45Model(model) ? ideogram45QualityOptions : openAiImage2QualityOptions).includes(quality)) throw Object.assign(new Error("Choose a valid image quality."), { status: 400 });
      if (isFlux3Model(model) && !flux3ResolutionOptions.includes(req.body.resolution || "2K")) throw Object.assign(new Error("Choose 1K, 2K, or 4K for Flux 3."), { status: 400 });
      if (isNanoBanana21Model(model) && !nanoBanana21ResolutionOptions.includes(req.body.resolution || "2K")) throw Object.assign(new Error("Choose 1K, 2K, or 4K for Nano Banana 2.1."), { status: 400 });
      const key = `${req.body.projectId || ""}:${requestId}`;
      const hash = createHash("sha256").update(JSON.stringify(Object.entries(req.body).sort(([a], [b]) => a.localeCompare(b))));
      for (const name of ["drawing", "selection", "boxObjects"]) hash.update(name).update(req.files?.[name]?.[0]?.buffer || "");
      const fingerprint = hash.digest("hex");
      for (const [id, job] of jobs) if (job.finished && Date.now() - job.finished > 3600000) jobs.delete(id);
      if (!jobs.has(key)) {
        if (jobs.size >= 100) throw Object.assign(new Error("The image editor is busy. Try again later."), { status: 429 });
        const job = { fingerprint };
        job.promise = run(req, { sourceUrl, prompt, mode, quality, provider, model, options }).finally(() => { job.finished = Date.now(); });
        jobs.set(key, job);
      }
      if (jobs.get(key).fingerprint !== fingerprint) throw Object.assign(new Error("This edit request ID has already been used for a different edit."), { status: 409 });
      res.json(await jobs.get(key).promise);
    } catch (error) { sendError(res, error, "Image edit failed."); }
  });

  async function run(req, { sourceUrl, prompt, mode, quality, provider, model, options }) {
    if (mode === "layers") {
      if (String(prompt).length > 16000) throw Object.assign(new Error("Keep the layer prompt under 16,000 characters."), { status: 400 });
      const source = await readSource(sourceUrl);
      let image = await sharp(source.buffer, { limitInputPixels: 24_000_000 }).rotate().png().toBuffer();
      const { width, height } = await sharp(image).metadata();
      if (image.length > 30 * 1024 * 1024 || width / height < 1 / 16 || width / height > 16) {
        throw Object.assign(new Error("Atlas layers require an image up to 30 MB with an aspect ratio from 1:16 to 16:1."), { status: 400 });
      }
      if (width * height < 512 * 512) {
        const scale = 512 / Math.sqrt(width * height);
        image = await sharp(image).resize(Math.ceil(width * scale), Math.ceil(height * scale), { fit: "fill" }).png().toBuffer();
      }
      const generation = await decompose({ image, prompt, options, provider });
      const items = [];
      for (const asset of generation.assets) {
        try {
          const image = sharp(await readGenerated(asset.url), { limitInputPixels: 24_000_000 }).rotate();
          const jpeg = asset.layer.index === 0 && options.output_format === "jpeg";
          const { data, info } = await (jpeg ? image.jpeg() : image.png()).toBuffer({ resolveWithObject: true });
          const output = await save(req, data, jpeg ? ".jpg" : ".png");
          items.push({ ...output, type: "image", mimeType: jpeg ? "image/jpeg" : "image/png", label: asset.label,
            provider: generation.provider, modelName: generation.modelName, sourceUrl, width: info.width, height: info.height, layer: asset.layer, cost: null });
        } catch { /* Keep the layers that were delivered successfully. */ }
      }
      let warning = items.length < generation.assets.length ? `Saved ${items.length} of ${generation.assets.length} images. Check Atlas Cloud request ${generation.id} for the remaining layers.` : "";
      try {
        await recordHistory({ id: generation.id, createdAt: new Date().toISOString(), mediaType: "image", provider: generation.provider,
          modelName: generation.modelName, endpoint: generation.endpoint, mode: "Image Edit: Layer separation", prompt,
          project: { id: req.body.projectId || "node-workspace", name: req.body.projectName || "Node workspace" },
          node: { id: req.body.nodeId, title: req.body.nodeTitle || "Image Edit" },
          settings: { ...options, sourceUrl, layers: items.map(item => ({ label: item.label, ...item.layer })) },
          localImage: items[0]?.url, localImages: items.map(item => item.url), cost: null });
      } catch { warning += " The layer run could not be added to History."; }
      if (!items.length) throw Object.assign(new Error(warning), { status: 502 });
      return { items, warning };
    }
    let boxes;
    try { boxes = validateEditBoxes(JSON.parse(req.body.boxes || "[]")); }
    catch (error) { throw Object.assign(new Error(`Invalid edit boxes: ${error.message}`), { status: 400 }); }
    let boxObjects = {};
    try {
      if (req.files?.boxObjects?.[0]) boxObjects = JSON.parse(req.files.boxObjects[0].buffer.toString("utf8"));
      if (!boxObjects || typeof boxObjects !== "object" || Array.isArray(boxObjects) || Object.keys(boxObjects).some(id => !boxes.some(box => box.id === id && ["move", "remove"].includes(box.mode)))) throw new Error("Unknown box object mask.");
    } catch { throw Object.assign(new Error("Invalid box object masks. Select the objects again."), { status: 400 }); }
    const referenceUrls = [...new Set(boxes.filter(box => box.mode === "reference").map(box => box.referenceUrl))];
    if (referenceUrls.length > 1) throw Object.assign(new Error("Use one shared reference image across From Reference boxes per edit."), { status: 400 });
    const references = await Promise.all(referenceUrls.map(async url => ({ url, ...(await readSource(url)) })));
    const source = await readSource(sourceUrl);
    const prepared = await prepareImageEdit({ source: source.buffer, drawing: req.files?.drawing?.[0]?.buffer,
      selection: req.files?.selection?.[0]?.buffer, prompt, mode, blank: req.body.blank === "true", model, boxes, references, boxObjects })
      .catch((error) => { throw Object.assign(error, { status: 400 }); });
    if (options) {
      let urls;
      try { urls = JSON.parse(req.body.referenceUrls || "[]"); } catch { /* Invalid input is handled below. */ }
      if (!Array.isArray(urls) || urls.some(url => typeof url !== "string") || urls.length + prepared.images.length + Number(Boolean(prepared.mask)) > 10) {
        throw Object.assign(new Error("Seedream 5.5 supports up to 10 reference images including the source and guides."), { status: 400 });
      }
      for (const url of urls) {
        const reference = await readSource(url);
        prepared.images.push(await sharp(reference.buffer, { limitInputPixels: 24_000_000 }).rotate().png().toBuffer());
      }
    }
    const variant = imageEditRequiresFal(model) || options ? undefined : openAiImage26Variant(model);
    const stitch = Boolean(prepared.selection || prepared.compositeSelection || prepared.annotationMask || prepared.boxes.length);
    if (options && stitch && options.aspect_ratio !== "auto") throw Object.assign(new Error("Use Auto aspect ratio when editing a selection, box, or drawing guide."), { status: 400 });
    let generation;
    let generationProvider = provider === "krea" ? "Krea" : provider === "atlas" ? "Atlas Cloud" : "fal.ai";
    try {
      generation = await generate({ provider, model, variant, quality, resolution: req.body.resolution || "2K", size: `${prepared.size.width}x${prepared.size.height}`, prompt: prepared.submittedPrompt,
        images: prepared.images, mask: prepared.mask, options });
      generationProvider = generation.provider || generationProvider;
      const generated = await readGenerated(generation.remoteImage.url);
      const bytes = options && !stitch ? await sharp(generated, { limitInputPixels: 24_000_000 }).rotate().png().toBuffer() : await finishImageEdit(prepared, generated);
      const jpeg = options?.output_format === "jpeg";
      const output = await save(req, jpeg ? await sharp(bytes).flatten({ background: "#fff" }).jpeg().toBuffer() : bytes, jpeg ? ".jpg" : ".png");
      const cost = options ? null : generation.cost ?? estimateCost?.({ model, provider: generationProvider, endpoint: generation.endpoint, quality, size: `${prepared.size.width}x${prepared.size.height}` }) ?? null;
      const { width, height } = options && !stitch ? await sharp(bytes).metadata() : prepared;
      const item = { url: output.url, thumbnailUrl: output.thumbnailUrl, fileName: output.fileName, type: "image", mimeType: jpeg ? "image/jpeg" : "image/png",
        label: "Image Edit", provider: generationProvider, sourceUrl, width, height, cost };
      let warning = "";
      try {
        await recordHistory({ id: randomUUID(), createdAt: new Date().toISOString(), mediaType: "image", provider: generationProvider, modelName: model,
          endpoint: generation.endpoint, mode: `Image Edit: ${mode}`, prompt, submittedPrompt: prepared.submittedPrompt,
          project: { id: req.body.projectId || "node-workspace", name: req.body.projectName || "Node workspace" },
          node: { id: req.body.nodeId, title: req.body.nodeTitle || "Image Edit" },
          settings: { quality: imageEditUsesSelectionGuide(model) ? undefined : quality, variant, ...(imageEditUsesSelectionGuide(model) ? { resolution: req.body.resolution || "2K", selectionGuide: Boolean(prepared.mask) } : {}), ...(isNanoBanana21Model(model) ? { thinkingLevel: "high", enableWebSearch: false } : {}), ...(isIdeogram45Model(model) ? { editPrecision: "high" } : {}), ...options, sourceUrl, boxes: prepared.boxes, boxStrategy: prepared.boxStrategy, maskedEdit: Boolean(prepared.mask), blank: req.body.blank === "true", imageSize: `${width}x${height}` },
          localImage: item.url, localThumbnail: item.thumbnailUrl, outputFileName: item.fileName, cost });
      } catch { warning = "Image saved, but this run could not be added to History."; }
      return { item, warning };
    } catch (error) {
      if (generation) throw Object.assign(new Error(`The model completed the edit, but NewtNode could not save it. Check ${generationProvider === "fal.ai" ? "Fal" : generationProvider} history before rerunning. ${error.message}`), { status: 502 });
      // Fal's SDK uses the generic message "Forbidden" for upload failures;
      // the actionable account/billing explanation lives in body.detail.
      const status = Number(error.status || error.statusCode || error.response?.status);
      if ([401, 403].includes(status)) {
        const detail = [error.body?.detail, error.body?.message, error.message].find(value => typeof value === "string" && value.trim());
        const label = provider === "fal" ? "Fal" : provider === "krea" ? "Krea" : "Atlas Cloud";
        throw Object.assign(new Error(`${label} rejected the ${model} edit (HTTP ${status}). ${detail || "Check the selected account's access and billing."}`), { status });
      }
      throw error;
    }
  }
}

function seedreamOptions(body, mode) {
  const choose = (value, choices, fallback) => {
    if (value === undefined) return fallback;
    if (!choices.includes(value)) throw Object.assign(new Error("Choose valid Seedream 5.5 output settings."), { status: 400 });
    return value;
  };
  if (mode === "layers") {
    const num_images = Number(body.maxLayers ?? 10);
    if (!Number.isInteger(num_images) || num_images < 2 || num_images > 100) throw Object.assign(new Error("Choose 2–100 output images including the base."), { status: 400 });
    return { num_images,
      resolution: choose(body.resolution, ["auto", "1k", "1.5k", "2k"], "auto"),
      enable_text_recognition: body.textRecognition === "true",
      output_format: choose(body.outputFormat, seedream55Formats, "png") };
  }
  const common = { size: choose(body.resolution, seedream55Sizes, "2K"), output_format: choose(body.outputFormat, seedream55Formats, "png") };
  const background = choose(body.background, seedream55Backgrounds, "auto");
  if (background === "transparent" && common.output_format !== "png") throw Object.assign(new Error("Transparent output requires PNG."), { status: 400 });
  return { ...common, background, aspect_ratio: choose(body.aspectRatio, seedream55AspectRatios, "auto") };
}

async function readImageEditResult(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
  if (!response.ok || !response.body) throw new Error("Could not download the generated edit.");
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 48 * 1024 * 1024) throw new Error("The generated edit exceeds the download size limit.");
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}

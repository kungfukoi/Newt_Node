import { loadCanvasImage } from "./canvasMedia.js";
import { runCharacterWardrobeEdit } from "./nodeRunners/mediaModels.js";
import { characterWardrobeMaskRegions, characterWardrobeEditPrompt, characterVideoWardrobeEditPrompt } from "./characterSheetWorkflow.js";

export async function generateCharacterWardrobeVariant(node, wardrobe, {
    workflowContext,
    characterTag,
    baseSheet,
    baseVideoSheet = null,
    baseSignature,
    baseVideoSignature = "",
    existingVariant = null,
    regenerateImage = false,
    regenerateVideo = false,
    onGenerationComplete = () => {}
  } = {}) {
    let generated = regenerateImage ? null : existingVariant?.generated || null;
    if (!(generated?.url || generated?.localUrl)) {
      const imageMask = await createCharacterWardrobeEditMaskDataUrl(baseSheet, "image");
      generated = await runCharacterWardrobeEdit({
        node,
        prompt: characterWardrobeEditPrompt,
        baseSheet,
        wardrobe,
        editMaskDataUrl: imageMask,
        workflowContext: workflowContext,
        characterTag: characterTag
      });
      onGenerationComplete();
    }

    let videoGenerated = regenerateVideo ? null : existingVariant?.videoGenerated || null;
    let videoError = "";
    if (
      node.data.cuVideoGeneration
      && (baseVideoSheet?.url || baseVideoSheet?.localUrl)
      && !(videoGenerated?.url || videoGenerated?.localUrl)
    ) {
      try {
        const videoMask = await createCharacterWardrobeEditMaskDataUrl(baseVideoSheet, "video");
        videoGenerated = await runCharacterWardrobeEdit({
          node,
          prompt: characterVideoWardrobeEditPrompt,
          baseSheet: baseVideoSheet,
          wardrobe,
          editMaskDataUrl: videoMask,
          workflowContext: workflowContext,
          characterTag: characterTag,
          sheetKind: "video"
        });
      } catch (error) {
        videoError = error.message || "CU video wardrobe edit failed.";
      } finally {
        onGenerationComplete();
      }
    }

    return {
      variant: {
        wardrobeId: wardrobe.id,
        wardrobeUrl: wardrobe.localUrl || wardrobe.url || "",
        wardrobeFileName: wardrobe.fileName || "Wardrobe",
        baseSheetUrl: baseSheet.url || baseSheet.localUrl || "",
        baseSignature,
        ...(videoGenerated && baseVideoSignature ? { baseVideoSignature } : {}),
        generated,
        ...(videoGenerated ? { videoGenerated } : {})
      },
      videoError
    };
  }

async function createCharacterWardrobeEditMaskDataUrl(baseSheet, sheetKind = "image") {
  const sourceUrl = baseSheet?.localUrl || baseSheet?.url || "";
  if (!sourceUrl || typeof document === "undefined") return "";
  const image = await loadCanvasImage(sourceUrl);
  const width = Math.max(1, Math.round(image.naturalWidth || image.width || 1));
  const height = Math.max(1, Math.round(image.naturalHeight || image.height || 1));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#fff";
  characterWardrobeMaskRegions(sheetKind).forEach((region) => {
    context.fillRect(
      Math.round(region.x * width),
      Math.round(region.y * height),
      Math.ceil(region.width * width),
      Math.ceil(region.height * height)
    );
  });
  return canvas.toDataURL("image/png");
}

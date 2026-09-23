import { runCharacterWardrobeEdit } from "./nodeRunners/mediaModels.js";
import {
  characterWardrobeEditPromptForData,
  characterWardrobeEditVersion
} from "./characterSheetWorkflow.js";

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
    runWardrobeEdit = runCharacterWardrobeEdit,
    onGenerationComplete = () => {}
  } = {}) {
    let generated = regenerateImage ? null : existingVariant?.generated || null;
    if (!(generated?.url || generated?.localUrl)) {
      generated = await runWardrobeEdit({
        node,
        prompt: characterWardrobeEditPromptForData(node.data),
        baseSheet,
        wardrobe,
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
        videoGenerated = await runWardrobeEdit({
          node,
          prompt: characterWardrobeEditPromptForData(node.data, "video"),
          baseSheet: baseVideoSheet,
          wardrobe,
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
        wardrobeEditVersion: characterWardrobeEditVersion,
        ...(videoGenerated && baseVideoSignature ? { baseVideoSignature } : {}),
        generated,
        ...(videoGenerated ? { videoGenerated } : {})
      },
      videoError
    };
  }

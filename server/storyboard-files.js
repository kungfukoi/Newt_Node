import path from "node:path";
import { constants as fsConstants } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";

export function safeStoryboardSceneName(value = "Scene 1") {
  return String(value || "Scene 1")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[_-]+|[_-]+$/g, "")
    .slice(0, 80) || "Scene_1";
}

export function storyboardFrameFileName(sceneName, frameNumber, extension = ".png") {
  const normalizedNumber = Math.max(1, Number.parseInt(frameNumber, 10) || 1);
  const normalizedExtension = /^\.[A-Za-z0-9]+$/.test(String(extension || ""))
    ? String(extension)
    : ".png";

  return `${safeStoryboardSceneName(sceneName)}_Frame_${String(normalizedNumber).padStart(2, "0")}${normalizedExtension}`;
}

export function versionedStoryboardFrameFileName(fileName, version = 1) {
  const normalizedVersion = Math.max(1, Number.parseInt(version, 10) || 1);
  if (normalizedVersion === 1) return fileName;

  const extension = path.extname(fileName);
  const baseName = path.basename(fileName, extension);
  return `${baseName}_v${String(normalizedVersion).padStart(2, "0")}${extension}`;
}

export async function copyStoryboardFrameWithVersion(sourcePath, targetDirectory, preferredFileName) {
  await mkdir(targetDirectory, { recursive: true });

  for (let version = 1; ; version += 1) {
    const fileName = versionedStoryboardFrameFileName(preferredFileName, version);
    const filePath = path.join(targetDirectory, fileName);
    try {
      await copyFile(sourcePath, filePath, fsConstants.COPYFILE_EXCL);
      return { fileName, filePath, version };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }
  }
}

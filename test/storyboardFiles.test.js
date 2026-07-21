import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import {
  copyStoryboardFrameWithVersion,
  safeStoryboardSceneName,
  storyboardFrameFileName,
  versionedStoryboardFrameFileName
} from "../server/storyboard-files.js";

test("storyboard scene folders are safe and retain the readable scene name", () => {
  assert.equal(safeStoryboardSceneName("Scene 01"), "Scene_01");
  assert.equal(safeStoryboardSceneName(" INT. Coffee Shop / Night "), "INT_Coffee_Shop_Night");
  assert.equal(safeStoryboardSceneName("///"), "Scene_1");
});

test("storyboard frame filenames use the scene and board frame number", () => {
  assert.equal(storyboardFrameFileName("Scene 01", 1, ".png"), "Scene_01_Frame_01.png");
  assert.equal(storyboardFrameFileName("Scene 01", 12, ".webp"), "Scene_01_Frame_12.webp");
  assert.equal(storyboardFrameFileName("Scene 01", 125, ".jpg"), "Scene_01_Frame_125.jpg");
});

test("storyboard frame filenames normalize invalid numbers and extensions", () => {
  assert.equal(storyboardFrameFileName("", 0, "../png"), "Scene_1_Frame_01.png");
});

test("storyboard frame versions start at v02 and retain the extension", () => {
  assert.equal(versionedStoryboardFrameFileName("Scene_01_Frame_01.png", 1), "Scene_01_Frame_01.png");
  assert.equal(versionedStoryboardFrameFileName("Scene_01_Frame_01.png", 2), "Scene_01_Frame_01_v02.png");
  assert.equal(versionedStoryboardFrameFileName("Scene_01_Frame_01.webp", 12), "Scene_01_Frame_01_v12.webp");
});

test("copying a storyboard frame preserves previous reruns", async () => {
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "newtnode-storyboard-"));
  const sourcePath = path.join(temporaryDirectory, "source.png");
  const targetDirectory = path.join(temporaryDirectory, "Scene_01");

  try {
    await writeFile(sourcePath, "first source");
    const first = await copyStoryboardFrameWithVersion(sourcePath, targetDirectory, "Scene_01_Frame_01.png");
    await writeFile(sourcePath, "second source");
    const second = await copyStoryboardFrameWithVersion(sourcePath, targetDirectory, "Scene_01_Frame_01.png");

    assert.equal(first.fileName, "Scene_01_Frame_01.png");
    assert.equal(second.fileName, "Scene_01_Frame_01_v02.png");
    assert.equal(await readFile(first.filePath, "utf8"), "first source");
    assert.equal(await readFile(second.filePath, "utf8"), "second source");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

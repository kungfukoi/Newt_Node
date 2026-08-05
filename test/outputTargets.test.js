import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  createOutputTargetAsset,
  externalOutputFilePathFromPublicPath,
  externalOutputPublicPath,
  previewOutputTargetAsset
} from "../server/outputTargets.js";

async function withTempOutputDir(callback) {
  const directory = await mkdtemp(path.join(tmpdir(), "newtnode-output-"));
  try {
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("Output filename tokens use the Output node name, date, and timestamp", async () => {
  await withTempOutputDir(async (directory) => {
    const target = await createOutputTargetAsset(
      {
        outputTargetPath: path.join(directory, "$date"),
        outputTargetFileName: "$node_name_$date_$time",
        outputTargetNodeTitle: "Final Output",
        outputTargetSourceNodeTitle: "Video Model"
      },
      "video",
      ".mp4",
      "",
      { rootDir: directory, now: new Date(2026, 7, 5, 14, 3, 9) }
    );

    assert.equal(target.fileName, "Final Output_2026-08-05_14-03-09.mp4");
    assert.equal(path.basename(path.dirname(target.filePath)), "2026-08-05");
    await stat(target.filePath);
  });
});

test("Output $index token picks the next available filename number", async () => {
  await withTempOutputDir(async (directory) => {
    await writeFile(path.join(directory, "Final Output_01.mp4"), "existing");

    const firstTarget = await createOutputTargetAsset(
      {
        outputTargetPath: directory,
        outputTargetFileName: "$node_name_$index",
        outputTargetNodeTitle: "Final Output"
      },
      "video",
      ".mp4",
      "",
      { rootDir: directory, now: new Date(2026, 7, 5, 14, 3, 9) }
    );
    const secondTarget = await createOutputTargetAsset(
      {
        outputTargetPath: directory,
        outputTargetFileName: "$node_name_$index",
        outputTargetNodeTitle: "Final Output"
      },
      "video",
      ".mp4",
      "",
      { rootDir: directory, now: new Date(2026, 7, 5, 14, 3, 9) }
    );

    assert.equal(firstTarget.fileName, "Final Output_02.mp4");
    assert.equal(secondTarget.fileName, "Final Output_03.mp4");
  });
});

test("Output saves without $index still avoid overwriting existing files", async () => {
  await withTempOutputDir(async (directory) => {
    await writeFile(path.join(directory, "Final Output.mp4"), "existing");

    const target = await createOutputTargetAsset(
      {
        outputTargetPath: directory,
        outputTargetFileName: "$node_name",
        outputTargetNodeTitle: "Final Output"
      },
      "video",
      ".mp4",
      "",
      { rootDir: directory, now: new Date(2026, 7, 5, 14, 3, 9) }
    );

    assert.equal(target.fileName, "Final Output-2.mp4");
    await stat(target.filePath);
  });
});

test("Output filename preview resolves tokens without creating the target file", async () => {
  await withTempOutputDir(async (directory) => {
    const target = await previewOutputTargetAsset(
      {
        outputTargetPath: directory,
        outputTargetFileName: "$node_name_$date_$index",
        outputTargetNodeTitle: "Preview Output"
      },
      "image",
      ".png",
      "",
      { rootDir: directory, now: new Date(2026, 7, 5, 14, 3, 9) }
    );

    assert.equal(target.fileName, "Preview Output_2026-08-05_01.png");
    await assert.rejects(stat(target.filePath), { code: "ENOENT" });
  });
});

test("external output public paths round-trip filenames with spaces", async () => {
  await withTempOutputDir(async (directory) => {
    const filePath = path.join(directory, "Output Copy_02.mp4");
    const publicPath = externalOutputPublicPath(filePath);

    assert.match(publicPath, /\/Output%20Copy_02\.mp4$/);
    assert.equal(externalOutputFilePathFromPublicPath(publicPath), path.resolve(filePath));
  });
});

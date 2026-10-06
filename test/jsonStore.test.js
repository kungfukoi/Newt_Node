import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { writeJsonAtomic } from "../server/json-store.js";

for (const existing of [false, true]) {
  test(`atomic JSON saves honor mode on ${existing ? "replacement" : "initial creation"}`, {
    skip: process.platform === "win32" ? "Windows does not expose POSIX file permissions" : false
  }, async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "newtnode-json-mode-"));
    const filePath = path.join(directory, "private.json");
    try {
      if (existing) await writeFile(filePath, "{}", { mode: 0o644 });
      await writeJsonAtomic(filePath, { private: true }, {
        mode: 0o600,
        renameFile: async (tempPath, destination) => {
          assert.equal((await stat(tempPath)).mode & 0o777, 0o600);
          await rename(tempPath, destination);
        }
      });
      assert.equal((await stat(filePath)).mode & 0o777, 0o600);
      assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), { private: true });
      assert.deepEqual(await readdir(directory), ["private.json"]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}

test("atomic JSON saves retain the default creation mode when mode is omitted", {
  skip: process.platform === "win32" ? "Windows does not expose POSIX file permissions" : false
}, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "newtnode-json-default-mode-"));
  try {
    const reference = path.join(directory, "reference.json");
    const filePath = path.join(directory, "workflow.json");
    await writeFile(reference, "{}");
    await writeJsonAtomic(filePath, {});
    assert.equal((await stat(filePath)).mode & 0o777, (await stat(reference)).mode & 0o777);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("atomic JSON saves replace an existing workflow without leaving temp files", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "newtnode-json-store-"));
  const filePath = path.join(directory, "workflow.json");

  try {
    await writeJsonAtomic(filePath, { version: 1, nodes: [] });
    await writeJsonAtomic(filePath, { version: 2, nodes: [{ id: "node-1" }] });

    assert.deepEqual(JSON.parse(await readFile(filePath, "utf8")), {
      version: 2,
      nodes: [{ id: "node-1" }]
    });
    assert.deepEqual(await readdir(directory), ["workflow.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { writeJsonAtomic } from "../server/json-store.js";

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

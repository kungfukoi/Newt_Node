import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findMatchingWorkflowInput } from "../server/workflow-input-reuse.js";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "newt-input-reuse-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const inputs = path.join(root, "workflow", "inputs"), upload = path.join(root, "upload.png");
  await mkdir(inputs, { recursive: true });
  await writeFile(upload, "original bytes");
  return { root, inputs, upload };
}

test("a file already in inputs is reused without changing either file", async t => {
  const { inputs, upload } = await fixture(t);
  const existing = path.join(inputs, "photo.png");
  await writeFile(existing, "original bytes");
  assert.equal(await findMatchingWorkflowInput(inputs, upload, "photo.png"), existing);
  assert.equal(await readFile(existing, "utf8"), "original bytes");
  assert.equal(await readFile(upload, "utf8"), "original bytes");
});

test("same name and size with different contents is not reused", async t => {
  const { inputs, upload } = await fixture(t);
  await writeFile(path.join(inputs, "photo.png"), "different data");
  assert.equal(await findMatchingWorkflowInput(inputs, upload, "photo.png"), "");
});

test("renamed and nested inputs reuse their existing managed files", async t => {
  const { inputs, upload } = await fixture(t);
  const nested = path.join(inputs, "references"); await mkdir(nested);
  const existing = path.join(nested, "stored-name.png"); await writeFile(existing, "original bytes");
  assert.equal(await findMatchingWorkflowInput(inputs, upload, "photo.png"), existing);
});

test("files outside this workflow's inputs are not reused", async t => {
  const { root, inputs, upload } = await fixture(t);
  await writeFile(path.join(root, "photo.png"), "original bytes");
  assert.equal(await findMatchingWorkflowInput(inputs, upload, "photo.png"), "");
  assert.equal(await findMatchingWorkflowInput(path.join(root, "missing", "inputs"), upload, "photo.png"), "");
});

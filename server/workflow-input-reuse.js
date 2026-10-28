import path from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";

async function digest(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

// Browser uploads do not expose their original filesystem path. Reuse only
// byte-identical files inside this workflow's inputs, never a name-only match.
export async function findMatchingWorkflowInput(inputDirectory, uploadPath, originalName = "") {
  const uploaded = await stat(uploadPath);
  const candidates = [];
  async function collect(directory, depth = 0) {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const entry of entries) {
      const filePath = path.join(directory, entry.name);
      // Do not follow links out of the portable input tree.
      if (entry.isDirectory() && depth < 8) await collect(filePath, depth + 1);
      else if (entry.isFile() && path.resolve(filePath) !== path.resolve(uploadPath)) candidates.push(filePath);
    }
  }
  await collect(inputDirectory);
  const name = path.basename(String(originalName).replace(/\\/g, "/"));
  candidates.sort((a, b) => Number(path.basename(b) === name) - Number(path.basename(a) === name) || a.localeCompare(b));
  let uploadHash;
  for (const candidate of candidates) {
    try {
      const before = await stat(candidate);
      if (before.size !== uploaded.size) continue;
      uploadHash ||= await digest(uploadPath);
      if (await digest(candidate) !== uploadHash) continue;
      const after = await stat(candidate);
      if (before.size === after.size && before.mtimeMs === after.mtimeMs) return candidate;
    } catch (error) {
      if (!["ENOENT", "EACCES", "EPERM"].includes(error.code)) throw error;
    }
  }
  return "";
}

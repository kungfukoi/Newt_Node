import path from "node:path";
import { createHash } from "node:crypto";
import { readdir } from "node:fs/promises";
import { readFileWithRetry } from "./file-write.js";
import { writeJsonAtomic } from "./json-store.js";
import { projectOutputRecord } from "./project-output-store.js";

const outputRecordDirectory = (packagePath) => path.join(packagePath, ".newtnode", "output-records");

export async function writePackageOutputRecord(packagePath, item) {
  const record = projectOutputRecord(item);
  if (!record.items.length) return;
  const fileName = `${createHash("sha256").update(record.id).digest("hex")}.json`;
  await writeJsonAtomic(path.join(outputRecordDirectory(packagePath), fileName), record);
}

export async function readPackageOutputItems(packagePath) {
  const directory = outputRecordDirectory(packagePath);
  let files;
  try { files = await readdir(directory); }
  catch (error) { if (error.code === "ENOENT") return []; throw error; }
  const items = [];
  for (const file of files.filter((name) => /^[a-f0-9]{64}\.json$/.test(name))) {
    const record = JSON.parse(await readFileWithRetry(path.join(directory, file), "utf8"));
    if (!Array.isArray(record.items)) throw new Error("Invalid package output record. Existing files were preserved.");
    items.push(...record.items);
  }
  return items;
}

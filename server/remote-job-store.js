import { createHash } from "node:crypto";
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { readFileWithRetry } from "./file-write.js";
import { writeJsonAtomic } from "./json-store.js";

// Immutable request specifications are separate from small mutable checkpoints.
export async function openRemoteJobStore(filePath) {
  const directory = `${filePath}.d`;
  const knownSpecs = new Set();
  const read = async (file) => JSON.parse(await readFileWithRetry(file, "utf8"));
  const key = (runId) => createHash("sha256").update(runId).digest("hex");
  let manifest;
  try { manifest = await read(filePath); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  await mkdir(directory, { recursive: true });

  async function save(job) {
    validateJob(job);
    const name = key(job.runId);
    const { spec, ...state } = job;
    if (!knownSpecs.has(name)) {
      await writeJsonAtomic(path.join(directory, `${name}.spec.json`), spec);
      knownSpecs.add(name);
    }
    await writeJsonAtomic(path.join(directory, `${name}.state.json`), state);
  }

  if (manifest?.version === 1) {
    if (!Array.isArray(manifest.jobs)) throw new Error("Invalid remote video job store. Restore the store before submitting generations.");
    manifest.jobs.forEach(validateJob);
    for (const job of manifest.jobs) await save(job);
    await writeJsonAtomic(`${filePath}.legacy-backup`, manifest);
    await writeJsonAtomic(filePath, { version: 2, storage: "per-job" });
  } else if (!manifest) {
    // Rows can exist after a crash between the first checkpoint and manifest creation.
    await writeJsonAtomic(filePath, { version: 2, storage: "per-job" });
  } else if (manifest.version !== 2 || manifest.storage !== "per-job") {
    throw new Error("Invalid remote video job store. Restore the store before submitting generations.");
  }

  const jobs = new Map();
  for (const name of await readdir(directory)) {
    if (!/^[a-f0-9]{64}\.state\.json$/.test(name)) continue;
    const state = await read(path.join(directory, name));
    if (typeof state.runId !== "string" || name !== `${key(state.runId)}.state.json`) throw new Error("Invalid remote video job checkpoint.");
    const spec = await read(path.join(directory, `${key(state.runId)}.spec.json`));
    const job = { ...state, spec };
    validateJob(job);
    jobs.set(job.runId, job);
    knownSpecs.add(key(job.runId));
  }
  return { jobs, save };
}

function validateJob(job) {
  if (!job || typeof job.runId !== "string" || !job.runId || !job.spec?.body || !job.spec.provider) {
    throw new Error("Invalid remote video job store. Restore the store before submitting generations.");
  }
}

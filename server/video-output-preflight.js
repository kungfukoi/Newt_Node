import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { previewOutputTargetAsset } from './outputTargets.js';

export async function verifyVideoOutputDestination(body, { rootDir, fallbackDirectory, allowFallback = true, io = { mkdir, writeFile, rm } } = {}) {
  let probe;
  try {
    const target = await previewOutputTargetAsset(body, 'video', '.mp4', { rootDir });
    const directory = target ? path.dirname(target.filePath) : fallbackDirectory;
    if (!directory) return;
    await io.mkdir(directory, { recursive: true });
    probe = path.join(directory, '.newtnode-write-check-' + randomUUID());
    await io.writeFile(probe, '', { flag: 'wx' });
  } catch (cause) {
    if (allowFallback && body.outputTargetPath && fallbackDirectory) {
      await verifyVideoOutputDestination({}, { rootDir, fallbackDirectory, allowFallback: false, io });
      return { fallback: true };
    }
    throw Object.assign(new Error('The video output folder is unavailable or not writable. Choose an accessible Output folder or workflow outputs before running. No video generation was submitted.'), { status: 400, code: cause.code, cause });
  } finally {
    if (probe) await io.rm(probe, { force: true }).catch(() => {});
  }
}

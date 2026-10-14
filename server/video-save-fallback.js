export const localStorageFailure = error => ['EPERM', 'EACCES', 'ENOSPC', 'EROFS', 'ENOENT', 'ENOTDIR'].includes(error?.code || error?.cause?.code);
export function workflowVideoStorageBody(body) {
  return { ...body, outputTargetPath: '', outputTargetFileName: '', outputDirectory: '', outputFileName: '', outputTargetNodeId: '' };
}

export async function saveGeneratedVideoWithFallback(job, { reserve, download, checkpoint }) {
  let storageBody = job.storageBody || (job.spec.storageFallback ? workflowVideoStorageBody(job.spec.body) : job.spec.body);
  let target = job.target;
  let savedOutput = job.savedOutput;
  let fallback = Boolean(job.storageBody || job.spec.storageFallback);
  async function save() {
    if (!target) { target = await reserve(storageBody); await checkpoint({ target }); }
    if (!savedOutput) { savedOutput = await download(storageBody, target); await checkpoint({ savedOutput }); }
    return savedOutput;
  }
  try { await save(); }
  catch (error) {
    // Preserve the paid provider request and URL. Only redirect local persistence.
    if (!localStorageFailure(error) || fallback || !job.spec.body.outputTargetPath) throw error;
    storageBody = workflowVideoStorageBody(job.spec.body);
    fallback = true; target = null; savedOutput = null;
    await checkpoint({ storageBody, target: null, savedOutput: null });
    await save();
  }
  if (fallback && !job.storageBody) await checkpoint({ storageBody });
  return { output: savedOutput, fallback, warning: fallback ? 'The requested Output folder was unavailable. Video saved to workflow outputs: ' + savedOutput.filePath : '' };
}

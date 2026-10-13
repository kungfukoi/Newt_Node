import { readSelectionMetadata, selectionReferencePrompt } from "../src/imageEditBoxExport.js";

// Read the portable PNG record, rather than depending on transient node state.
export async function appendImageSelectionReferences(prompt, urls, readSource) {
  const instructions = [];
  for (let index = 0; index < urls.length; index++) {
    const { buffer } = await readSource(urls[index]);
    if (!buffer || buffer.length < 8 || buffer[0] !== 137 || buffer.subarray(1, 4).toString() !== "PNG") continue;
    const metadata = readSelectionMetadata(buffer);
    if (!metadata) continue;
    if (metadata.format !== "newtnode-box-selections" || metadata.version !== 1) throw new Error("Unsupported image selection metadata.");
    instructions.push(selectionReferencePrompt(metadata, index + 1));
  }
  return [prompt, ...instructions].join("\n\n");
}

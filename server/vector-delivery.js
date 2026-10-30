import { readFile, writeFile } from 'node:fs/promises';import sharp from 'sharp';import { sanitizeVectorSvg } from './vector-svg.js';
export async function writeVectorDelivery(sourcePath,targetPath,format) { if(format==='svg'){const safe=sanitizeVectorSvg(await readFile(sourcePath),{allowEmpty:true});await writeFile(targetPath,safe.svg,{flag:'wx'});}else if(format==='alpha'){const png=await sharp(sourcePath).ensureAlpha().extractChannel('alpha').png().toBuffer();await writeFile(targetPath,png,{flag:'wx'});}else throw new Error('Choose SVG or alpha.');}

export function validateOutputUrl(url) {
  if (typeof url !== "string" || url.length > 4096 || !/^\/(uploads|outputs|workflow-assets)\//.test(url) || /[?#\x00-\x20\\]/.test(url)) throw new Error("Use a managed image, video, or audio URL from NewtNode uploads, outputs, or a registered workflow package.");
  let decoded;
  try { decoded = decodeURIComponent(url); } catch { throw new Error("The managed source URL is malformed."); }
  if (/[\x00-\x1f\x7f\\:?#]/.test(decoded) || /%(?:2e|2f|5c|00)/i.test(decoded)
    || decoded.slice(1).split("/").some(part => !part || part === "." || part === "..")) throw new Error("The managed source URL contains an unsafe path.");
  return decoded;
}

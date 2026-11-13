import path from "node:path";
import { mkdir,writeFile,rename,realpath } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createStyleFinderCatalog } from "../server/stylefinder-catalog.js";

// Parse the mirror outside the app server. Images and source HTML stay in place.
export async function indexStyleFinder(sourceDirectory,dataDirectory) {
  sourceDirectory=await realpath(sourceDirectory);
  const catalog=createStyleFinderCatalog({root:sourceDirectory});
  const snapshot=await catalog.snapshot(true);
  if(!snapshot.ready||!snapshot.styles.length)throw Error("No readable catalog was found in this folder.");
  const manifest={version:1,sourceDirectory,indexedAt:new Date().toISOString(),snapshot};
  await mkdir(dataDirectory,{recursive:true});
  const filename=path.join(dataDirectory,"stylefinder-audition.json"),temporary=`${filename}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify(manifest),{mode:0o600});await rename(temporary,filename);
  return {indexed:snapshot.styles.length,sourceDirectory};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error("Usage: node scripts/indexStyleFinder.mjs <catalog mirror folder> <local data directory>");
  console.log(JSON.stringify(await indexStyleFinder(path.resolve(process.argv[2]),path.resolve(process.argv[3]))));
}

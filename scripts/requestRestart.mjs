import { writeFile } from "node:fs/promises";
const marker = new URL("../server/restart-marker.js", import.meta.url);
await writeFile(marker, `export const restartMarker = ${JSON.stringify(new Date().toISOString())};\n`, "utf8");

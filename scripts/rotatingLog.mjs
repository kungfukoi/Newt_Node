import { Writable } from "node:stream";
import { StringDecoder } from "node:string_decoder";
import { appendFile, mkdir, stat, rm } from "node:fs/promises";
import path from "node:path";
import { renameFileWithRetry } from "../server/file-write.js";
import { redactRuntimeLog } from "./supervisorPolicy.mjs";

export function createRotatingLog(filePath, { maxBytes = 2 * 1024 * 1024, copies = 4 } = {}) {
  let bytes = 0;
  let pending = "";
  let droppingLine = false;
  const decoder = new StringDecoder("utf8");
  const ready = mkdir(path.dirname(filePath), { recursive: true }).then(async () => {
    try { bytes = (await stat(filePath)).size; } catch (error) { if (error.code !== "ENOENT") throw error; }
  });
  async function persist(line) {
    await ready;
    if (bytes >= maxBytes) {
      await rm(`${filePath}.${copies}`, { force: true });
      for (let index = copies - 1; index >= 0; index--) {
        try { await renameFileWithRetry(index ? `${filePath}.${index}` : filePath, `${filePath}.${index + 1}`); }
        catch (error) { if (error.code !== "ENOENT") throw error; }
      }
      bytes = 0;
    }
    const text = redactRuntimeLog(line);
    await appendFile(filePath, text);
    bytes += Buffer.byteLength(text);
  }
  async function consume(text, final = false) {
    const parts = text.split("\n");
    for (let index = 0; index < parts.length; index++) {
      if (!droppingLine) pending += parts[index];
      if (pending.length > 16384) { pending = ""; droppingLine = true; }
      if (index < parts.length - 1 || final) {
        if (pending || droppingLine) await persist(droppingLine ? "[oversized log line omitted]\n" : pending + "\n");
        pending = ""; droppingLine = false;
      }
    }
  }
  return new Writable({
    write(chunk, encoding, callback) {
      consume(decoder.write(chunk)).then(() => callback(), callback);
    },
    final(callback) {
      consume(decoder.end(), true).then(() => callback(), callback);
    }
  });
}

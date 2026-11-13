import path from "node:path";
import { readFile, stat } from "node:fs/promises";
import { normalizeLibraryStyle } from "../src/styleLibrary.js";

// Personal curation lives outside the downloaded mirror and its regenerated index.
export async function readStyleFinderOverrides(directory) {
  const filename = path.join(directory, "stylefinder-overrides.json");
  let info;
  try { info = await stat(filename); }
  catch (error) { if (error.code === "ENOENT") return { key: "none", styles: {} }; throw error; }
  try {
    if (!info.isFile() || info.size > 1024 * 1024) throw Error("Invalid overrides file");
    const value = JSON.parse(await readFile(filename, "utf8"));
    if (value.version !== 1 || !value.styles || Array.isArray(value.styles) || typeof value.styles !== "object") throw Error("Invalid overrides format");
    const styles = {};
    for (const [id, entry] of Object.entries(value.styles)) {
      if (!/^[a-z0-9-]{1,100}$/.test(id) || !entry || typeof entry.prompt !== "string" || !entry.prompt.trim() || !Array.isArray(entry.examples) || !entry.examples.length || entry.examples.length > 8) throw Error("Invalid override look");
      if (entry.examples.some(image => !/^\/uploads\/stylefinder-overrides\/[a-z0-9/_-]+\.(?:jpg|png|webp)$/i.test(image?.localUrl || ""))) throw Error("Override images must be managed local images");
      const normalized = normalizeLibraryStyle(entry);
      if (normalized.examples.length !== entry.examples.length) throw Error("Invalid managed image reference");
      styles[id] = {
        catalogId: id, prompt: normalized.prompt, notes: normalized.notes,
        examples: normalized.examples, colours: normalized.colours, tags: normalized.tags,
        sourceProvider: "Newt", sourceAttribution: normalized.sourceAttribution || "Locally curated catalog reference",
        // Source render parameters and cached analyses do not describe replacement stills.
        sref: "", midjourneyPrompt: "", styleAnalysis: null,
      };
    }
    return { key: `${info.mtimeMs}:${info.size}`, styles };
  } catch {
    throw Object.assign(new Error("The local catalog overrides file is invalid. Correct stylefinder-overrides.json and refresh."), { status: 503 });
  }
}

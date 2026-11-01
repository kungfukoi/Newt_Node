import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { normalizeLibraryStyle } from "../src/styleLibrary.js";
import { lookTags } from "../src/lookCategories.js";

const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
export function prepareCustomLook(source={}) {
  if(typeof source.name!=="string"||!source.name.trim()||source.name.length>120)invalid("Name your look using 1–120 characters.");
  if(!Array.isArray(source.examples)||!source.examples.length||source.examples.length>6)invalid("Choose one to six images.");
  if(typeof source.prompt!=="string"||source.prompt.trim().length<80||source.prompt.length>6000)invalid("Extract the look and provide a style description (80–6,000 characters).");
  if(!source.styleAnalysis?.fingerprint||!source.styleAnalysis?.stylePrompt)invalid("Analyze your look before saving.");
  if(!Array.isArray(source.tags)||source.tags.length>40||source.tags.some(tag=>typeof tag!=="string"||tag.length>80))invalid("Use up to 40 tags, with at most 80 characters each.");
  const look=normalizeLibraryStyle({...source,tags:lookTags(source.tags),sourceUrl:"",sref:""});
  if(look.examples.length!==source.examples.length)invalid("Look examples must be managed local images.");
  if(!/^look-[a-f0-9-]{36}$/.test(source.id||""))invalid("Invalid created-look identity.");
  look.id=source.id;look.catalogId=source.id;look.category||="Various";look.styleAnalysis.stylePrompt=look.prompt;
  return look;
}
export function createCustomLookStore({ directory }) {
  const filename = path.join(directory, "custom-looks.json");
  let queue = Promise.resolve();
  async function read() {
    try {
      const value = JSON.parse(await readFile(filename, "utf8"));
      if (!Array.isArray(value.looks)) throw new Error("The created-look catalog is invalid.");
      return value.looks;
    } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  }
  function add(source = {}) {
    const pending = queue.then(async () => {
      const look = prepareCustomLook(source);
      const looks = await read(), previous = looks.find(item => item.id === look.id);
      if (previous) {
        if (JSON.stringify(previous) !== JSON.stringify(look)) throw Object.assign(new Error("This look identity has already been saved with different contents. Change the draft to save another look."), { status: 409 });
        return previous;
      }
      if (looks.length >= 5000) invalid("The created-look catalog has reached its 5,000 look limit.");
      await mkdir(directory, { recursive: true });
      const temporary = `${filename}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify({ version: 1, looks: [look, ...looks] }), { mode: 0o600 });
      await rename(temporary, filename);
      return look;
    });
    queue = pending.catch(() => {}); return pending;
  }
  return { read, add };
}
export function registerCustomLookRoutes(app, store) {
  app.post("/api/style-library/created", async (req, res) => {
    try { res.json({ style: await store.add(req.body) }); }
    catch (error) { res.status(error.status || 500).json({ error: error.status ? error.message : "Could not save your look. Your draft is still available; retry Save." }); }
  });
}

import test from "node:test";
import assert from "node:assert/strict";
import { lookStyleText } from "../src/lookStyleText.js";
import { normalizeLibraryStyle,libraryStyleSnapshot } from "../src/styleLibrary.js";

test("Only the former stock opening is removed, retaining style evidence and imported source prose",()=>{
  const style="Fine ink contours, warm paper and transparent washes.";
  for(const opening of ["Preserve the user's requested subject and composition while applying. ","Preserve the requested subject and composition while applying this visual treatment.\n\n","Preserve the requested subject and composition. ","Preserve the user’s requested subject and composition while applying "])
    assert.equal(lookStyleText(opening+style),style);
  assert.equal(lookStyleText("Preserve fine grain and irregular ink edges."),"Preserve fine grain and irregular ink edges.");
  const original="Preserve the requested subject and composition. "+style;
  const saved=normalizeLibraryStyle({prompt:original,styleAnalysis:{stylePrompt:original}});
  assert.equal(saved.prompt,original);assert.equal(saved.styleAnalysis.stylePrompt,style);
  assert.equal(libraryStyleSnapshot({prompt:original}).prompt,style);
});

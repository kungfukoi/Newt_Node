import test from "node:test";
import assert from "node:assert/strict";
import { lookDescriptionBlocks } from "../src/lookDescription.js";
test("Description formatting retains text while separating headings, labels and lists",()=>{
  const source="## Medium\nGouache and fine ink.\n\nColor palette: Ochre, sage and warm paper.\n- Feathered edges\n- Visible grain\n1. Soft light\n2. Restrained contrast";
  const blocks=lookDescriptionBlocks(source);
  assert.deepEqual(blocks.map(block=>block.type),["heading","paragraph","label","list","list"]);
  assert.equal(blocks[2].label,"Color palette");assert.deepEqual(blocks[3].items,["Feathered edges","Visible grain"]);assert.equal(blocks[4].ordered,true);
  assert.equal(source.includes("## Medium"),true);
});
test("Long prose becomes readable paragraphs without losing words; HTML stays plain data",()=>{
  const sentence="Apply softly layered pigment and warm paper textures while preserving the requested subject and composition.";
  const source=Array(9).fill(sentence).join(" ");const blocks=lookDescriptionBlocks(source);
  assert.ok(blocks.length>1);assert.equal(blocks.map(block=>block.text).join(" "),source);
  assert.equal(lookDescriptionBlocks('<img src="x" onerror="bad()">')[0].text,'<img src="x" onerror="bad()">');
});

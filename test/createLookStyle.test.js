import test from "node:test";
import assert from "node:assert/strict";
import {lookStyleBlocks,compileLookStyle} from "../src/createLookStyle.js";
test("Style board compilation includes enabled sections and priorities and excludes legacy palette blocks",()=>{
  const blocks=lookStyleBlocks([
    {id:"medium",text:"Fine broken ink contours"},
    {id:"palette",text:"Restrained warm tones and #cc9933"},
    {id:"texture",text:"Visible paper grain"}
  ],{preserveLegacyPalette:true});
  blocks.find(item=>item.id==="medium").weight="absolute";blocks.find(item=>item.id==="texture").enabled=false;
  const prompt=compileLookStyle(blocks);
  assert.doesNotMatch(prompt,/Preserve|requested subject|composition/);assert.match(prompt,/^### Medium & rendering · absolute/);
  assert.doesNotMatch(prompt,/#cc9933|warm tones|Colour treatment|Visible paper grain/);
  assert.equal(compileLookStyle(blocks.map(item=>({...item,enabled:false}))),"");
  assert.equal(lookStyleBlocks([{id:"medium",text:"x".repeat(900),weight:"invalid"}])[0].text.length,600);
});

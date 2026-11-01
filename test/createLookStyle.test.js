import test from "node:test";
import assert from "node:assert/strict";
import {lookStyleBlocks,compileLookStyle} from "../src/createLookStyle.js";
test("Style board compilation includes enabled sections, editable priorities and palette anchors without another model call",()=>{
  const blocks=lookStyleBlocks({medium:"Fine broken ink contours",palette:"Restrained warm tones",texture:"Visible paper grain"});
  blocks.find(item=>item.id==="medium").weight="absolute";blocks.find(item=>item.id==="texture").enabled=false;
  const prompt=compileLookStyle(blocks,[{name:"ochre",hex:"#cc9933"}]);
  assert.doesNotMatch(prompt,/Preserve|requested subject|composition/);assert.match(prompt,/^### Medium & rendering · absolute/);
  assert.match(prompt,/#cc9933/);assert.doesNotMatch(prompt,/Visible paper grain/);
  assert.equal(compileLookStyle(blocks.map(item=>({...item,enabled:false}))),"");
  assert.equal(lookStyleBlocks([{id:"medium",text:"x".repeat(900),weight:"invalid"}])[0].text.length,600);
});

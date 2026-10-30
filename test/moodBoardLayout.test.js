import test from "node:test";
import assert from "node:assert/strict";
import {createMoodBoardLayout} from "../src/canvasMedia.js";

const image=(width,height)=>({naturalWidth:width,naturalHeight:height});
function verifyTiling(images) {
  const layout=createMoodBoardLayout(images);
  assert.equal(layout.cells.length,images.length);
  assert.equal(new Set(layout.cells.map(cell=>cell.image)).size,images.length);
  let area=0;
  for(const cell of layout.cells) {
    for(const key of ["x","y","width","height"])assert.ok(Number.isInteger(cell[key]),`Integer ${key}`);
    assert.ok(cell.width>0&&cell.height>0);
    assert.ok(cell.x>=0&&cell.y>=0&&cell.x+cell.width<=layout.width&&cell.y+cell.height<=layout.height);
    const ratio=cell.image.naturalWidth/cell.image.naturalHeight;
    assert.ok(Math.abs(cell.width-ratio*cell.height)<=2+2*ratio,"Only integer raster rounding changes the aspect");
    area+=cell.width*cell.height;
  }
  for(let i=0;i<layout.cells.length;i++)for(let j=i+1;j<layout.cells.length;j++) {
    const a=layout.cells[i],b=layout.cells[j];
    assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,"Cells never overlap");
  }
  assert.equal(area,layout.width*layout.height,"Every output pixel belongs to one source image");
  return layout;
}
test("Four square references form a square, gap-free board",()=>{
  const layout=verifyTiling(Array.from({length:4},()=>image(1024,1024)));
  assert.equal(layout.width,1536);assert.equal(layout.height,1536);
  for(const cell of layout.cells){assert.equal(cell.width,768);assert.equal(cell.height,768);}
});
test("Uniform and mixed source aspects tile without padding or a forced output aspect",()=>{
  const ratios=[[1,1],[16,9],[9,16],[4,3],[3,4],[21,9],[12,1],[1,12],[1,100]];
  for(const [w,h] of ratios)for(let count=1;count<=6;count++)verifyTiling(Array.from({length:count},()=>image(w*100,h*100)));
  for(let count=1;count<=6;count++)for(let start=0;start<ratios.length;start++)verifyTiling(Array.from({length:count},(_,i)=>image(...ratios[(start+i)%ratios.length].map(value=>value*100))));
});
test("Single images retain their own aspect, including wide and portrait references",()=>{
  const wide=verifyTiling([image(1200,100)]);assert.equal(wide.width/wide.height,12);
  const portrait=verifyTiling([image(100,1200)]);assert.ok(Math.abs(portrait.width-portrait.height/12)<=0.5,"Portrait scaling differs only by rounding to one output pixel");
});

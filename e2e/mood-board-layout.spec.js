import {test,expect} from "@playwright/test";
import sharp from "sharp";
import {openFixture} from "./helpers.mjs";

const cases=[
  {name:"four square images",sizes:[[96,96],[96,96],[96,96],[96,96]],libraryBoard:true},
  {name:"six mixed portrait, landscape and panoramic images",sizes:[[320,90],[90,320],[128,128],[600,60],[60,600],[180,120]],libraryBoard:true},
  {name:"ordinary uploaded mixed images",sizes:[[210,90],[90,160],[120,120]],libraryBoard:false}
];
for(const sample of cases)test(`Locked Mood Board contains only complete source imagery: ${sample.name}`,async({page})=>{
  const images=[];
  for(const [index,[width,height]] of sample.sizes.entries()) {
    // A white frame around every source makes accidental cover-cropping visible.
    const color=["#d06080","#60c080","#6080d0","#d0a060","#a060d0","#60b0c0"][index];
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#f0f0f0"/><rect x="6" y="6" width="${width-12}" height="${height-12}" fill="${color}"/></svg>`;
    const png=await sharp(Buffer.from(svg)).png().toBuffer();
    images.push({id:`image-${index}`,fileName:`reference-${index}.png`,localUrl:`data:image/png;base64,${png.toString("base64")}`});
  }
  const fixture={nodes:[{id:"mood",type:"transfer",x:30,y:30,data:{title:"Mood Board",transferImages:images,libraryBoard:sample.libraryBoard,locked:false,activated:false}}],edges:[],groups:[],viewport:{x:0,y:0,scale:1}};
  const {errors}=await openFixture(page,{fixture});let compiled;
  await page.route("**/api/node/upload-transfer-collage",async route=>{
    const request=route.request(),body=request.postDataBuffer();
    const boundary=request.headers()["content-type"].match(/boundary=(.+)$/)[1];
    const marker=Buffer.from("Content-Type: image/png\r\n\r\n"),start=body.indexOf(marker)+marker.length,end=body.lastIndexOf(Buffer.from(`\r\n--${boundary}`));
    compiled=body.subarray(start,end);
    return route.fulfill({contentType:"application/json",body:JSON.stringify({asset:{localUrl:"/outputs/e2e/mood.png",fileName:"MOOD_BOARD.png",mimeType:"image/png"}})});
  });
  await page.getByTitle("Compile MOOD_BOARD.png",{exact:true}).click();
  await expect(page.getByTitle("Unlock mood board",{exact:true})).toBeVisible();
  expect(compiled).toBeTruthy();
  const {data,info}=await sharp(compiled).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(sample.sizes.every(([w,h])=>w===h))expect(info.width).toBe(info.height);
  for(let pixel=0;pixel<data.length;pixel+=4) {
    if(data[pixel+3]!==255||data[pixel]<80||data[pixel+1]<80||data[pixel+2]<80)throw new Error(`Added background or uncovered pixel at ${pixel/4}`);
  }
  // Every sampled image retains its white outside edge; no cover crop is allowed.
  const {createMoodBoardLayout}=await import("../src/canvasMedia.js");
  const layout=createMoodBoardLayout(sample.sizes.map(([naturalWidth,naturalHeight])=>({naturalWidth,naturalHeight})));
  for(const cell of layout.cells) {
    const offsets=[[cell.x,cell.y],[cell.x+cell.width-1,cell.y],[cell.x,cell.y+cell.height-1],[cell.x+cell.width-1,cell.y+cell.height-1]];
    for(const [x,y] of offsets){const offset=(y*info.width+x)*4;expect([...data.subarray(offset,offset+3)].every(value=>value>=225)).toBe(true);}
  }
  expect(errors).toEqual([]);
});

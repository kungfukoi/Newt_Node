import test from "node:test";
import assert from "node:assert/strict";
import { storyboardBoardBuildSignature as signature, storyboardBoardCanBuild as canBuild, storyboardBoardIsCurrent as isCurrent } from "../src/useStoryboardBoardOutput.js";
const node={id:"board",type:"storyboard",data:{aspectRatio:"16:9",storyboardFrames:[{id:"a",number:1,resultUrl:"/outputs/a.png",beat:"Opening"}]}};
test("board signature changes only when rendered inputs change",()=>{
 const base=signature(node);
 assert.equal(signature({...node,data:{...node.data,status:"complete",storyboardSelectedFrameIds:["a"]}}),base);
 for(const patch of [{resultUrl:"/outputs/b.png"},{beat:"New caption"},{resultVersion:2},{number:2}])assert.notEqual(signature({...node,data:{...node.data,storyboardFrames:[{...node.data.storyboardFrames[0],...patch}]}}),base);
 assert.notEqual(signature({...node,data:{...node.data,aspectRatio:"1:1"}}),base);
});
test("assembly waits for active operations and handles empty and partial boards",()=>{
 assert.equal(canBuild(node),true);assert.equal(canBuild({...node,data:{storyboardFrames:[]}}),false);
 for(const status of ["running","revising","planning","reviewing-sequence","exporting","compiling-characters"]){assert.equal(canBuild({...node,data:{...node.data,status}}),false);}
 assert.equal(canBuild({...node,data:{storyboardFrames:[...node.data.storyboardFrames,{id:"b",status:"queued"}]}}),false);
 assert.equal(canBuild({...node,data:{storyboardFrames:[...node.data.storyboardFrames,{id:"b",status:"error"}]}}),true);
});
test("legacy locked boards stay usable; fingerprinted stale outputs are rejected",()=>{
 const withBoard={...node,data:{...node.data,storyboardBoardUrl:"/uploads/board.png"}};
 assert.equal(isCurrent(withBoard),true);
 assert.equal(isCurrent({...withBoard,data:{...withBoard.data,storyboardBoardSource:signature(node)}}),true);
 assert.equal(isCurrent({...withBoard,data:{...withBoard.data,storyboardBoardSource:"old"}}),false);
});

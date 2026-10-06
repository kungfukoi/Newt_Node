import test from "node:test";
import assert from "node:assert/strict";
import { registerStoryboardReviewRoutes } from "../server/routes/storyboardReview.js";
import { storyboardReviewSignature } from "../src/storyboardSequenceReview.js";
import { clearStaleRunningState } from "../src/workflowState.js";
const frames=[{id:"a",number:1,prompt:"Opening"},{id:"b",number:2,prompt:"Ending"}];
const review={summary:"Clear story",issues:[{frameIds:["b"],message:"Add a closer reaction"}]};
function harness(output=review) {
 let handler;const calls=[],records=[];
 const run=async options=>{calls.push(options);return {text:JSON.stringify(output),provider:"mock"};};
 registerStoryboardReviewRoutes({post:(_,fn)=>handler=fn},{runTextLlm:run,runMediaDescriptionLlm:run,recordUsage:async(...args)=>records.push(args),estimateCost:()=>({amountUsd:0.01}),getModels:()=>({})});
 return {handler,calls,records};
}
const response=()=>({code:200,status(code){this.code=code;return this;},json(data){this.data=data;return this;}});
test("sequence review is advisory and distinguishes directions from visual review",async()=>{
 for(const boardUrl of ["","/outputs/board.png"]){const h=harness(),res=response();await h.handler({body:{frames,boardUrl}},res);assert.equal(res.code,200);assert.equal(res.data.review.directionsOnly,!boardUrl);assert.equal(h.records.length,1);assert.equal(Boolean(h.calls[0].inputs),Boolean(boardUrl));assert.equal(frames[1].prompt,"Ending");}
});
test("sequence rejects unmanaged sources and malformed panels before paid calls",async()=>{
 const h=harness();for(const body of [{frames:[]},{frames:[frames[0],frames[0]]},{frames,boardUrl:"https://example.com/a.png"}]){const res=response();await h.handler({body},res);assert.equal(res.code,400);}assert.equal(h.calls.length,0);
});
test("unknown panel notes are rejected and paid usage is still recorded",async()=>{
 const h=harness({...review,issues:[{frameIds:["missing"],message:"Wrong"}]}),res=response();await h.handler({body:{frames}},res);assert.equal(res.code,400);assert.equal(h.records.length,1);
});
test("review signature detects changed images and interrupted reviews do not resume",()=>{
 assert.notEqual(storyboardReviewSignature(frames),storyboardReviewSignature([{...frames[0],resultUrl:"/outputs/new.png"},frames[1]]));
 assert.equal(clearStaleRunningState({type:"storyboard",data:{status:"reviewing-sequence",storyboardFrames:frames}}).data.status,"error");
});

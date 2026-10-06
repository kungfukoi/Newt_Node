import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { storyboardQcMode } from "../src/storyboardQc.js";
import { runStoryboardQc, storyboardQcDecision, storyboardQcImage } from "../server/storyboard-qc.js";
const pass = { pass:true, severity:"ok", failureType:"none", confidence:"high", needsDetail:false, shouldRetry:false, summary:"Readable", issues:[], correctionPrompt:"" };
const major = {...pass,pass:false,severity:"major",failureType:"spatial",shouldRetry:true,correctionPrompt:"Restore occupant"};
const asset = {buffer:await sharp({create:{width:2400,height:1200,channels:3,background:"white"}}).png().toBuffer(),mimeType:"image/png"};
async function run(mode, verdicts) {
 const calls=[],records=[];
 const result=await runStoryboardQc({input:{sourceUrl:"/outputs/a.png",previousFrameUrl:"/outputs/b.png",qcMode:mode},readAsset:async()=>asset,review:async input=>{calls.push(input);const qc=verdicts.shift();if(qc instanceof Error)throw qc;return {qc,cost:{amountUsd:0.01}};},recordUsage:async(...args)=>records.push(args)});
 return {result,calls,records};
}
test("QC migration honors explicit mode and legacy disable",()=>{
 assert.equal(storyboardQcMode({}),"balanced");assert.equal(storyboardQcMode({storyboardAutoQc:false}),"off");assert.equal(storyboardQcMode({storyboardAutoQc:false,storyboardQcMode:"deep"}),"deep");
});
test("Off skips all image reads and provider requests",async()=>{
 const fail=()=>{throw new Error("Must not call")};
 const result=await runStoryboardQc({input:{qcMode:"off"},readAsset:fail,review:fail,recordUsage:fail});assert.equal(result.cost.amountUsd,0);
});
test("Balanced uses bounded review copies and one call for a clear pass",async()=>{
 const {result,calls,records}=await run("balanced",[pass]);assert.equal(calls.length,1);assert.equal(records.length,1);assert.equal(result.qc.pass,true);assert.equal(calls[0].reasoningEffort,"low");
 assert.equal((await sharp(calls[0].preparedInputs[0].asset.buffer).metadata()).width,1536);assert.equal((await sharp(calls[0].preparedInputs[1].asset.buffer).metadata()).width,1024);
});
test("Balanced confirms a suspected major failure and accounts for both calls",async()=>{
 const {result,calls,records}=await run("balanced",[major,major]);assert.equal(calls.length,2);assert.equal(records.length,2);assert.equal(result.cost.amountUsd,0.02);assert.equal(result.qc.shouldRetry,true);assert.equal(calls[1].reasoningEffort,"high");assert.equal((await sharp(calls[1].preparedInputs[0].asset.buffer).metadata()).width,2048);
});
test("uncertain confirmation cannot trigger generation; polish is advisory",async()=>{
 const {result}=await run("balanced",[major,{...major,confidence:"low"}]);assert.equal(result.qc.shouldRetry,false);assert.equal(result.qc.severity,"unreviewed");
 assert.equal(storyboardQcDecision({...major,failureType:"polish"}).shouldRetry,false);
 const confirmed=await run("balanced",[major,pass]);assert.equal(confirmed.result.qc.shouldRetry,false);
});
test("Deep reviews originals once with high reasoning",async()=>{
 const {calls}=await run("deep",[pass]);assert.equal(calls.length,1);assert.equal(calls[0].preparedInputs[0].asset,asset);assert.equal(calls[0].reasoningEffort,"high");
});
test("review copies preserve aspect ratio and original source bytes",async()=>{
 const original=Buffer.from(asset.buffer), copy=await storyboardQcImage(asset,1024), meta=await sharp(copy.buffer).metadata();assert.equal(meta.width,1024);assert.equal(meta.height,512);assert.deepEqual(asset.buffer,original);
});
test("provider or schema failure is not retried and paid invalid usage is recorded",async()=>{
 let calls=0,records=0;const error=Object.assign(new Error("Invalid structured result"),{llmResult:{provider:"mock"},cost:{amountUsd:0.03}});
 await assert.rejects(runStoryboardQc({input:{sourceUrl:"/outputs/a.png",qcMode:"balanced"},readAsset:async()=>asset,review:async()=>{calls++;throw error;},recordUsage:async()=>{records++;}}),/Invalid/);
 assert.equal(calls,1);assert.equal(records,1);assert.equal(error.cost.amountUsd,0.03);assert.equal(error.qcUsageRecorded,true);
});

 test("interrupted QC and sequence review requests are never replayed",async t=>{
 const {nodeApi}=await import("../src/api/newtApi.js");let calls=0;t.mock.method(globalThis,"fetch",async()=>{calls++;throw Error("closed")});
 await assert.rejects(nodeApi.reviewStoryboardFrame({}),/no request was resubmitted/);assert.equal(calls,1);
 await assert.rejects(nodeApi.reviewStoryboardSequence({}),/no request was resubmitted/);assert.equal(calls,2);
 });

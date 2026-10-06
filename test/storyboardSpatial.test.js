import { nodeApi } from "../src/api/newtApi.js";
import { registerStoryboardRevisionRoutes } from "../server/routes/storyboardRevisions.js";
import test from "node:test";
import assert from "node:assert/strict";
import { storyboardSpatialPlanIssues, storyboardSpatialPrompt, reconcileStoryboardSpatial, invalidateStoryboardStaging } from "../src/storyboardSpatial.js";
import { storyboardFrameDirection } from "../src/storyboardRevisions.js";
import { versionStoryboardReplacement, restoreStoryboardVersion } from "../src/storyboardVersions.js";
import { validateCreativeResponse } from "../server/creative-llm.js";
const characters=[{tag:"Alice"},{tag:"Bob"}];
const cast=tag=>({tag,visibility:"visible",position:tag+" seat",action:"Seated",eyeline:"Across table"});
const frame=(number=1)=>({id:"f"+number,number,shot:"MS",lens:"35mm",angle:"None",beat:"Conversation",prompt:"Moment "+number,notes:"",cast:[cast("Alice"),cast("Bob")],spatial:{spaceId:"cafe",cameraSetupId:"master",view:"Both seats and table",visiblePlaces:["west-seat","east-seat"],present:[{tag:"Alice",place:"west-seat"},{tag:"Bob",place:"east-seat"}],hidden:[],blockingChange:""}});
function missing(number=2){const f=frame(number);f.cast[1].visibility="offscreen";f.spatial.hidden=[{tag:"Bob",reason:"outside-frame",explanation:"Focus on Alice"}];return f;}
const issues=frames=>storyboardSpatialPlanIssues(frames,characters).map(i=>i.message).join(" ");
test("a listening partner cannot disappear while their seat stays in view",()=>{
 assert.match(issues([frame(),missing()]),/still in view/);
 const changed=missing();changed.spatial.cameraSetupId="new-camera";assert.match(issues([frame(),changed]),/still in view/);
});
test("real singles and occlusion remain valid",()=>{
 const single=missing();single.spatial.cameraSetupId="single";single.spatial.view="Only west seat; east seat outside crop";single.spatial.visiblePlaces=["west-seat"];
 assert.equal(issues([frame(),single]),"");
 const occluded=missing();occluded.spatial.cameraSetupId="pillar-view";occluded.spatial.hidden[0]={tag:"Bob",reason:"occluded",explanation:"Opaque pillar entirely blocks Bob"};
 assert.equal(issues([frame(),occluded]),"");
});
test("physical moves, entrances and exits require an explicit blocking change",()=>{
 const moved=frame(2);moved.spatial.present[1].place="door";moved.spatial.visiblePlaces[1]="door";
 assert.match(issues([frame(),moved]),/without physical movement/);
 moved.spatial.blockingChange="Bob walks to the door";assert.equal(issues([frame(),moved]),"");
 const gone=frame(2);gone.spatial.present.pop();gone.cast.pop();assert.match(issues([frame(),gone]),/without an exit/);
 gone.spatial.blockingChange="Bob exits the cafe";assert.equal(issues([frame(),gone]),"");
});
test("returning to the same camera preserves its visible world places",()=>{
 const single=missing();single.spatial.cameraSetupId="single";single.spatial.visiblePlaces=["west-seat"];
 const returned=missing(3);returned.spatial.visiblePlaces=["west-seat"];
 assert.match(issues([frame(),single,returned]),/unchanged camera setup/);
});
test("legacy frames stay usable and break inferred continuity chains",()=>{
 assert.equal(issues([{number:1,prompt:"Old"}]),"");
 assert.equal(storyboardSpatialPrompt(null),"");
 assert.equal(storyboardSpatialPrompt({}),"");
 assert.equal(issues([frame(),{number:2,prompt:"Old"},frame(3)]),"");
});
test("one correction can repair occupancy but cannot invent a new view",async()=>{
 let calls=0;const original=[frame(),missing()];const repaired=await reconcileStoryboardSpatial(original,characters,async()=>{calls++;return {frames:[{...frame(2),spatial:original[1].spatial,cast:[cast("Alice"),cast("Bob")]}]};}).catch(()=>null);
 // A valid correction also removes the contradictory hidden entry.
 assert.equal(repaired,null);assert.equal(calls,1);
 const fixed=await reconcileStoryboardSpatial(original,characters,async()=>({frames:[frame(2)]}));assert.equal(issues(fixed),"");assert.equal(original[1].cast[1].visibility,"offscreen");
 await assert.rejects(reconcileStoryboardSpatial(original,characters,async()=>({frames:[{...frame(2),spatial:{...frame(2).spatial,cameraSetupId:"invented"}}]})),/camera framing/);
});
test("selected correction leaves neighboring panels immutable",async()=>{
 const original=[frame(),missing(),frame(3)];
 const fixed=await reconcileStoryboardSpatial(original,characters,async()=>({frames:[frame(2)]}),[2]);
 assert.equal(fixed[0],original[0]);assert.equal(fixed[2],original[2]);
 await assert.rejects(reconcileStoryboardSpatial(original,characters,async()=>({frames:[frame(3)]}),[2]),/selected panels/);
});
test("staging travels with direction versions and manual edits invalidate future hidden instructions",()=>{
 const original={...frame(),resultUrl:"/outputs/old.png",exportUrl:"",generatedDirection:storyboardFrameDirection(frame())};
 const patch=invalidateStoryboardStaging(original,{prompt:"Different camera"});assert.equal(patch.spatial,null);assert.deepEqual(patch.cast,[]);
 const next=versionStoryboardReplacement(original,{...original,...patch,resultUrl:"/outputs/new.png"});
 assert.deepEqual(next.versions[0].spatial,original.spatial);
 assert.deepEqual(restoreStoryboardVersion(next,0).spatial,original.spatial);
 assert.match(storyboardSpatialPrompt(original.spatial),/Bob at east-seat/);
});
test("structured planning schema requires spatial and cast records",()=>{
 const {id,...f}=frame();const result={route:"storyboard-plan",provider:"mock",text:JSON.stringify({sceneTitle:"Cafe",analysis:"Conversation",frames:[f]})};
 assert.doesNotThrow(()=>validateCreativeResponse({},result));delete f.spatial;
 assert.throws(()=>validateCreativeResponse({},{...result,text:JSON.stringify({sceneTitle:"Cafe",analysis:"Conversation",frames:[f]})}));
});

test("revision route records both planning calls and repairs only selected panels",async()=>{
 let handler;const calls=[],records=[];
 registerStoryboardRevisionRoutes({post:(_path,fn)=>handler=fn},{getModels:()=>({}),estimateCost:()=>({amountUsd:0.01}),recordUsage:async generated=>records.push(generated),runTextLlm:async args=>{
  calls.push(args);return {provider:"mock",text:JSON.stringify(args.route==="storyboard-spatial-repair"?{frames:[{...frame(2)}]}:{frames:[missing()],warnings:[]})};
 }});
 const response={code:200,status(code){this.code=code;return this},json(value){this.value=value}};
 await handler({body:{sceneDescription:"Alice and Bob talk",instruction:"Alice sips",frames:[frame(),frame(2),frame(3)],frameIds:["f2"],characters}},response);
 assert.equal(response.code,200);assert.equal(calls.length,2);assert.equal(records.length,2);
 assert.equal(response.value.revision.frames[0].cast[1].visibility,"visible");
 assert.deepEqual(response.value.revision.frames.map(f=>f.id),["f2"]);
});

test("interrupted spatial planning is not submitted a second time",async t=>{
 let calls=0;t.mock.method(globalThis,"fetch",async()=>{calls++;throw Error("connection closed")});
 await assert.rejects(nodeApi.planStoryboard({sceneDescription:"Two people talk"}),/no request was resubmitted/);assert.equal(calls,1);
});

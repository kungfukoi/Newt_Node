import test from "node:test";
import assert from "node:assert/strict";
import { versionStoryboardReplacement, restoreStoryboardVersion, normalizeStoryboardVersions, canMoveStoryboardFrame } from "../src/storyboardVersions.js";
const frame = { id: "a", number: 1, prompt: "Original", beat: "Beat", notes: "", shot: "WS", angle: "None", lens: "35mm", resultUrl: "/outputs/old.png", exportUrl: "", status: "complete" };
test("successful replacement stores the image's original direction, without recursive history", () => {
 const original={...frame,prompt:"Edited future prompt",generatedDirection:{...frame,prompt:"Original"}};
 const next=versionStoryboardReplacement(original,{...original,resultUrl:"/outputs/new.png"},123);
 assert.equal(next.versions[0].prompt,"Original");assert.equal(next.versions[0].resultUrl,frame.resultUrl);
 assert.equal(next.generatedDirection.prompt,"Edited future prompt");assert.equal(next.versions[0].versions,undefined);
 assert.equal(versionStoryboardReplacement(frame,{...frame,status:"error"}).versions,undefined);
});
test("history is bounded at eight and restoration saves displaced current work", () => {
 let current=frame;
 for(let i=0;i<12;i++)current=versionStoryboardReplacement(current,{...current,resultUrl:"/outputs/"+i+".png",prompt:"Prompt "+i},i);
 assert.equal(current.versions.length,8);
 const old=current.versions[0];const restored=restoreStoryboardVersion(current,0,50);
 assert.equal(restored.resultUrl,old.resultUrl);assert.equal(restored.prompt,old.prompt);assert.equal(restored.versions.length,8);
 assert.equal(restored.versions.at(-1).resultUrl,current.resultUrl);assert.equal(restored.id,frame.id);assert.equal(restored.number,1);
 assert.deepEqual(normalizeStoryboardVersions(JSON.parse(JSON.stringify(restored.versions))),restored.versions);
});
test("protected panels reject media replacements, restore and moves across their position", () => {
 const protectedFrame={...frame,protected:true,versions:[frame]};
 assert.equal(versionStoryboardReplacement(protectedFrame,{...protectedFrame,resultUrl:"/outputs/new.png"}),protectedFrame);
 assert.throws(()=>restoreStoryboardVersion(protectedFrame,0),/Unprotect/);
 assert.throws(()=>restoreStoryboardVersion({...protectedFrame,protected:false,status:"running"},0),/idle/);
 const frames=[{id:"a"},{id:"b",protected:true},{id:"c"},{id:"d"}];
 assert.equal(canMoveStoryboardFrame(frames,"a","c"),false);assert.equal(canMoveStoryboardFrame(frames,"b","c"),false);assert.equal(canMoveStoryboardFrame(frames,"c","d"),true);
});
test("legacy panels without history remain valid and first images do not create empty versions", () => {
 assert.deepEqual(normalizeStoryboardVersions(undefined),[]);
 const next=versionStoryboardReplacement({...frame,resultUrl:""},frame);
 assert.deepEqual(next.versions,[]);
 assert.throws(()=>restoreStoryboardVersion(frame,0),/no longer/);
});

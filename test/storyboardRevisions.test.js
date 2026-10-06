import test from "node:test";
import assert from "node:assert/strict";
import { storyboardRevisionTargets, validateStoryboardRevision, storyboardRevisionSourceMatches } from "../src/storyboardRevisions.js";
import { registerStoryboardRevisionRoutes } from "../server/routes/storyboardRevisions.js";
import { validateCreativeResponse } from "../server/creative-llm.js";
import { clearStaleRunningState, resetCopiedNodeRuntime } from "../src/workflowState.js";
import { nodeApi } from "../src/api/newtApi.js";
const frame = (id, number) => ({ id, number, shot: "WS", lens: "35mm", angle: "None", beat: "Walk", prompt: "A person walks", notes: "", resultUrl: "/outputs/old.png", exportUrl: "", status: "complete" });
const frames = [frame("a", 1), frame("b", 2), frame("c", 3)];
const revision = { frames: [{ id: "b", number: 2, shot: "CU", lens: "85mm", angle: "None", beat: "Smile", prompt: "A person smiles", notes: "Keep wardrobe" }], warnings: [] };
const body = { projectId: "test", nodeId: "board", sceneDescription: "A person walks", instruction: "Closer framing", frames, frameIds: ["b"] };
const res = () => ({ code: 200, status(code) { this.code=code; return this; }, json(data) { this.data=data; } });
function harness(generate = async () => ({ text: JSON.stringify(revision), provider: "mock", model: "model", usage: { input_tokens: 100 } })) {
  let handler; const records=[],calls=[];
  const llm = async args => { calls.push(args); return generate(args); };
  registerStoryboardRevisionRoutes({ post(path, fn) { handler=fn; } }, { runTextLlm: llm, runMediaDescriptionLlm: llm, recordUsage: async (...args) => records.push(args), getModels: () => ({ openAiModel: "test" }), estimateCost: () => ({ amountUsd: 0.01 }) });
  return { handler, records, calls };
}
test("selected revision preserves exact IDs, numbers and unselected panels", () => {
  assert.deepEqual(storyboardRevisionTargets(frames, ["b"]), [frames[1]]);
  assert.equal(validateStoryboardRevision(revision, frames, ["b"])[0].shot, "CU");
  for (const ids of [[], ["a", "a"], ["unknown"], Array(9).fill("a")]) assert.throws(() => storyboardRevisionTargets(frames, ids));
  assert.throws(() => storyboardRevisionTargets([{ ...frames[0], protected: true }], ["a"]));
  assert.throws(() => validateStoryboardRevision({ frames: [{...revision.frames[0], id: "a"}] }, frames, ["b"]));
  assert.throws(() => validateStoryboardRevision({ frames: [{...revision.frames[0], number: 1}] }, frames, ["b"]));
  assert.throws(() => validateCreativeResponse({}, { route: "storyboard-revision", provider: "mock", text: JSON.stringify({ ...revision, frames: [{...revision.frames[0], shot: "invalid"}] }) }));
  assert.ok(storyboardRevisionSourceMatches({...frames[1], status: "queued"}, frames[1]));
  assert.equal(storyboardRevisionSourceMatches({...frames[1], prompt: "Changed"}, frames[1]), false);
  assert.equal(storyboardRevisionSourceMatches({...frames[1], resultUrl: "/outputs/new.png"}, frames[1]), false);
});
test("revision route uses originals as visual context and records planning cost", async () => {
  const h=harness(), r=res(); await h.handler({body},r);
  assert.equal(r.code,200); assert.deepEqual(r.data.revision,revision);
  assert.deepEqual(h.calls[0].inputs,[{url: "/outputs/old.png",label: "Existing panel 2"}]);
  assert.equal(JSON.parse(h.calls[0].prompt).panels.length,3);
  assert.equal(h.records.length,1); assert.equal(h.records[0][0].cost.amountUsd,0.01);
});
test("invalid selection and unmanaged images fail before planning", async () => {
  const h=harness();
  for (const patch of [{frameIds: ["missing"]},{instruction: ""},{frames: frames.map(f=>({...f,resultUrl:"https://example.com/x.png"}))}]) {
    const r=res(); await h.handler({body:{...body,...patch}},r); assert.equal(r.code,400);
  }
  assert.equal(h.calls.length,0);
});
test("invalid paid revisions are recorded without modifying frames", async () => {
  const h=harness(async()=>({text: JSON.stringify({frames: []}),provider: "mock"})), r=res();
  await h.handler({body},r); assert.equal(r.code,400); assert.equal(h.records.length,1);
  assert.equal(frames[1].resultUrl,"/outputs/old.png");
});
test("concurrent revisions for one node submit only once", async () => {
  let release; const h=harness(()=>new Promise(resolve=>{release=resolve}));
  const first=h.handler({body},res()); const r=res(); await h.handler({body},r); assert.equal(r.code,409);
  release({text:JSON.stringify(revision)}); await first; assert.equal(h.calls.length,1);
});
test("reload and copy preserve originals after interruption", () => {
  const data={status:"revising",storyboardRevisionActive:true,storyboardFrames:frames,storyboardRevisionInstruction:"Closer",storyboardSelectedFrameIds:["b"]};
  const recovered=clearStaleRunningState({type:"storyboard",data}).data;
  assert.equal(recovered.status,"error"); assert.deepEqual(recovered.storyboardFrames,frames);
  assert.deepEqual(resetCopiedNodeRuntime(data),recovered);
});
test("interrupted revision planning is never replayed", async t => {
  let calls=0;t.mock.method(globalThis,"fetch",async()=>{calls++;throw Error("closed")});
  await assert.rejects(nodeApi.reviseStoryboard(body),/no request was resubmitted/);assert.equal(calls,1);
});

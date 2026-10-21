import test from "node:test";
import assert from "node:assert/strict";
import { runOutpaintRetries } from "../src/nodeRunners/outpaintRetries.js";
const node = { data: { utilityVideoModel: "Video Outpaint", videoOutpaint: { model: "seedance-2.5", frame: { x: 0, y: -0.3, width: 1 } }, prompt: "User direction", videoOutpaintRepair: true, videoOutpaintRepairFindings: [{ category: "geometry" }] } };
test("QC never replays generation for defects or missing fill and preserves the manual run", async () => {
  for (const qc of [{status:"passed_checks"}, {status:"needs_review", missingFillFrames:21}, {status:"needs_review", visual:{status:"needs_review",issues:[{category:"geometry"}]}}]) {
    const requests=[], retained=[], stages=[];
    const result=await runOutpaintRetries({node, generate:async request=>{requests.push(request);return {url:"/candidate.mov",videoOutpaint:{qc}};},onResult:items=>retained.push(...items),onRetry:attempt=>stages.push(attempt)});
    assert.equal(requests.length,1);assert.equal(retained.length,1);assert.deepEqual(stages,[]);assert.equal(result.url,"/candidate.mov");
    assert.equal(requests[0].data.videoOutpaintRepair,undefined);assert.equal(requests[0].data.prompt,node.data.prompt);assert.deepEqual(requests[0].data.videoOutpaint.frame,node.data.videoOutpaint.frame);
  }
});
test("stopped outpainting cannot submit a generation", async()=>{
  await assert.rejects(runOutpaintRetries({node,isStopped:()=>true,generate:()=>assert.fail("Stopped run submitted")}),/stopped/);
});

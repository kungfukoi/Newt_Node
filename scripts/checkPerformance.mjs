import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createWorkflowFingerprint, cloneGraphState } from "../src/workflowState.js";
import { canvasFixture } from "../e2e/fixtures.mjs";

const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const results = [];
for (const count of [271, 600]) {
  const state = canvasFixture({ count });
  state.nodes = state.nodes.map((node) => ({ ...node, data: { ...node.data, text: "Fixed representative stored prompt and settings. ".repeat(125) } }));
  const fingerprint = createWorkflowFingerprint();
  const reference = (value) => {
    const { nodes, edges, groups } = cloneGraphState(value);
    return JSON.stringify({ nodes, edges, groups, projectName: value.projectName, projectPackagePath: value.projectPackagePath });
  };
  const expected = reference(state);
  assert.equal(fingerprint(state), expected);
  const timings = (fn) => Array.from({ length: 21 }, () => {
    const start = performance.now(); fn(state); return performance.now() - start;
  });
  const legacyMs = median(timings(reference));
  const cachedMs = median(timings(fingerprint));
  // Relative to full cloning on the same runner, rather than a hardware-specific FPS promise.
  assert.ok(cachedMs < legacyMs * 0.4, `Fingerprint budget exceeded for ${count} nodes: ${cachedMs}/${legacyMs}`);
  const edited = { ...state, nodes: state.nodes.map((node, index) => index === 2 ? { ...node, data: { ...node.data, text: "Changed" } } : node) };
  assert.equal(fingerprint(edited), reference(edited));
  assert.equal(fingerprint(state), expected);
  results.push({ nodes: count, bytes: Buffer.byteLength(expected), legacyMs: +legacyMs.toFixed(3), cachedMs: +cachedMs.toFixed(3), speedup: +(legacyMs / cachedMs).toFixed(1) });
}
console.log(JSON.stringify({ benchmark: "exact workflow fingerprint", results }, null, 2));

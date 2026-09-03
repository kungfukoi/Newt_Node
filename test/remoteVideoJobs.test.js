import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { createRemoteVideoJobs } from "../server/remote-video-jobs.js";
import { confirmedProviderFailure } from "../server/seedance-job-provider.js";
import { remoteVideoScope, remoteVideoWarningMs } from "../src/remoteVideoJobs.js";

const spec = {
  provider: "krea", modelName: "Seedance 2.5", endpoint: "/generate/video/example", input: { prompt: "private prompt" },
  credentialFingerprint: "fingerprint", body: { projectId: "p", nodeId: "n", generationGroupId: "g", generationBatchTotal: 2, generationBatchIndex: 1 }
};
const video = { video: { url: "https://example.test/video.mp4" } };

async function fixture(t, overrides = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), "newt-remote-jobs-"));
  const filePath = path.join(dir, "jobs.json");
  const services = [];
  t.after(async () => { for (const service of services) await service.close(); await rm(dir, { recursive: true, force: true }); });
  let clock = Date.parse("2026-09-03T00:00:00Z");
  let submits = 0;
  let polls = 0;
  let saves = 0;
  const options = {
    filePath, autoStart: false, now: () => clock,
    adapter: async () => ({ submit: async () => ({ requestId: `provider-${++submits}` }), poll: async () => { polls++; return { state: "running", providerStatus: "processing" }; } }),
    finalize: async (job) => { saves++; return { generationRunId: job.runId, video: { localUrl: "/outputs/video.mp4" } }; },
    ...overrides
  };
  async function open(extra = {}) { const service = await createRemoteVideoJobs({ ...options, ...extra }); services.push(service); return service; }
  return { filePath, open, advance: (ms) => { clock += ms; }, counts: () => ({ submits, polls, saves }) };
}

test("20 minutes is a per-job warning, not a timeout; restart reuses accepted ID", async (t) => {
  const f = await fixture(t);
  let service = await f.open();
  await service.create("one", spec, "hash");
  await service.step("one");
  assert.equal(service.get("one").requestId, "provider-1");
  f.advance(remoteVideoWarningMs + 1);
  await service.step("one");
  assert.equal(service.get("one").state, "running");
  assert.match(service.get("one").message, /longer than 20 minutes/);
  await service.close();
  service = await f.open();
  await service.step("one");
  assert.equal(f.counts().submits, 1);
  assert.equal(f.counts().polls, 3);
  assert.equal(service.get("one").requestId, "provider-1");
});

test("each batch job can finish independently and old completed peers remain in progress", async (t) => {
  const f = await fixture(t);
  const service = await f.open({ adapter: async () => ({ submit: async (s) => ({ requestId: `id-${s.body.generationBatchIndex}` }), poll: async (job) => job.requestId === "id-1" ? { remote: video } : { state: "running" } }) });
  await service.create("one", spec);
  await service.create("two", { ...spec, body: { ...spec.body, generationBatchIndex: 2 } });
  await service.step("one");
  await service.step("two");
  f.advance(remoteVideoWarningMs * 3);
  await service.step("two");
  assert.equal(service.get("one").state, "completed");
  assert.equal(service.get("two").state, "running");
  assert.equal(service.progress().length, 2);
  assert.equal(service.progress()[0].percent, 100);
  assert.equal(f.counts().saves, 1);
});

test("concurrent duplicate creates and steps only submit once", async (t) => {
  const f = await fixture(t);
  const service = await f.open();
  await Promise.all([service.create("one", spec, "hash"), service.create("one", spec, "hash")]);
  await Promise.all([service.step("one"), service.step("one")]);
  assert.equal(f.counts().submits, 1);
  assert.equal(service.matches("one", "hash"), true);
  assert.equal(service.matches("one", "other"), false);
});

test("polling errors and expired downloads recover without a second submission", async (t) => {
  let submits = 0, polls = 0, saves = 0;
  const f = await fixture(t, {
    adapter: async () => ({
      submit: async () => ({ requestId: `id-${++submits}` }),
      poll: async () => { if (++polls === 1) throw new Error("network down"); return { remote: video }; }
    }),
    finalize: async () => { if (++saves === 1) throw Object.assign(new Error("expired URL"), { refreshRemote: true }); return { video: { localUrl: "/outputs/done.mp4" } }; }
  });
  const service = await f.open();
  await service.create("one", spec);
  await service.step("one");
  assert.equal(service.get("one").state, "recovering");
  await service.step("one");
  assert.equal(service.get("one").state, "recovering");
  await service.step("one");
  assert.equal(service.get("one").state, "completed");
  assert.equal(submits, 1);
  assert.equal(polls, 3);
});

test("download checkpoints survive restart and reuse reserved output", async (t) => {
  let saved = 0;
  const f = await fixture(t, {
    adapter: async () => ({ submit: async () => ({ requestId: "accepted" }), poll: async () => ({ remote: video }) }),
    finalize: async (job, checkpoint) => {
      if (!job.target) await checkpoint({ target: { filePath: "reserved-output" } });
      if (!job.savedOutput) { saved++; await checkpoint({ savedOutput: { filePath: "reserved-output" } }); throw new Error("history unavailable"); }
      assert.equal(job.target.filePath, "reserved-output");
      return { video: { localUrl: "/outputs/done.mp4" } };
    }
  });
  let service = await f.open();
  await service.create("one", spec);
  await service.step("one");
  await service.close();
  service = await f.open({ adapter: async () => { throw new Error("must not contact provider after download"); } });
  await service.step("one");
  assert.equal(service.get("one").state, "completed");
  assert.equal(saved, 1);
});

test("ambiguous POST remains uncertain after restart and is never resubmitted", async (t) => {
  let submits = 0;
  const f = await fixture(t, { adapter: async () => ({ submit: async () => { submits++; throw new Error("connection lost"); } }) });
  let service = await f.open();
  await service.create("one", spec);
  await service.step("one");
  assert.equal(service.get("one").state, "uncertain");
  await service.close();
  service = await f.open();
  await service.step("one");
  assert.equal(service.get("one").state, "uncertain");
  assert.equal(submits, 1);
});

test("confirmed rejection fails, but a missing original credential waits", async (t) => {
  let credentialReady = false;
  const f = await fixture(t, { adapter: async () => {
    if (!credentialReady) throw Object.assign(new Error("disabled"), { waitingForCredential: true });
    return { submit: async () => { throw confirmedProviderFailure("Invalid input"); } };
  } });
  const service = await f.open();
  await service.create("one", spec);
  await service.step("one");
  assert.equal(service.get("one").state, "recovering");
  assert.match(service.get("one").message, /original provider key/);
  credentialReady = true;
  await service.step("one");
  assert.equal(service.get("one").state, "failed");
  assert.equal(service.get("one").message, "Invalid input");
});

test("public progress excludes private inputs; lookup is scoped to workflow", async (t) => {
  const f = await fixture(t);
  const service = await f.open();
  await service.create("one", spec);
  assert.equal(service.list(remoteVideoScope(spec.body)).length, 1);
  assert.equal(service.list(remoteVideoScope({ projectId: "other" })).length, 0);
  assert.doesNotMatch(JSON.stringify(service.progress()), /private prompt|fingerprint/);
  assert.doesNotMatch(JSON.stringify(service.get("one")), /private prompt|fingerprint/);
});

test("corrupt store fails closed instead of losing IDs and permitting resubmission", async (t) => {
  const f = await fixture(t);
  await writeFile(f.filePath, "broken json");
  await assert.rejects(f.open());
  assert.equal(await readFile(f.filePath, "utf8"), "broken json");
});

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import express from "express";
import { createRemoteVideoJobs } from "../server/remote-video-jobs.js";
import { durableVideoRequestHandler, registerRemoteVideoJobRoutes } from "../server/routes/remote-video-jobs.js";

test("HTTP acceptance is idempotent, returns early, and exposes later results without submitting again", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "newt-job-routes-"));
  let preparations = 0, submissions = 0;
  const jobs = await createRemoteVideoJobs({
    filePath: path.join(dir, "jobs.json"), autoStart: false,
    adapter: async () => ({ submit: async () => { submissions++; return { requestId: "paid-once" }; }, poll: async () => ({ remote: { video: { url: "https://example.test/result" } } }) }),
    finalize: async () => ({ video: { localUrl: "/outputs/result.mp4" } })
  });
  const app = express();
  app.use(express.json());
  registerRemoteVideoJobRoutes(app, jobs);
  app.post("/api/node/generate-video", durableVideoRequestHandler(async (req, res) => {
    preparations++;
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (!req.durableRequestHash) return res.json({ legacy: true });
    res.status(202).json({ job: await jobs.create(req.body.generationRunId, { body: req.body, provider: "krea" }, req.durableRequestHash) });
  }, jobs));
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await jobs.close();
    await rm(dir, { recursive: true, force: true });
  });
  const root = `http://127.0.0.1:${server.address().port}`;
  const body = { model: "Seedance 2.5", generationRunId: "one", nodeId: "video", durableGeneration: true };
  const submit = (payload) => fetch(`${root}/api/node/generate-video`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const [first, second] = await Promise.all([submit(body), submit(body)]);
  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.equal(preparations, 1);
  assert.equal(submissions, 0);
  await jobs.step("one");
  assert.equal(submissions, 1);
  assert.equal((await submit(body)).status, 202);
  assert.equal(preparations, 1);
  assert.equal((await submit({ ...body, prompt: "different" })).status, 409);
  const completed = await (await fetch(`${root}/api/remote-video-jobs/one`)).json();
  assert.equal(completed.job.result.video.localUrl, "/outputs/result.mp4");
  assert.equal((await fetch(`${root}/api/remote-video-jobs/missing`)).status, 404);
  assert.equal((await (await submit({ model: "MiniMax H3" })).json()).legacy, true);
});

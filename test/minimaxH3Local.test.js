import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMinimaxH3LocalRequest,
  minimaxH3LocalFileUri,
  normalizeMinimaxH3LocalUrl,
  readMinimaxH3LocalStatus,
  runMinimaxH3LocalJob
} from "../server/minimaxH3Local/engine.js";

test("local URL only accepts loopback HTTP services", () => {
  assert.equal(normalizeMinimaxH3LocalUrl("http://localhost:30010/"), "http://localhost:30010");
  assert.throws(() => normalizeMinimaxH3LocalUrl("https://example.com"), /loopback/i);
  assert.throws(() => normalizeMinimaxH3LocalUrl("file:///tmp/server"), /loopback/i);
});

test("local file URIs support native and shared-root mappings", () => {
  assert.match(minimaxH3LocalFileUri("C:\\media\\shot one.png", {
    hostMediaRoot: "",
    engineMediaRoot: ""
  }), /^file:\/\/\/C:.*shot%20one\.png$/i);
  assert.equal(minimaxH3LocalFileUri("C:\\Newt\\outputs\\shot one.png", {
    hostMediaRoot: "C:\\Newt\\outputs",
    engineMediaRoot: "/mnt/newt/outputs"
  }), "file:///mnt/newt/outputs/shot%20one.png");
  assert.throws(() => minimaxH3LocalFileUri("D:\\elsewhere\\shot.png", {
    hostMediaRoot: "C:\\Newt\\outputs",
    engineMediaRoot: "/mnt/newt/outputs"
  }), /outside/i);
});

test("local requests map Newt routes to SGLang H3 tasks", () => {
  const text = buildMinimaxH3LocalRequest({
    route: "text-to-video",
    prompt: "A storm",
    duration: 5,
    resolution: "768P",
    aspectRatio: "16:9"
  });
  assert.equal(text.task, "t2va");
  assert.equal(text.target.short_edge, 768);
  assert.deepEqual(text.conditions, []);

  const frames = buildMinimaxH3LocalRequest({
    route: "image-to-video",
    prompt: "She turns",
    duration: 10,
    resolution: "768P",
    firstFrameUri: "file:///start.png",
    lastFrameUri: "file:///end.png"
  });
  assert.equal(frames.task, "fl2va");
  assert.deepEqual(frames.conditions.map(({ frame_index }) => frame_index), [0, -1]);

  const references = buildMinimaxH3LocalRequest({
    route: "reference-to-video",
    prompt: "<Picture 1> speaks",
    duration: 8,
    resolution: "768P",
    aspectRatio: "9:16",
    referenceImageUris: ["file:///person.png"],
    referenceAudioUris: ["file:///voice.wav"]
  });
  assert.equal(references.task, "ref2va");
  assert.deepEqual(references.conditions.map(({ type }) => type), ["image", "audio"]);
  assert.throws(() => buildMinimaxH3LocalRequest({
    route: "text-to-video",
    prompt: "A storm",
    duration: 5,
    resolution: "1080P"
  }), /768P/);
});

test("local status reports SGLang health without throwing", async () => {
  const healthy = await readMinimaxH3LocalStatus({
    env: { MINIMAX_H3_LOCAL_URL: "http://127.0.0.1:30010" },
    fetchImpl: async () => new Response("ok")
  });
  assert.equal(healthy.available, true);

  const unavailable = await readMinimaxH3LocalStatus({
    env: { MINIMAX_H3_LOCAL_URL: "http://127.0.0.1:30010" },
    fetchImpl: async () => { throw new Error("refused"); }
  });
  assert.equal(unavailable.available, false);
  assert.match(unavailable.message, /refused/);
});

test("local jobs submit, poll, and expose the content endpoint", async () => {
  const calls = [];
  const responses = [
    new Response(JSON.stringify({ id: "job-7", status: "queued" }), { headers: { "Content-Type": "application/json" } }),
    new Response(JSON.stringify({ id: "job-7", status: "completed", progress: 1 }), { headers: { "Content-Type": "application/json" } })
  ];
  const progress = [];
  const result = await runMinimaxH3LocalJob({
    input: { task: "fl2va", prompt: "Move" },
    env: {
      MINIMAX_H3_LOCAL_URL: "http://127.0.0.1:30010",
      MINIMAX_H3_LOCAL_POLL_INTERVAL_MS: "1"
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options?.method || "GET" });
      return responses.shift();
    },
    onProgress: (entry) => progress.push(entry)
  });
  assert.deepEqual(calls, [
    { url: "http://127.0.0.1:30010/v1/videos", method: "POST" },
    { url: "http://127.0.0.1:30010/v1/videos/job-7", method: "GET" }
  ]);
  assert.equal(result.contentUrl, "http://127.0.0.1:30010/v1/videos/job-7/content");
  assert.equal(progress.at(-1).percent, 100);
});

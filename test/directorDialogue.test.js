import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDirectorDialoguePreparation } from "../server/director-dialogue.js";

const body = () => ({ model: "Seedance 2.5", duration: "10 seconds", generateAudio: true, projectId: "test-project", nodeId: "video", prompt: "Two people talk", filmDirector: { audioMode: "production", finalPrompt: "Two people talk", dialogue: { directorNodeId: "director", revision: 0,
  characters: [{ nodeId: "a", tag: "Alex", imageUrl: "/outputs/a.png", voice: { id: "voiceA", name: "Alex voice" } }, { nodeId: "b", tag: "Bea", imageUrl: "/outputs/b.png", voice: { id: "voiceB", name: "Bea voice" } }],
  lines: [{ id: "one", characterNodeId: "a", text: "Hello, Bea.", pauseAfter: 0.2 }, { id: "two", characterNodeId: "b", text: "Hello, Alex.", pauseAfter: 0 }]
} } });
async function harness(t, overrides = {}) {
  const cacheDir = await mkdtemp(path.join(os.tmpdir(), "newt-dialogue-test-"));
  t.after(() => {
    if (path.dirname(path.resolve(cacheDir)) !== path.resolve(os.tmpdir()) || !path.basename(cacheDir).startsWith("newt-dialogue-test-")) throw new Error("Unexpected test cleanup target");
    return rm(cacheDir, { recursive: true, force: true });
  });
  const calls = [], history = [], assemblies = [];
  let number = 0;
  const deps = { cacheDir, getKey: () => "test-only-key", readAudio: async url => ({ mimeType: /\/(?:a|b)\.png$/.test(url) ? "image/png" : "audio/mpeg" }),
    client: { listVoices: async () => [{ id: "voiceA" }, { id: "voiceB" }], generate: async args => { calls.push(args.data); return { buffer: Buffer.from("mock audio"), endpoint: "mock", requestId: "request-" + calls.length }; } },
    saveAudio: async () => ({ url: `/outputs/line-${++number}.mp3`, fileName: `line-${number}.mp3`, durationSeconds: 1 }),
    assembleAudio: async (_req, clips, durationSeconds) => { assemblies.push(clips); return { url: `/outputs/track-${assemblies.length}.mp3`, fileName: "track.mp3", durationSeconds }; },
    recordHistory: async record => history.push(record), ...overrides };
  return { deps, calls, history, assemblies, prepare: createDirectorDialoguePreparation(deps) };
}

test("each assigned voice receives only its exact line; cue audio is passed to video and reused durably", async t => {
  const h = await harness(t);
  const req = { body: body() };
  const prepared = await h.prepare(req);
  assert.deepEqual(h.calls.map(call => [call.voiceId, call.prompt]), [["voiceA", "Hello, Bea."], ["voiceB", "Hello, Alex."]]);
  assert.deepEqual(prepared.cues.map(cue => [cue.tag, cue.startSeconds, cue.endSeconds]), [["Alex", 0, 1], ["Bea", 1.2, 2.2]]);
  assert.deepEqual(req.body.referenceAudioUrls, [prepared.url]);
  assert.deepEqual(req.body.referenceAudioLabels, ["DirectorDialogue"]);
  assert.match(req.body.prompt, /@Alex speaks "Hello, Bea\."/);
  assert.equal(h.history.length, 2);
  assert.ok(h.history.every(record => record.provider === "ElevenLabs" && record.cost.amountUsd > 0));
  const restarted = createDirectorDialoguePreparation(h.deps);
  await restarted({ body: body() });
  assert.equal(h.calls.length, 2); assert.equal(h.assemblies.length, 1); assert.equal(h.history.length, 2);
});

test("changing one line regenerates only its speech and changing a voice invalidates that speaker", async t => {
  const h = await harness(t); await h.prepare({ body: body() });
  const changed = body(); changed.filmDirector.dialogue.lines[1].text = "A new response.";
  await h.prepare({ body: changed }); assert.equal(h.calls.length, 3);
  const voice = body(); voice.filmDirector.dialogue.characters[0].voice = { id: "voiceB", name: "Another voice" };
  await h.prepare({ body: voice }); assert.equal(h.calls.length, 4);
});

test("model, silent-mode, missing-speaker and unavailable-voice errors happen before TTS", async t => {
  const h = await harness(t);
  for (const change of [value => value.model = "Kling O3 Pro", value => value.generateAudio = false, value => value.startFrameUrls = ["/outputs/start.png"], value => value.referenceAudioUrls = Array(10).fill("/outputs/sample.mp3"), value => value.filmDirector.dialogue.characters[0].voice.id = "missing", value => value.filmDirector.dialogue.lines[0].characterNodeId = "missing"]) {
    const value = body(); change(value); await assert.rejects(h.prepare({ body: value }));
  }
  assert.equal(h.calls.length, 0);
});

test("interrupted speech is recorded once and never replayed until explicit regeneration", async t => {
  let calls = 0;
  const client = { listVoices: async () => [{ id: "voiceA" }, { id: "voiceB" }], generate: async () => { calls++; throw new Error("Timed out; outcome unknown"); } };
  const h = await harness(t, { client });
  await assert.rejects(h.prepare({ body: body() }), /Timed out/);
  await assert.rejects(createDirectorDialoguePreparation(h.deps)({ body: body() }), /previous dialogue speech request was interrupted/);
  assert.equal(calls, 1); assert.equal(h.history.length, 1); assert.equal(h.history[0].cost.amountUsd, null);
  const retry = body(); retry.filmDirector.dialogue.revision = 1;
  await assert.rejects(h.prepare({ body: retry }), /Timed out/); assert.equal(calls, 2);
});

test("overlong dialogue preserves generated clips and does not submit a video", async t => {
  const h = await harness(t, { saveAudio: async () => ({ url: "/outputs/long.mp3", durationSeconds: 12 }) });
  await assert.rejects(h.prepare({ body: body() }), /Prepared dialogue is/);
  assert.equal(h.calls.length, 2); assert.equal(h.assemblies.length, 0);
});

test("MiniMax H3 receives the same exact assigned speech and timed references", async t => {
  const h = await harness(t);
  const value = body(); value.model = "MiniMax H3";
  const prepared = await h.prepare({ body: value });
  assert.deepEqual(h.calls.map(call => call.voiceId), ["voiceA", "voiceB"]);
  assert.deepEqual(value.referenceAudioUrls, [prepared.url]);
  assert.match(value.prompt, /@DirectorDialogue/);
});

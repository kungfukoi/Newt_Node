import test from "node:test";
import assert from "node:assert/strict";
import { buildVideoGenerationRequest } from "../src/nodeRunners/videoModels.js";
test("connected exact speech carries its audio identity without legacy line synthesis", () => {
  const request = buildVideoGenerationRequest({ node: { id: "video", data: { model: "Seedance 2.0", generateAudio: true } }, prompt: "Finn speaks", exactDialogueAudio: true, exactDialogueAudioUrl: "/outputs/speech.wav" });
  assert.equal(request.exactDialogueAudio, true);
  assert.equal(request.exactDialogueAudioUrl, "/outputs/speech.wav");
  assert.equal(request.characterDialogue, undefined);
});
test("missing connected exact speech remains an explicit request for actionable server validation", () => {
  const request = buildVideoGenerationRequest({ node: { id: "video", data: { model: "Seedance 2.0" } }, exactDialogueAudio: true });
  assert.equal(request.exactDialogueAudio, true);
  assert.equal(request.exactDialogueAudioUrl, "");
});

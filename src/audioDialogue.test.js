import test from "node:test";
import assert from "node:assert/strict";
import { validateDirectorDialogue, directorDialoguePackage } from "./characterDialogue.js";
import { audioInputEnabled, normalizeAudioModelData } from "./audioModel.js";
const line = { id: "line", characterNodeId: "", speakerName: "Alice", voiceId: "voiceA", text: "Hello", pauseAfter: 0.3 };
test("audio dialogue accepts manual speakers without images and validates required voice", () => {
  const dialogue = { lines: [line], characters: [] };
  assert.equal(validateDirectorDialogue(dialogue, { audioOnly: true })[0].voiceId, "voiceA");
  assert.throws(() => validateDirectorDialogue({ ...dialogue, lines: [{ ...line, voiceId: "" }] }, { audioOnly: true }), /voice/);
  assert.throws(() => validateDirectorDialogue(dialogue), /Character sheet/);
});
test("audio dialogue resolves connected Character name and voice without locked images", () => {
  const dialogue = directorDialoguePackage({ directorDialogue: [{ ...line, characterNodeId: "character" }] }, [{ source: { id: "character", data: { characterName: "Bob", characterVoiceProvider: "elevenlabs", characterElevenLabsVoiceId: "voiceB" } } }]);
  const resolved = validateDirectorDialogue(dialogue, { audioOnly: true })[0];
  assert.equal(resolved.tag, "Bob"); assert.equal(resolved.voiceId, "voiceB");
  assert.throws(() => validateDirectorDialogue(dialogue), /Character sheet/);
});
test("dialogue mode survives reload and only enables Character input", () => {
  assert.equal(normalizeAudioModelData({ audioMode: "dialogue" }).audioMode, "dialogue");
  assert.equal(audioInputEnabled("dialogue", "characterIn"), true);
  assert.equal(audioInputEnabled("dialogue", "audioIn"), false);
  assert.equal(audioInputEnabled("dialogue", "promptIn"), false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { characterElevenLabsVoice, directorDialoguePackage, validateDirectorDialogue, remapDirectorDialogueData, directorDialogueBrief, videoCharacterDialogue, videoCharacterVoiceMode } from "../src/characterDialogue.js";
import { remapImportedGraph } from "../src/workflowState.js";
import { addFilmDirectorScene, switchFilmDirectorScene } from "../src/filmDirectorScenes.js";
import { nodeApi } from "../src/api/newtApi.js";

const actor = (id, name, voice) => ({ id, type: "character", x: 0, y: 0, data: { title: name, locked: true, activated: true, resultUrl: `/outputs/${id}.png`, characterVoiceProvider: "elevenlabs", characterElevenLabsVoiceId: voice, characterElevenLabsVoiceName: name + " voice" } });
const lines = [{ id: "line-a", characterNodeId: "a", text: "Hello, Bea.", pauseAfter: 0.2 }, { id: "line-b", characterNodeId: "b", text: "Hello, Alex.", pauseAfter: 0 }];

test("direct and Director dialogue combine without exchanging duplicate speakers", () => {
  const director = directorDialoguePackage({ directorDialogue: [lines[0]] }, [actor("a", "Alex", "voiceA")].map(source => ({ source })), "director");
  const direct = directorDialoguePackage({ directorDialogue: [lines[1]] }, [actor("a", "Alex", "voiceA"), actor("b", "Bea", "voiceB")].map(source => ({ source })), "video");
  const merged = videoCharacterDialogue(direct, director);
  assert.deepEqual(validateDirectorDialogue(merged).map(line => line.voiceId), ["voiceA", "voiceB"]);
  assert.equal(merged.characters.length, 2);
  assert.equal(videoCharacterDialogue({ lines: [] }, director), director);
});

test("dialogue binds exact lines and voice IDs to stable Character IDs, including after rename", () => {
  const a = actor("a", "Alex", "voiceA"), b = actor("b", "Bea", "voiceB");
  const pkg = directorDialoguePackage({ directorDialogue: lines }, [{ source: b }, { source: a }], "director");
  assert.deepEqual(validateDirectorDialogue(pkg).map(line => [line.characterNodeId, line.voiceId, line.text]), [["a", "voiceA", "Hello, Bea."], ["b", "voiceB", "Hello, Alex."]]);
  a.data.title = "Renamed";
  assert.equal(validateDirectorDialogue(directorDialoguePackage({ directorDialogue: lines }, [{ source: a }, { source: b }]))[0].tag, "Renamed");
  assert.match(directorDialogueBrief(pkg), /@Alex: "Hello, Bea\."/);
  assert.equal(characterElevenLabsVoice({ ...a.data, characterVoiceProvider: "uploaded" }), null);
});

test("invalid speakers, voices, empty lines and duplicate line IDs are rejected", () => {
  const pkg = directorDialoguePackage({ directorDialogue: lines }, [actor("a", "Alex", "voiceA"), actor("b", "Bea", "voiceB")].map(source => ({ source })));
  for (const change of [value => value.lines[0].characterNodeId = "missing", value => value.characters[0].voice = null, value => value.lines[0].text = "", value => value.lines[1].id = value.lines[0].id, value => value.characters[1].tag = "Alex"]) {
    const copy = structuredClone(pkg); change(copy); assert.throws(() => validateDirectorDialogue(copy));
  }
});

test("copy/import remaps active and saved-scene dialogue speakers without rewriting voice IDs", () => {
  const director = { id: "d", type: "skillDirector", x: 0, y: 0, data: { directorDialogue: lines, skillDirectorScenes: [{ id: "scene-1", state: { directorDialogue: lines } }] } };
  const graph = remapImportedGraph({ nodes: [actor("a", "Alex", "voiceA"), actor("b", "Bea", "voiceB"), director], edges: [] });
  const next = graph.nodes[2].data;
  assert.equal(next.directorDialogue[0].characterNodeId, graph.nodes[0].id);
  assert.equal(next.skillDirectorScenes[0].state.directorDialogue[1].characterNodeId, graph.nodes[1].id);
  assert.equal(graph.nodes[0].data.characterElevenLabsVoiceId, "voiceA");
  assert.equal(remapDirectorDialogueData(director.data, new Map([["a", "new-a"]])).directorDialogue[0].characterNodeId, "new-a");
});

test("Director scene switches retain each scene's exact dialogue", () => {
  const data = { sceneName: "First", directorDialogue: lines, directorDialogueAudioVersion: 42 };
  const added = { ...data, ...addFilmDirectorScene(data) };
  assert.deepEqual(added.directorDialogue, []);
  const first = added.skillDirectorScenes[0].id;
  const restored = switchFilmDirectorScene(added, first);
  assert.deepEqual(restored.directorDialogue, lines);
  assert.equal(restored.directorDialogueAudioVersion, 42);
});

test("voice-bound video requests are not automatically replayed after transport interruption", async t => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => { calls++; throw new Error("Connection closed"); });
  await assert.rejects(nodeApi.generateVideo({ filmDirector: { dialogue: { lines } } }), /no request was resubmitted/);
  assert.equal(calls, 1);
});

test("Whiskerwood empty legacy dialogue row does not activate exact speech", () => {
  const data = { directorDialogue: [{ id: "placeholder", characterNodeId: "", text: "", pauseAfter: 0.3 }] };
  assert.equal(videoCharacterVoiceMode(data), "off");
  assert.equal(videoCharacterVoiceMode({ ...data, characterVoiceMode: "samples" }), "samples");
  assert.equal(videoCharacterVoiceMode({ directorDialogue: [{ id: "line", characterNodeId: "a", text: "Hello" }] }), "dialogue");
  assert.equal(videoCharacterVoiceMode({ ...data, characterVoiceMode: "dialogue" }), "dialogue");
});

import { characterOutputReference } from "./characterSheetLibrary.js";

export function characterElevenLabsVoice(data = {}) {
  return data.characterVoiceProvider === "elevenlabs" && /^[A-Za-z0-9_-]{1,128}$/.test(data.characterElevenLabsVoiceId || "")
    ? { id: data.characterElevenLabsVoiceId, name: String(data.characterElevenLabsVoiceName || data.characterElevenLabsVoiceId) }
    : null;
}

export function directorDialoguePackage(data = {}, connections = [], directorNodeId = "") {
  return {
    directorNodeId, revision: Number(data.directorDialogueAudioVersion) || 0,
    mode: data.characterVoiceMode === "samples" ? "samples" : "dialogue",
    lines: Array.isArray(data.directorDialogue) ? data.directorDialogue : [],
    characters: connections.map(({ source }) => ({
      nodeId: source.id, tag: String(source.data.characterName || source.data.title || "Character").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 28),
      imageUrl: source.data.locked && source.data.activated ? characterOutputReference(source.data)?.url || "" : "",
      voice: characterElevenLabsVoice(source.data),
      sample: source.data.characterElevenLabsVoiceSample || null
    }))
  };
}

export function validateDirectorDialogue(value = {}) {
  const lines = value.lines;
  if (!Array.isArray(lines) || !lines.length || lines.length > 24) throw new Error("Director dialogue needs between 1 and 24 lines.");
  const characters = Array.isArray(value.characters) ? value.characters : [];
  if (characters.length > 16 || new Set(characters.map(character => character.nodeId)).size !== characters.length) throw new Error("Director dialogue needs uniquely bound characters.");
  const ids = new Set();
  const resolved = lines.map(line => {
    if (!line || !line.id || ids.has(line.id)) throw new Error("Every dialogue line needs a unique ID.");
    ids.add(line.id);
    const character = characters.find(item => item.nodeId === line.characterNodeId);
    if (!character || !character.imageUrl) throw new Error("Reconnect and lock the speaker's Character sheet before generating dialogue.");
    if (!/^[A-Za-z0-9_-]{1,28}$/.test(character.tag)) throw new Error("Give each dialogue character a valid name tag.");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(character.voice?.id || "")) throw new Error(`Choose an ElevenLabs voice for @${character.tag} in Character Build.`);
    const text = String(line.text || "").trim();
    if (!text || text.length > 1000) throw new Error("Each dialogue line needs 1–1,000 characters of exact speech.");
    const pauseAfter = line.pauseAfter == null ? 0.3 : Number(line.pauseAfter);
    if (!Number.isFinite(pauseAfter) || pauseAfter < 0 || pauseAfter > 3) throw new Error("Dialogue pauses must be between 0 and 3 seconds.");
    return { id: String(line.id), characterNodeId: character.nodeId, tag: character.tag, voiceId: character.voice.id, voiceName: character.voice.name, text, pauseAfter };
  });
  if (resolved.reduce((sum, line) => sum + line.text.length, 0) > 10000) throw new Error("Director dialogue accepts up to 10,000 characters per scene.");
  const speakers = new Set(resolved.map(line => line.characterNodeId));
  const tags = characters.filter(character => speakers.has(character.nodeId)).map(character => character.tag.toLowerCase());
  if (new Set(tags).size !== tags.length) throw new Error("Dialogue speakers need distinct character name tags.");
  return resolved;
}

export function directorDialogueBrief(value = {}) {
  if (!value.lines?.length) return "";
  return "AUTHORITATIVE DIALOGUE: Preserve every exact spoken line and its assigned speaker, in this order. Plan readable speaking coverage and lip-sync; do not invent, paraphrase, reassign or add dialogue.\n" + value.lines.map(line => {
    const character = value.characters?.find(item => item.nodeId === line.characterNodeId);
    return `${character ? "@" + character.tag : "Unbound character"}: ${JSON.stringify(String(line.text || ""))}`;
  }).join("\n");
}

export function directorDialogueModelSupported(model = "") {
  return /seedance.*2(?:[ .-]|$)|minimax.*h3/i.test(model);
}

export function videoCharacterDialogue(direct = {}, director = null) {
  if (direct.mode === "samples") return { ...direct, characters: [...new Map([...(director?.characters || []), ...(direct.characters || [])].map(character => [character.nodeId, character])).values()] };
  if (!direct.lines?.length) return director || direct;
  if (!director?.lines?.length) return direct;
  const characters = new Map((director.characters || []).map(character => [character.nodeId, character]));
  for (const character of direct.characters || []) characters.set(character.nodeId, character);
  return { ...direct, revision: `${director.revision || 0}:${direct.revision || 0}`, lines: [...director.lines, ...direct.lines], characters: [...characters.values()] };
}

export function remapDirectorDialogueData(data, idMap) {
  const remap = rows => Array.isArray(rows) ? rows.map(line => ({ ...line, characterNodeId: idMap.get(line.characterNodeId) || line.characterNodeId })) : rows;
  return { ...data,
    ...(Array.isArray(data.directorDialogue) ? { directorDialogue: remap(data.directorDialogue) } : {}),
    ...(Array.isArray(data.skillDirectorScenes) ? { skillDirectorScenes: data.skillDirectorScenes.map(scene => ({ ...scene, ...(scene.state ? { state: remapDirectorDialogueData(scene.state, idMap) } : {}), ...(Array.isArray(scene.directorDialogue) ? { directorDialogue: remap(scene.directorDialogue) } : {}) })) } : {})
  };
}

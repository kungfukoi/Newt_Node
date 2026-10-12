import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { validateDirectorDialogue, directorDialogueModelSupported } from "../src/characterDialogue.js";
import { audioModelDefaults, estimateAudioCost } from "../src/audioModel.js";
import { createElevenLabsClient } from "./elevenlabs.js";

const hash = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function createDirectorDialoguePreparation({ cacheDir, getKey, saveAudio, assembleAudio, readAudio, recordHistory, progress = () => {}, client = createElevenLabsClient() }) {
  const active = new Map();
  let speechActive = 0;
  const waiters = [];
  const synthesize = async args => {
    if (speechActive >= 2) await new Promise(resolve => waiters.push(resolve));
    else speechActive++;
    try { return await client.generate(args); }
    finally { const next = waiters.shift(); if (next) next(); else speechActive--; }
  };
  const cached = async (key, generate) => {
    if (active.has(key)) return active.get(key);
    const work = (async () => {
      const file = path.join(cacheDir, key + ".json");
      let prior;
      try { prior = JSON.parse(await readFile(file, "utf8")); }
      catch (error) { if (error.code !== "ENOENT") throw new Error("Dialogue cache could not be read. Existing speech was preserved."); }
      if (prior) {
        if (prior.state !== "complete") throw new Error("A previous dialogue speech request was interrupted. Check ElevenLabs and History; use Regenerate dialogue audio on next run only when you intend another paid request.");
        try { await readAudio(prior.value.url); }
        catch { throw new Error("Saved dialogue audio is missing. Restore the workflow assets or explicitly regenerate dialogue audio."); }
        return prior.value;
      }
      await mkdir(cacheDir, { recursive: true });
      const store = async value => {
        const temp = file + "." + randomUUID() + ".tmp";
        await writeFile(temp, JSON.stringify(value));
        await rename(temp, file);
      };
      await store({ state: "started" }); // Persist acceptance uncertainty before the paid request.
      const value = await generate();
      await store({ state: "complete", value });
      return value;
    })();
    active.set(key, work);
    try { return await work; } finally { active.delete(key); }
  };

  return async function prepare(req) {
    const body = req.body;
    const dialogue = body.characterDialogue || body.filmDirector?.dialogue;
    if (!dialogue?.lines?.length) return null;
    if (!directorDialogueModelSupported(body.model)) throw new Error("The selected video model cannot use Character dialogue audio. Choose Seedance 2.0, Seedance 2.5 or MiniMax H3.");
    if (body.generateAudio === false || body.filmDirector?.audioMode === "silent") throw new Error("Enable Generate Audio and a speaking Director audio mode to use assigned character voices.");
    if (body.startFrameUrls?.length || body.endFrameUrls?.length) throw new Error("Character dialogue requires reference-to-video. Move start/end frames to Reference Images so the speech is not ignored.");
    const audioLimit = /seedance.*2[ .-]?5/i.test(body.model) ? 10 : 3;
    if ((body.referenceAudioUrls || []).length >= audioLimit) throw new Error("There are too many audio references for Character dialogue. Remove unused audio inputs before generating speech.");
    const lines = validateDirectorDialogue(dialogue);
    for (const character of dialogue.characters.filter(character => lines.some(line => line.characterNodeId === character.nodeId))) {
      if (!/^\/(?:outputs|uploads|workflow-assets|saved_workflows)\//.test(character.imageUrl || "") || character.imageUrl.includes("..")) throw new Error("Dialogue speakers require managed Character reference images.");
      const asset = await readAudio(character.imageUrl);
      if (!asset.mimeType?.startsWith("image/")) throw new Error("The dialogue speaker's Character reference is not a readable image.");
    }
    const key = getKey();
    if (!key) throw new Error("Add and enable an ElevenLabs API key in Settings before generating Character dialogue.");
    const voices = await client.listVoices(key);
    const modelId = "eleven_multilingual_v2";
    for (const line of lines) {
      const voice = voices.find(voice => voice.id === line.voiceId);
      if (!voice) throw new Error(`The assigned ElevenLabs voice for @${line.tag} is unavailable on the enabled key. Refresh and select its voice again.`);
      if (voice.fineTuning?.[modelId] && voice.fineTuning[modelId] !== "fine_tuned") throw new Error(`The voice for @${line.tag} is not ready for speech generation.`);
    }
    const scope = [body.projectId, body.workflowPackageId, dialogue.directorNodeId, dialogue.revision, hash(key)];
    const clips = [];
    for (const line of lines) {
      const lineKey = hash([scope, line.characterNodeId, line.voiceId, modelId, line.text]);
      const clip = await cached(lineKey, async () => {
        progress(`Generating dialogue for @${line.tag}`);
        const data = { ...audioModelDefaults, voiceId: line.voiceId, prompt: line.text, ttsModel: modelId };
        let generated;
        try { generated = await synthesize({ data, key }); }
        catch (error) {
          await recordHistory({ id: randomUUID(), createdAt: new Date().toISOString(), mediaType: "audio", provider: "ElevenLabs", modelName: modelId,
            mode: "Director dialogue (failed or interrupted)", prompt: line.text, error: error.message,
            cost: { amountUsd: null, currency: "USD", source: "Provider outcome unknown; request was not retried" },
            settings: { voiceId: line.voiceId, voiceName: line.voiceName, directorNodeId: dialogue.directorNodeId, dialogueLineId: line.id },
            node: { id: line.characterNodeId, title: line.tag }, project: { id: body.projectId, name: body.projectName } }).catch(() => {});
          throw error;
        }
        let output;
        try { output = await saveAudio(req, generated.buffer); }
        catch (error) {
          await recordHistory({ id: randomUUID(), createdAt: new Date().toISOString(), mediaType: "audio", provider: "ElevenLabs", modelName: modelId, endpoint: generated.endpoint, requestId: generated.requestId,
            prompt: line.text, error: "Speech completed but could not be saved: " + error.message,
            cost: estimateAudioCost(data, { customVoiceRate: voices.find(voice => voice.id === line.voiceId)?.customRate }),
            node: { id: line.characterNodeId, title: line.tag }, project: { id: body.projectId, name: body.projectName } });
          throw new Error("ElevenLabs completed the dialogue but saving failed. Check History before explicitly regenerating it.");
        }
        const cost = estimateAudioCost(data, { customVoiceRate: voices.find(voice => voice.id === line.voiceId)?.customRate });
        let historyWarning = "";
        try {
          await recordHistory({ id: randomUUID(), createdAt: new Date().toISOString(), mediaType: "audio", provider: "ElevenLabs", modelName: modelId, endpoint: generated.endpoint, requestId: generated.requestId,
            mode: "Director character dialogue", prompt: line.text, localAudio: output.url, outputFileName: output.fileName, cost,
            settings: { voiceId: line.voiceId, voiceName: line.voiceName, characterNodeId: line.characterNodeId, directorNodeId: dialogue.directorNodeId, dialogueLineId: line.id, durationSeconds: output.durationSeconds, billedCharacters: generated.billedCharacters },
            node: { id: line.characterNodeId, title: line.tag }, project: { id: body.projectId, name: body.projectName } });
        } catch { historyWarning = "Speech saved, but its History record could not be written."; }
        return { ...output, requestId: generated.requestId, cost, historyWarning };
      });
      if (!(clip.durationSeconds > 0)) throw new Error("The saved dialogue audio duration could not be measured. Check History before regenerating.");
      clips.push({ ...clip, ...line });
    }
    const cues = [];
    let duration = 0;
    for (const clip of clips) {
      cues.push({ characterNodeId: clip.characterNodeId, tag: clip.tag, voiceId: clip.voiceId, voiceName: clip.voiceName, text: clip.text, startSeconds: duration, endSeconds: duration + clip.durationSeconds });
      duration += clip.durationSeconds + clip.pauseAfter;
    }
    const maxSeconds = /seedance.*2[ .-]?5/i.test(body.model) ? 30.2 : 15;
    const requestedSeconds = Number(String(body.duration || "").match(/\d+(?:\.\d+)?/)?.[0]);
    if (duration > maxSeconds || (requestedSeconds > 0 && duration > requestedSeconds)) throw new Error(`Prepared dialogue is ${duration.toFixed(1)} seconds long. Increase the video duration or shorten the dialogue; saved speech will be reused.`);
    progress("Assembling character dialogue audio");
    const track = await cached(hash([scope, "track", clips.map(clip => [clip.url, clip.pauseAfter])]), () => assembleAudio(req, clips, Math.max(2, duration)));
    const audioUrls = [...(body.referenceAudioUrls || []), track.url];
    const labels = [...(body.referenceAudioLabels || []).slice(0, audioUrls.length - 1), "DirectorDialogue"];
    while (labels.length < audioUrls.length) labels.splice(labels.length - 1, 0, `Audio${labels.length}`);
    body.referenceAudioUrls = audioUrls;
    body.referenceAudioLabels = labels;
    const instructions = ["AUTHORITATIVE CHARACTER DIALOGUE AUDIO: @DirectorDialogue contains the exact voiced lines below. Preserve the words, voice identity, speaker assignments and audio timing; lip-sync only the assigned character during their own speaking interval. Do not swap voices, paraphrase speech, add dialogue or have listeners speak.",
      ...cues.map(cue => `${cue.startSeconds.toFixed(2)}–${cue.endSeconds.toFixed(2)} seconds: @${cue.tag} speaks ${JSON.stringify(cue.text)} in their assigned voice.`)].join("\n");
    body.prompt = [body.prompt, instructions].filter(Boolean).join("\n\n");
    if (body.filmDirector) body.filmDirector.finalPrompt = [body.filmDirector.finalPrompt, instructions].filter(Boolean).join("\n\n");
    return { url: track.url, fileName: track.fileName, durationSeconds: track.durationSeconds, cues, clips: clips.map(({ url, fileName, requestId, historyWarning }) => ({ url, fileName, requestId, historyWarning })) };
  };
}

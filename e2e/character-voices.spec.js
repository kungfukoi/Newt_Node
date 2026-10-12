import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

const actor = (id, name, voice) => ({ id, type: "character", x: 800, y: 0, data: { title: name, characterName: name, locked: true, activated: true, resultUrl: `/outputs/e2e/${id}.png`, characterTab: "build", characterVoiceProvider: "elevenlabs", characterElevenLabsVoiceId: voice, characterElevenLabsVoiceName: name + " custom", characterVoices: [{ id: "uploaded", localUrl: "/outputs/e2e/old.mp3", fileName: "Old sample" }], activeVoiceId: "uploaded" } });
const lines = [{ id: "line-1", characterNodeId: "alex", text: "Hello, Bea.", pauseAfter: 0.3 }, { id: "line-2", characterNodeId: "bea", text: "Hello, Alex.", pauseAfter: 0 }];
const saved = page => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")));
async function setup(page, graph) {
  await page.addInitScript(graph => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(graph)); }, { ...graph, groups: [], viewport: { x: 0, y: 0, scale: 0.6 } });
  const fixture = await openFixture(page, { count: graph.nodes.length, settings: { falKeyConfigured: true, elevenlabsKeyConfigured: true, modelProviderPreferences: { seedance: "fal", imageGeneration: "fal", llm: "fal" } } });
  return fixture;
}

test("Character lists default/custom ElevenLabs voices and preserves selection and uploaded samples", async ({ page }) => {
  const { errors } = await setup(page, { nodes: [{ ...actor("alex", "Alex", "voiceA"), x: 10 }], edges: [] });
  let generations = 0;
  await page.route("**/api/elevenlabs/voices*", route => route.fulfill({ json: { voices: [{ id: "voiceA", name: "Alex custom", group: "Mine" }, { id: "voiceB", name: "Bea custom", group: "Mine" }, { id: "default", name: "Default narrator", group: "Default" }] } }));
  await page.route("**/api/node/generate-audio", route => { generations++; return route.abort(); });
  const card = page.locator('[data-node-card-id="alex"]');
  await card.getByRole("button", { name: "Refresh Character ElevenLabs voices" }).click();
  const selector = card.getByLabel("Character ElevenLabs voice", { exact: true });
  await expect(selector.locator("option")).toHaveCount(4);
  await selector.selectOption("voiceB");
  await expect.poll(async () => (await saved(page)).nodes[0].data.characterElevenLabsVoiceId).toBe("voiceB");
  expect((await saved(page)).nodes[0].data.characterVoices).toHaveLength(1);
  expect(generations).toBe(0);
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(selector).toHaveValue("voiceB");
  expect(errors).toEqual([]);
});

test("Director dialogue controls bind lines to Character IDs and retain them after reload", async ({ page }) => {
  const director = { id: "director", type: "skillDirector", x: 10, y: 0, data: { title: "Director", sceneOverview: "Alex and Bea greet each other.", skillDirectorLocks: { setup: true, style: true, motion: true, scene: false, shotList: false }, skillDirectorCollapsed: { setup: true, style: true, motion: true, scene: false, shotList: false }, directorDialogue: lines } };
  const { errors } = await setup(page, { nodes: [director, actor("alex", "Alex", "voiceA"), { ...actor("bea", "Bea", "voiceB"), y: 700 }], edges: ["alex", "bea"].map(id => ({ id: id + "-director", from: { nodeId: id, port: "characterOut" }, to: { nodeId: "director", port: "characterIn" } })) });
  const card = page.locator('[data-node-card-id="director"]');
  await expect(card.getByLabel("Dialogue line 1 character")).toHaveValue("alex");
  await card.getByLabel("Dialogue line 1 text").fill("Good morning, Bea.");
  await expect.poll(async () => (await saved(page)).nodes.find(node => node.id === "director").data.directorDialogue[0].text).toBe("Good morning, Bea.");
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(card.getByLabel("Dialogue line 1 text")).toHaveValue("Good morning, Bea.");
  await expect(card.getByLabel("Dialogue line 2 character")).toHaveValue("bea");
  expect(errors).toEqual([]);
});

test("direct Character to Video uses assigned voices without a Director", async ({ page }) => {
  const video = { id: "video", type: "videoModel", x: 10, y: 0, data: { title: "Video", model: "Seedance 2.5", prompt: "Alex and Bea greet each other", generateAudio: true, settingsOpen: true, directorDialogue: lines } };
  const { errors } = await setup(page, { nodes: [video, actor("alex", "Alex", "voiceA"), { ...actor("bea", "Bea", "voiceB"), y: 700 }], edges: ["alex", "bea"].map(id => ({ id: id + "-video", from: { nodeId: id, port: "characterOut" }, to: { nodeId: "video", port: "characterIn" } })) });
  const card = page.locator('[data-node-card-id="video"]');
  await expect(card.getByLabel("Dialogue line 1 character")).toHaveValue("alex");
  await card.getByLabel("Dialogue line 1 text").fill("Good morning, Bea.");
  let request;
  await page.route("**/api/node/generate-video", route => { request = route.request().postDataJSON(); return route.fulfill({ json: { video: { localUrl: "/outputs/e2e/motion.mp4" } } }); });
  await card.locator(".run-node-button").click();
  await expect.poll(() => request?.characterDialogue?.lines?.length || 0).toBe(2);
  expect(request.filmDirector).toBeNull();
  expect(request.characterDialogue.characters.map(character => character.voice.id)).toEqual(["voiceA", "voiceB"]);
  expect(request.characterDialogue.lines[0].text).toBe("Good morning, Bea.");
  expect(request.referenceAudioUrls).not.toContain("/outputs/e2e/old.mp3");
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(card.getByLabel("Dialogue line 1 text")).toHaveValue("Good morning, Bea.");
  expect(errors).toEqual([]);
});

test("Character to Director to Seedance passes exact speaker/voice pairs and retains prepared speech assets", async ({ page }) => {
  const director = { id: "director", type: "skillDirector", x: 1800, y: 0, data: { title: "Director", skillDirectorBuilt: true, resultText: "@Alex and @Bea greet each other.", lastRunReferenceTags: ["@Alex", "@Bea"], skillVideoModel: "Seedance 2.5", skillDirectorAudioMode: "production", directorDialogue: lines } };
  const video = { id: "video", type: "videoModel", x: 10, y: 0, data: { title: "Video", model: "Seedance 2.5", prompt: "Alex and Bea talk", generateAudio: true, settingsOpen: true } };
  const { errors } = await setup(page, { nodes: [video, actor("alex", "Alex", "voiceA"), { ...actor("bea", "Bea", "voiceB"), y: 700 }, director], edges: [
    ...["alex", "bea"].map(id => ({ id: id + "-director", from: { nodeId: id, port: "characterOut" }, to: { nodeId: "director", port: "characterIn" } })),
    { id: "director-video", from: { nodeId: "director", port: "directorOut" }, to: { nodeId: "video", port: "directorIn" } }
  ] });
  let request;
  const prepared = { url: "/outputs/e2e/dialogue.mp3", durationSeconds: 2, cues: [], clips: [{ url: "/outputs/e2e/line.mp3" }] };
  await page.route("**/api/node/generate-video", route => { request = route.request().postDataJSON(); return route.fulfill({ json: { video: { localUrl: "/outputs/e2e/motion.mp4", fileName: "motion.mp4", mimeType: "video/mp4" }, directorDialogueAudio: prepared } }); });
  const card = page.locator('[data-node-card-id="video"]');
  await card.locator(".run-node-button").click();
  await expect.poll(() => request?.filmDirector?.dialogue?.lines?.length || 0).toBe(2);
  expect(request.filmDirector.dialogue.lines.map(line => [line.characterNodeId, line.text])).toEqual([["alex", "Hello, Bea."], ["bea", "Hello, Alex."]]);
  expect(request.filmDirector.dialogue.characters.map(character => character.voice.id)).toEqual(["voiceA", "voiceB"]);
  expect(request.referenceImageUrls).toContain("/outputs/e2e/alex.png");
  expect(request.referenceImageUrls).toContain("/outputs/e2e/bea.png");
  expect(request.referenceAudioUrls).not.toContain("/outputs/e2e/old.mp3");
  await expect.poll(async () => (await saved(page)).nodes.find(node => node.id === "video").data.resultItems?.[0]?.directorDialogueAudio?.url).toBe(prepared.url);
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture, wireAttachmentErrors } from "./helpers.mjs";

const card = (page, id) => page.locator('[data-node-card-id="' + id + '"]');
test("Audio Model modes, partial batches, Preview and reload preserve audio", async ({ page }) => {
  const nodes = [
    { id: "sound", type: "audioModel", x: 20, y: 20, data: { title: "Audio Model", audioMode: "sfx", prompt: "Gentle rain", settingsOpen: true } },
    { id: "preview", type: "preview", x: 520, y: 20, data: { title: "Audio preview" } }
  ];
  const edges = [{ id: "sound-preview", from: { nodeId: "sound", port: "audioOut" }, to: { nodeId: "preview", port: "sourceIn" } }];
  await page.addInitScript(({ nodes, edges }) => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes, edges, groups: [], viewport: { x: 20, y: 20, scale: 0.85 } })); }, { nodes, edges });
  const { errors } = await openFixture(page, { count: 2 });
  await page.route("**/api/elevenlabs/voices*", route => route.fulfill({ json: { voices: [{ id: "fixture_voice", name: "Fixture Voice", group: "Default" }] } }));
  const wav = Buffer.alloc(44 + 16000); wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(16000, 40);
  await page.route("**/outputs/e2e/audio-*.mp3", route => route.fulfill({ contentType: "audio/wav", body: wav }));
  let calls = [];
  await page.route("**/api/node/generate-audio", async route => {
    calls.push(route.request().postDataJSON());
    await route.fulfill(calls.length === 2 ? { status: 429, json: { error: "Fixture quota reached" } } : { json: { audio: "/outputs/e2e/audio-" + calls.length + ".mp3", durationSeconds: 1, fileName: "rain.mp3", cost: { amountUsd: 0.002, estimated: true } } });
  });
  const sound = card(page, "sound");
  await expect(sound.getByLabel("Audio mode", { exact: true })).toHaveValue("sfx");
  await sound.getByLabel("Audio generations", { exact: true }).selectOption("2");
  await sound.getByRole("button", { name: /^Run Audio/ }).click();
  await expect(sound.getByText(/1 of 2 audio generations complete/)).toBeVisible();
  await expect(sound.locator(".result-audio audio")).toHaveAttribute("src", /audio-1/);
  await expect(card(page, "preview").locator(".preview-stage audio")).toHaveAttribute("src", /audio-1/);
  expect(calls).toHaveLength(2);
  expect(calls[0].generationKind).toBe("audio");
  expect(calls[0].prompt).toBe("Gentle rain");
  await expect.poll(() => sound.locator(".result-audio audio").evaluate(el => el.readyState)).toBeGreaterThan(0);
  await sound.getByLabel("Audio mode", { exact: true }).selectOption("tts");
  await sound.getByLabel("Refresh ElevenLabs voices", { exact: true }).click();
  await expect(sound.getByLabel("ElevenLabs voice", { exact: true })).toHaveValue("fixture_voice");
  await sound.getByLabel("Audio mode", { exact: true }).selectOption("sts");
  await expect(sound.getByLabel("Audio prompt", { exact: true })).toBeDisabled();
  await expect(sound.getByLabel("Upload speech", { exact: true })).toBeEnabled();
  await page.route("**/api/node/upload-asset", route => route.fulfill({ json: { asset: { localUrl: "/uploads/fixture/speech.wav", fileName: "speech.wav", mediaType: "audio", mimeType: "audio/wav" } } }));
  await sound.getByLabel("Upload speech", { exact: true }).setInputFiles({ name: "speech.wav", mimeType: "audio/wav", buffer: wav });
  await expect(sound.getByText("speech.wav", { exact: true })).toBeVisible();
  await sound.getByLabel("Audio generations", { exact: true }).selectOption("1");
  await sound.getByRole("button", { name: /^Run Audio/ }).click();
  await expect(sound.locator(".result-audio audio")).toHaveAttribute("src", /audio-3/);
  expect(calls[2].audioMode).toBe("sts");
  expect(calls[2].sourceAudioUrl).toBe("/uploads/fixture/speech.wav");
  await sound.getByLabel("Audio mode", { exact: true }).selectOption("music");
  await expect(sound.getByLabel("Audio model", { exact: true })).toHaveValue("music_v1");
  await sound.getByLabel("Audio model", { exact: true }).selectOption("music_v2");
  await expect(sound.getByLabel("Instrumental", { exact: true })).toBeChecked();
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(sound.getByLabel("Audio mode", { exact: true })).toHaveValue("music");
  await expect(sound.getByLabel("Audio model", { exact: true })).toHaveValue("music_v2");
  await expect(sound.locator(".result-audio audio")).toHaveAttribute("src", /audio-3/);
  expect((await wireAttachmentErrors(page, edges)).every(value => !value.missing && value.start < 2 && value.end < 2)).toBe(true);
  await page.screenshot({ path: "e2e/.generated/audio-model-review.png" });
  expect(errors).toEqual([]);
});

test("Stats includes audio generations and recorded cost", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 2 });
  await page.route("**/api/stats/local", route => route.fulfill({ json: { history: [{ id: "audio-stat", createdAt: new Date().toISOString(), mediaType: "audio", modelName: "Eleven Music v2", provider: "ElevenLabs", project: { id: "audio", name: "Audio project" }, settings: { durationSeconds: 60 }, cost: { amountUsd: 0.15, estimated: true } }] } }));
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.locator(".analytics-ledger tbody tr")).toHaveCount(1);
  await expect(page.locator(".analytics-ledger summary")).toContainText("audio");
  await expect(page.locator(".analytics-ledger").getByText("$0.15", { exact: true })).toBeVisible();
  await expect(page.locator(".analytics-ledger summary strong")).toHaveText("Eleven Music v2");
  expect(errors).toEqual([]);
});

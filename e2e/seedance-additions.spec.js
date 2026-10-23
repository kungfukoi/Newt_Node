import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { applyFilmDirectorAudioPolicyToPrompt } from "../src/filmDirectorAudio.js";

const card = page => page.locator('[data-node-card-id="video"]');
async function setup(page, provider = "fal", edit = false) {
  const nodes = [
    { id: "video", type: "videoModel", x: 10, y: 20, data: { title: "Video", model: "Seedance 2.5", prompt: "@Source moves gently", duration: "12 seconds", resolution: "1080p", aspectRatio: "21:9", settingsOpen: true, ...(edit ? { seedanceTask: "edit" } : {}) } },
    { id: "source", type: "video", x: 850, y: 0, data: { title: "Source", resultUrl: "/outputs/e2e/source.mp4", resultItems: [{ type: "video", url: "/outputs/e2e/source.mp4", label: "Filename.mp4" }] } },
    { id: "preview", type: "preview", x: 10, y: 700, data: { title: "Preview" } }
  ];
  const edges = [
    { id: "source-video", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "video", port: "referenceVideoIn" } },
    { id: "video-preview", from: { nodeId: "video", port: "videoOut" }, to: { nodeId: "preview", port: "sourceIn" } }
  ];
  await page.addInitScript(graph => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(graph)); }, { nodes, edges, groups: [], viewport: { x: 0, y: 0, scale: .6 } });
  return openFixture(page, { count: 3, settings: { falKeyConfigured: true, kreaKeyConfigured: true, atlasKeyConfigured: true, modelProviderPreferences: { seedance: provider, imageGeneration: "fal" } } });
}

for (const provider of ["fal", "atlas"]) test(`${provider} draft previews finish through the shared job and preserve outputs across reload`, async ({ page }) => {
  const { errors } = await setup(page, provider);
  const video = card(page);
  let submitted, completions = 0;
  const receipt = { receiptId: "12345678-1234-1234-1234-123456789012", draftId: "draft-provider", provider, expiresAt: "2099-10-20T00:00:00Z" };
  await page.route("**/api/node/generate-video", route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { video: { localUrl: "/outputs/e2e/draft.mp4" }, seedanceDraft: receipt } });
  });
  const finished = { video: { localUrl: "/outputs/e2e/finished.mp4" }, seedanceDraftSource: receipt.receiptId, generationRunId: "seedance-finish-" + receipt.receiptId };
  await page.route("**/api/node/seedance-draft/complete", route => {
    completions++;
    expect(route.request().postDataJSON().receiptId).toBe(receipt.receiptId);
    return route.fulfill({ status: 202, json: { job: { runId: finished.generationRunId, state: "completed", result: finished } } });
  });
  await video.getByLabel("Seedance Draft mode").click();
  await expect(video.getByLabel("Seedance resolution")).toHaveValue("480p");
  await expect(video.getByLabel("Seedance resolution")).toBeDisabled();
  await video.locator(".run-node-button").first().click();
  await expect(video.getByRole("button", { name: /^Finish at 1080p/ })).toBeVisible();
  expect(submitted.seedanceDraft).toBe(true); expect(submitted.resolution).toBe("480p");
  expect(submitted.referenceVideoLabels).toEqual(["Source"]);
  await video.getByRole("button", { name: /^Finish at 1080p/ }).click();
  await expect(video.locator("video").first()).toHaveAttribute("src", /finished/);
  await expect(page.locator('[data-node-card-id="preview"] video').first()).toHaveAttribute("src", /finished/);
  expect(completions).toBe(1);
  await video.getByLabel("Seedance Draft mode").click();
  await expect(video.getByLabel("Seedance resolution")).toHaveValue("1080p");
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(video.locator("video").first()).toHaveAttribute("src", /finished/);
  const results = await page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "video").data.resultItems);
  expect(results).toHaveLength(2); expect(results[0].seedanceDraft.receiptId).toBe(receipt.receiptId);
  expect(errors).toEqual([]);
});

for (const provider of ["fal", "krea"]) test(`${provider} editing sends the explicit task and restores saved duration and framing`, async ({ page }) => {
  const { errors } = await setup(page, provider, true);
  const video = card(page);
  await expect(video.getByLabel("Seedance duration")).toHaveValue("source-video");
  await expect(video.getByLabel("Seedance aspect ratio")).toHaveValue("source-video");
  let submitted;
  await page.route("**/api/node/generate-video", route => { submitted = route.request().postDataJSON(); return route.fulfill({ json: { video: { localUrl: "/outputs/e2e/edited.mp4" } } }); });
  await video.locator(".run-node-button").first().click();
  await expect.poll(() => submitted?.seedanceTask).toBe("edit");
  expect(submitted.duration).toBe("auto"); expect(submitted.aspectRatio).toBe("auto");
  await expect(video.locator("video").first()).toHaveAttribute("src", /edited/);
  await video.getByLabel("Seedance task").selectOption("reference");
  await expect(video.getByLabel("Seedance duration")).toHaveValue("12 seconds");
  await expect(video.getByLabel("Seedance aspect ratio")).toHaveValue("21:9");
  expect(errors).toEqual([]);
});

test("Krea enables both drafts and saved edits", async ({ page }) => {
  const { errors } = await setup(page, "krea", true);
  await expect(card(page).getByLabel("Seedance Draft mode")).toBeEnabled();
  await expect(card(page).locator(".run-node-button").first()).toBeEnabled();
  expect(errors).toEqual([]);
});

test("Krea drafts stay preview-only after reload and preserve normal resolution", async ({ page }) => {
  const { errors } = await setup(page, "krea");
  const video = card(page);
  let submitted;
  await page.route("**/api/node/generate-video", route => {
    submitted = route.request().postDataJSON();
    return route.fulfill({ json: { video: { localUrl: "/outputs/e2e/draft.mp4" }, seedanceDraft: { provider: "krea", resolution: "480p", completionSupported: false } } });
  });
  const toggle = video.getByLabel("Seedance Draft mode");
  await expect(toggle).toHaveAttribute("title", /Krea preview only/);
  await toggle.click();
  await video.locator(".run-node-button").first().click();
  await expect(video.getByText("Krea draft / Preview only")).toBeVisible();
  expect(submitted.seedanceDraft).toBe(true); expect(submitted.resolution).toBe("480p");
  await expect(video.getByRole("button", { name: /^Finish at 1080p/ })).toHaveCount(0);
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(video.getByText("Krea draft / Preview only")).toBeVisible();
  await expect(video.getByRole("button", { name: /^Finish at 1080p/ })).toHaveCount(0);
  await video.getByLabel("Seedance Draft mode").click();
  await expect(video.getByLabel("Seedance resolution")).toHaveValue("1080p");
  expect(errors).toEqual([]);
});

for (const provider of ["atlas", "krea"]) test(`${provider} Director draft preference persists without rebuilding the plan`, async ({ page }) => {
  const plan = applyFilmDirectorAudioPolicyToPrompt("Keep this plan");
  await page.addInitScript(plan => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
    { id: "director", type: "skillDirector", x: 10, y: 10, data: { title: "Director", skillVideoModel: "Seedance 2.5", skillResolution: "1080p", skillDirectorBuilt: true, resultText: plan, skillDirectorCollapsed: { setup: false } } }
  ], edges: [], groups: [], viewport: { x: 0, y: 0, scale: .8 } })), plan);
  const { errors, requests } = await openFixture(page, { count: 1, settings: { falKeyConfigured: true, kreaKeyConfigured: true, atlasKeyConfigured: true, modelProviderPreferences: { seedance: provider } } });
  const toggle = page.getByLabel("Director Draft mode");
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute("title", provider === "krea" ? /Krea preview only/ : /same provider and key/);
  const before = await page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes[0].data);
  await toggle.check();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes[0].data.skillSeedanceDraft)).toBe(true);
  const data = await page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes[0].data);
  expect(data.resultText).toBe(before.resultText); expect(data.skillResolution).toBe("1080p");
  expect(requests.filter(request => request.method === "POST" && request.path.startsWith("/api/node/"))).toHaveLength(0);
  expect(errors).toEqual([]);
});

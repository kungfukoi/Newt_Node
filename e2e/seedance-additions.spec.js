import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

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

test("draft previews finish through the shared job and preserve outputs across reload", async ({ page }) => {
  const { errors } = await setup(page);
  const video = card(page);
  let submitted, completions = 0;
  const receipt = { receiptId: "12345678-1234-1234-1234-123456789012", draftId: "draft-provider", expiresAt: "2099-10-20T00:00:00Z" };
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

test("editing sends the explicit task and restores saved duration and framing", async ({ page }) => {
  const { errors } = await setup(page, "fal", true);
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

test("Krea cannot enable drafts or run a saved edit", async ({ page }) => {
  const { errors } = await setup(page, "krea", true);
  await expect(card(page).getByLabel("Seedance Draft mode")).toBeDisabled();
  await expect(card(page).locator(".run-node-button").first()).toBeDisabled();
  expect(errors).toEqual([]);
});

test("Atlas requires selecting Fal before enabling Draft", async ({ page }) => {
  await setup(page, "atlas");
  await expect(card(page).getByRole("switch", { name: "Seedance Draft mode" })).toBeDisabled();
  await expect(card(page).getByText(/Seedance currently uses atlas/)).toBeVisible();
});

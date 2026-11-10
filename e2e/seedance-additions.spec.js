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

test("finishing selected saved drafts labels both versions and updates the connected Output", async ({ page }) => {
  const drafts = ["shot-one", "shot-two", "shot-three"].map((name, index) => ({
    type: "video", url: `/outputs/e2e/${name}_draft.mp4`, fileName: `${name}_draft.mp4`, label: "Draft 1 (480p)",
    seedanceDraft: { provider: "fal", receiptId: `draft-receipt-${index}`, expiresAt: "2099-10-20T00:00:00Z" }
  }));
  const graph = {
    nodes: [
      { id: "video", type: "videoModel", x: 0, y: 20, data: { title: "Video", model: "Seedance 2.5", resultItems: drafts, resultUrl: drafts[0].url } },
      { id: "preview", type: "preview", x: 430, y: 20, data: { title: "Preview" } },
      { id: "delivery", type: "output", x: 850, y: 20, data: { title: "Delivery", outputPath: "deliveries" } },
      { id: "reference", type: "video", x: 1250, y: 20, data: { title: "Reference", fileName: "camera-original.mov", resultUrl: "/outputs/e2e/camera-original.mov" } }
    ],
    edges: [
      ...["preview", "delivery"].map(id => ({ id, from: { nodeId: "video", port: "videoOut" }, to: { nodeId: id, port: "sourceIn" } })),
      { id: "reference-video", from: { nodeId: "reference", port: "videoOut" }, to: { nodeId: "video", port: "referenceVideoIn" } }
    ],
    groups: [], viewport: { x: 70, y: 90, scale: .8 }
  };
  await page.addInitScript(graph => {
    if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(graph));
  }, graph);
  const { errors } = await openFixture(page, { count: 4, settings: { falKeyConfigured: true } });
  const requests = [];
  await page.route("**/api/node/seedance-draft/complete", route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const runId = "seedance-finish-" + body.receiptId;
    const fileName = body.previewFileName.replace("_draft.mp4", ".mp4");
    const result = { video: { localUrl: `/outputs/e2e/${fileName}`, fileName }, seedanceDraftSource: body.receiptId, generationRunId: runId,
      seedanceDraftPreviewFileName: body.previewFileName, seedanceDraftDeliveryFileName: fileName, seedanceDraftOutputNodeId: "delivery" };
    return route.fulfill({ status: 202, json: { job: { runId, state: "completed", result } } });
  });

  const video = card(page);
  await video.getByText("Finish multiple drafts (3 available)").click();
  await video.getByRole("checkbox", { name: "shot-one" }).check();
  await video.getByRole("checkbox", { name: "shot-three" }).check();
  await video.getByRole("button", { name: "Finish selected at 1080p (2)" }).click();
  const preview = page.locator('[data-node-card-id="preview"]');
  const hdThumb = preview.getByRole("button", { name: /^Select preview \d+: shot-one$/ });
  const draftThumb = preview.getByRole("button", { name: /^Select preview \d+: shot-one \(Draft\)$/ });
  await expect(hdThumb).toBeVisible();
  await expect(hdThumb.locator("..").locator(".preview-thumb-footer")).toHaveText("");
  await expect(draftThumb.locator("..").locator(".preview-thumb-footer")).toHaveText("Draft");
  expect(requests.map(body => body.receiptId).sort()).toEqual(["draft-receipt-0", "draft-receipt-2"]);
  expect(requests.every(body => body.outputTargetPath === "deliveries" && body.outputTargetNodeId === "delivery")).toBe(true);
  expect(requests[0].generationGroupId).toBe(requests[1].generationGroupId);

  const output = page.locator('[data-node-card-id="delivery"]');
  await expect(output.getByText("Saved shot-three.mp4")).toBeVisible();
  await draftThumb.click();
  await expect(preview.locator("video").first()).toHaveAttribute("src", /shot-one_draft\.mp4/);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes
    .find(node => node.id === "delivery").data.resultItems?.map(item => item.fileName))).toEqual(["shot-one.mp4", "shot-three.mp4"]);

  let manualSave;
  await page.route("**/api/node/save-output", route => {
    manualSave = route.request().postDataJSON();
    const fileName = "shot-one-2.mp4";
    return route.fulfill({ json: { output: { localUrl: `/outputs/e2e/${fileName}`, fileName, mediaType: "video" } } });
  });
  await hdThumb.click();
  await expect(preview.locator("video").first()).toHaveAttribute("src", /shot-one\.mp4/);
  await output.getByRole("button", { name: "Run Output", exact: true }).click();
  await expect(output.getByText("Saved shot-one-2.mp4")).toBeVisible();
  expect(manualSave).toMatchObject({
    sourceUrl: "/outputs/e2e/shot-one.mp4",
    sourceFileName: "shot-one.mp4",
    outputTargetSourceFileName: "shot-one.mp4",
    outputTargetFileName: "$filename",
    seedanceFinishedFileName: "shot-one.mp4",
    outputFormat: "source"
  });
  expect(requests).toHaveLength(2);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(preview.getByRole("button", { name: /Select preview \d+: shot-three$/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("Run Output exports only the HD take selected on a batch-generated Video Model", async ({ page }) => {
  const drafts = [1, 2].map(index => ({
    id: `entry-${index}`, type: "video", url: `/outputs/e2e/draft-${index}.mp4`, fileName: `draft-${index}.mp4`,
    seedanceDraft: { receiptId: `receipt-${index}`, provider: "fal" }
  }));
  const finished = drafts.map((draft, index) => ({
    type: "video", url: `/outputs/e2e/hd-${index + 1}.mp4`, fileName: `hd-${index + 1}.mp4`,
    seedanceDraftSource: draft.seedanceDraft.receiptId
  }));
  const fixture = {
    nodes: [
      { id: "video", type: "videoModel", x: 20, y: 20, data: { title: "Video Model", model: "Seedance 2.5", status: "complete",
        batchMediaType: "video", batchResults: drafts, resultItems: [...drafts, ...finished], selectedResultIndex: 1, resultUrl: drafts[1].url } },
      { id: "delivery", type: "output", x: 480, y: 20, data: { title: "Output", outputPath: "deliveries", outputFileName: "CartoonSubway_2k_$index" } }
    ],
    edges: [{ id: "video-delivery", from: { nodeId: "video", port: "videoOut" }, to: { nodeId: "delivery", port: "sourceIn" } }],
    groups: [], viewport: { x: 50, y: 70, scale: .8 }
  };
  const { errors, requests } = await openFixture(page, { fixture, settings: { falKeyConfigured: true } });
  const saves = [];
  await page.route("**/api/node/save-output", route => {
    saves.push(route.request().postDataJSON());
    const fileName = `CartoonSubway_2k_0${saves.length}.mp4`;
    return route.fulfill({ json: { output: { localUrl: `/outputs/e2e/${fileName}`, fileName, mediaType: "video" } } });
  });
  const video = card(page);
  const output = page.locator('[data-node-card-id="delivery"]');
  for (const index of [1, 2]) {
    await video.getByRole("button", { name: "Next generation", exact: true }).click();
    await expect(video.locator(".result-item video")).toHaveAttribute("src", new RegExp(`/hd-${index}\\.mp4$`));
    await output.getByRole("button", { name: "Run Output", exact: true }).click();
    await expect(output.getByText(`Saved CartoonSubway_2k_0${index}.mp4`)).toBeVisible();
  }
  expect(saves.map(save => save.sourceUrl)).toEqual(finished.map(item => item.url));
  expect(saves.map(save => save.outputTargetFileName)).toEqual(Array(2).fill("CartoonSubway_2k_$index"));
  expect(requests.filter(request => request.path === "/api/node/generate-video")).toHaveLength(0);
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

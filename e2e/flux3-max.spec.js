import { test, expect } from "@playwright/test";
import { openFixture, wireAttachmentErrors } from "./helpers.mjs";

test("FLUX 3 Max controls, batch results, Preview and saved settings use the video flow", async ({ page }, testInfo) => {
  const nodes = [
    { id: "flux-video", type: "videoModel", x: 20, y: 20, data: { title: "FLUX video", model: "FLUX 3 Max", prompt: "A bird sings", settingsOpen: true } },
    { id: "preview", type: "preview", x: 600, y: 20, data: { title: "Video preview" } }
  ];
  const edges = [{ id: "video-preview", from: { nodeId: "flux-video", port: "videoOut" }, to: { nodeId: "preview", port: "sourceIn" } }];
  await page.addInitScript(fixture => {
    if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(fixture));
  }, { nodes, edges, groups: [], viewport: { x: 20, y: 20, scale: 0.8 } });
  const { errors } = await openFixture(page, { count: 2, settings: { falKeyConfigured: true, modelProviderPreferences: { veo: "fal" } } });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { flux3Max: true } } }));
  const calls = [];
  await page.route("**/api/node/generate-video", async route => {
    calls.push(route.request().postDataJSON());
    await route.fulfill({ json: { requestId: `flux-${calls.length}`, modelName: "FLUX 3 Max", seed: 42, cost: { amountUsd: null, pricingStatus: "unpriced" }, video: { localUrl: `/outputs/e2e/flux-${calls.length}.mp4`, fileName: "flux.mp4" } } });
  });
  const card = page.locator('[data-node-card-id="flux-video"]');
  const row = label => card.locator(".node-row").filter({ has: page.locator(".node-row-label", { hasText: new RegExp(`^${label}$`) }) });
  await expect(row("Model").locator("select")).toHaveValue("FLUX 3 Max");
  await expect(row("Duration").locator("select")).toHaveValue("5 seconds");
  await expect(row("Reference Image")).toHaveCount(0);
  await expect(row("Start Frame")).toHaveCount(0);
  await expect(row("End Frame")).toHaveCount(0);
  await expect(row("Character")).toHaveCount(0);
  await expect(row("Director")).toHaveCount(0);
  await row("Duration").locator("select").selectOption("20 seconds");
  await row("Resolution").locator("select").selectOption("1080p");
  await row("Aspect Ratio").locator("select").selectOption("9:16");
  await row("Reasoning").locator("select").selectOption("low");
  await row("Seed").locator("input").fill("0");
  await expect(row("Keyframes")).toHaveCount(1);
  await card.getByLabel("Keyframe 1 frame index").fill("24");
  await card.getByRole("button", { name: "Add keyframe", exact: true }).click();
  await card.getByLabel("Keyframe 2 frame index").fill("60");
  await card.getByRole("button", { name: "Add keyframe", exact: true }).click();
  await card.getByLabel("Keyframe 3 frame index").fill("96");
  await card.getByRole("button", { name: "Remove keyframe", exact: true }).click();
  await expect(card.getByLabel("Keyframe 3 frame index")).toHaveCount(0);
  await row("Generations").locator("select").selectOption("2");
  await card.getByRole("button", { name: /^Run Video/ }).click();
  await expect.poll(() => calls.length).toBe(2);
  await expect(card.locator("video").first()).toHaveAttribute("src", /flux-.*mp4/);
  await expect(page.locator('[data-node-card-id="preview"] video').first()).toHaveAttribute("src", /flux-.*mp4/);
  expect(calls[0]).toMatchObject({ model: "FLUX 3 Max", duration: "20 seconds", resolution: "1080p", aspectRatio: "9:16", flux3MaxReasoningLevel: "low", seed: "0" });
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(row("Reasoning").locator("select")).toHaveValue("low");
  await expect(row("Seed").locator("input")).toHaveValue("0");
  await expect(card.getByLabel("Keyframe 1 frame index")).toHaveValue("24");
  await expect(card.getByLabel("Keyframe 2 frame index")).toHaveValue("60");
  for (let i = 2; i < 10; i++) await card.getByRole("button", { name: "Add keyframe", exact: true }).click();
  await expect(card.getByRole("button", { name: "Add keyframe", exact: true })).toBeDisabled();
  await expect(card.getByLabel(/Keyframe \d+ frame index/)).toHaveCount(10);
  await expect(row("Resolution").locator("select")).toHaveValue("1080p");
  await expect.poll(async () => (await wireAttachmentErrors(page, edges)).every(value => !value.missing && value.start < 2 && value.end < 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("flux3-max.png") });
  expect(errors).toEqual([]);
});

test("individual keyframe ports retain connections on reload and remove their own edge", async ({ page }, testInfo) => {
  const nodes = [
    { id: "flux", type: "videoModel", x: 450, y: 20, data: { model: "FLUX 3 Max", prompt: "A bird flies", settingsOpen: true, flux3MaxKeyframes: [{ id: "referenceImageIn", frameIndex: "0" }, { id: "fluxKeyframe_saved", frameIndex: "72" }] } },
    { id: "image", type: "image", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/landscape.png", status: "complete" } }
  ];
  const edges = ["referenceImageIn", "fluxKeyframe_saved"].map((port, index) => ({ id: `frame-${index}`, from: { nodeId: "image", port: "imageOut" }, to: { nodeId: "flux", port } }));
  await page.addInitScript(fixture => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(fixture)); }, { nodes, edges, groups: [], viewport: { x: 20, y: 20, scale: 0.8 } });
  const { errors } = await openFixture(page, { count: 2, settings: { falKeyConfigured: true, modelProviderPreferences: { veo: "fal" } } });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { flux3Max: true } } }));
  const calls = [];
  await page.route("**/api/node/generate-video", route => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ json: { video: { localUrl: "/outputs/e2e/clip.mp4", fileName: "clip.mp4" } } });
  });
  const card = page.locator('[data-node-card-id="flux"]');
  await expect.poll(async () => (await wireAttachmentErrors(page, edges)).every(value => !value.missing && value.end < 2)).toBe(true);
  await card.getByRole("button", { name: /^Run Video/ }).click();
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0].flux3MaxKeyframes).toEqual([{ image_url: "/outputs/e2e/landscape.png", frame_index: "0" }, { image_url: "/outputs/e2e/landscape.png", frame_index: "72" }]);
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(card.getByLabel("Keyframe 2 frame index")).toHaveValue("72");
  await expect.poll(async () => (await wireAttachmentErrors(page, edges)).every(value => !value.missing && value.end < 2)).toBe(true);
  await card.getByRole("button", { name: "Remove keyframe", exact: true }).click();
  await expect(card.getByLabel("Keyframe 2 frame index")).toHaveCount(0);
  await card.getByRole("button", { name: /^Run Video/ }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].flux3MaxKeyframes).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath("keyframe-rows.png") });
  expect(errors).toEqual([]);
});

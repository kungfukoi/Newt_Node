import { test, expect } from "@playwright/test";
import { openFixture, wireAttachmentErrors } from "./helpers.mjs";

for (const provider of ["fal", "atlas"]) test(`Kling 4.0 ${provider} settings, ordered frames, batch output and reopen`, async ({ page }, testInfo) => {
  const nodes = [
    { id: "kling", type: "videoModel", x: 420, y: 20, data: { model: "Kling 4.0 Image-to-Video", prompt: "A bird flies", settingsOpen: true } },
    { id: "image", type: "image", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/landscape.png", status: "complete" } },
    { id: "preview", type: "preview", x: 900, y: 20, data: {} }
  ];
  const edges = ["startFrameIn", "referenceImageIn", "endFrameIn"].map(port => ({ id: port, from: { nodeId: "image", port: "imageOut" }, to: { nodeId: "kling", port } }));
  edges.push({ id: "preview", from: { nodeId: "kling", port: "videoOut" }, to: { nodeId: "preview", port: "sourceIn" } });
  await page.addInitScript(fixture => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(fixture)); }, { nodes, edges, groups: [], viewport: { x: 20, y: 20, scale: 0.8 } });
  const { errors } = await openFixture(page, { count: 3, settings: { falKeyConfigured: true, atlasKeyConfigured: true, modelProviderPreferences: { veo: provider } } });
  const calls = [];
  await page.route("**/api/node/generate-video", route => {
    calls.push(route.request().postDataJSON());
    return route.fulfill({ json: { requestId: `kling-${calls.length}`, provider, modelName: "Kling 4.0 Image-to-Video", cost: { amountUsd: null, pricingStatus: "unpriced" }, video: { localUrl: "/outputs/e2e/kling.mp4", fileName: "kling.mp4" } } });
  });
  const card = page.locator('[data-node-card-id="kling"]');
  const row = label => card.locator(".node-row").filter({ has: page.locator(".node-row-label", { hasText: new RegExp(`^${label}$`) }) });
  await expect(row("Model").locator("select")).toHaveValue("Kling 4.0 Image-to-Video");
  for (const label of ["Director", "Character", "Generate Audio", "Aspect Ratio", "Negative", "Prompt Strength"]) await expect(row(label)).toHaveCount(0);
  await expect(row("Middle Images")).toHaveCount(1);
  await row("Duration").locator("select").selectOption("30 seconds");
  const resolution = provider === "atlas" ? "4k-esr" : "720p";
  await row("Resolution").locator("select").selectOption(resolution);
  await row("Generations").locator("select").selectOption("2");
  await card.getByRole("button", { name: /^Run Video/ }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[0]).toMatchObject({ model: "Kling 4.0 Image-to-Video", duration: "30 seconds", resolution, generateAudio: false, startFrameUrls: ["/outputs/e2e/landscape.png"], endFrameUrls: ["/outputs/e2e/landscape.png"], referenceImageUrls: ["/outputs/e2e/landscape.png"] });
  await expect(page.locator('[data-node-card-id="preview"] video').first()).toHaveAttribute("src", /kling.mp4/);
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(row("Duration").locator("select")).toHaveValue("30 seconds");
  await expect(row("Resolution").locator("select")).toHaveValue(resolution);
  await expect.poll(async () => (await wireAttachmentErrors(page, edges)).every(value => !value.missing && value.end < 2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`kling4-${provider}.png`) });
  expect(errors).toEqual([]);
});

test("Stats keeps Kling 4.0 provider routes and unpriced runs separate", async ({ page }) => {
  const { errors } = await openFixture(page);
  const history = ["fal", "atlas"].map(provider => ({
    id: `kling-${provider}`, createdAt: new Date().toISOString(), provider, modelName: "Kling 4.0 Image-to-Video", mediaType: "video",
    endpoint: provider === "fal" ? "kling/v4/image-to-video" : "kwaivgi/kling-v4.0/image-to-video",
    cost: { amountUsd: null, currency: "USD", pricingBasis: "No verified Kling 4.0 price is available" }
  }));
  await page.route("**/api/stats/local", route => route.fulfill({ json: { history, fetchedAt: new Date().toISOString(), coverage: {} } }));
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  const ledger = page.locator(".analytics-ledger");
  await expect(ledger.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("Model", { exact: true }).selectOption("Kling 4.0 Image-to-Video");
  for (const provider of ["fal", "atlas"]) {
    await page.getByLabel("Provider", { exact: true }).selectOption(provider);
    await expect(ledger.locator("tbody tr")).toHaveCount(1);
    await ledger.locator("summary").click();
    await expect(ledger.getByText(history.find(row => row.provider === provider).endpoint, { exact: true })).toBeVisible();
    await expect(ledger.getByText("No verified Kling 4.0 price is available", { exact: true })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

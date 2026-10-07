import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("image options follow the selected model and survive reopening", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
      nodes: [{ id: "image-model", type: "imageModel", x: 20, y: 20, data: { model: "Flux 3", settingsOpen: true } }],
      edges: [], groups: [], viewport: { x: 20, y: 20, scale: 0.8 }
    }));
  });
  const { errors } = await openFixture(page, { count: 1, settings: { falKeyConfigured: true, modelProviderPreferences: { imageGeneration: "fal" } } });
  const card = page.locator('[data-node-card-id="image-model"]');
  const model = card.locator('select').filter({ has: page.locator('option[value="Flux 3"]') });
  await card.getByLabel("Flux output format").selectOption("jpeg");
  await card.getByLabel("Flux safety tolerance").fill("0");
  await card.getByLabel("Prompt Expansion", { exact: true }).check();
  await expect(card.getByLabel("Ideogram quality")).toHaveCount(0);
  await model.selectOption("Ideogram 4.5");
  await card.getByLabel("Ideogram quality").selectOption("medium");
  await card.getByLabel("Ideogram seed").fill("42");
  await card.getByLabel("Ideogram image size").selectOption("3072x1024");
  await expect(card.getByLabel("Flux output format")).toHaveCount(0);
  await model.selectOption("Flux 3");
  await expect(card.getByLabel("Flux output format")).toHaveValue("jpeg");
  await expect(card.getByLabel("Prompt Expansion", { exact: true })).toBeChecked();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes?.[0]?.data?.ideogram45Options?.seed)).toBe("42");
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(card.getByLabel("Flux output format")).toHaveValue("jpeg");
  await model.selectOption("Ideogram 4.5");
  await expect(card.getByLabel("Ideogram quality")).toHaveValue("medium");
  await expect(card.getByLabel("Ideogram seed")).toHaveValue("42");
  await page.screenshot({ path: "test-results/image-model-options.png" });
  expect(errors).toEqual([]);
});

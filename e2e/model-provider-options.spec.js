import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

for (const provider of ["atlas", "krea", "fal"]) {
  test(`model dropdowns reflect ${provider} support without changing saved selections`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
      nodes: [
        { id: "image-model", type: "imageModel", x: 20, y: 20, data: { model: "Flux 3", settingsOpen: true } },
        { id: "video-model", type: "videoModel", x: 650, y: 20, data: { model: "Seedance 2.5", settingsOpen: true } }
      ], edges: [], groups: [], viewport: { x: 20, y: 20, scale: 0.8 }
    })));
    const { errors } = await openFixture(page, { count: 2, settings: {
      falKeyConfigured: true, modelProviderPreferences: { imageGeneration: provider, veo: "google", seedance: "atlas" }
    } });
    const image = page.locator('[data-node-card-id="image-model"] select').filter({ has: page.locator('option[value="Flux 3"]') });
    await expect(image).toHaveValue("Flux 3");
    for (const model of ["Flux 3", "Ideogram 4.5"]) {
      const option = image.locator(`option[value="${model}"]`);
      if (provider === "fal") await expect(option).toBeEnabled();
      else { await expect(option).toBeDisabled(); await expect(option).toContainText("unavailable"); }
    }
    await expect(image.locator('option[value="OpenAI Image 2.5 Flare"]')).toBeEnabled();
    const video = page.locator('[data-node-card-id="video-model"] select').filter({ has: page.locator('option[value="Seedance 2.5"]') });
    await expect(video.locator('option[value="Seedance 2.5"]')).toBeEnabled();
    await expect(video.locator('option[value="Kling O3 Pro"]')).toBeDisabled();
    await expect(video.locator('option[value="Gemini Omni Flash"]')).toBeEnabled();
    expect(errors).toEqual([]);
  });
}

async function routingFixture(page, { failSave = false, staleReload = false } = {}) {
  const fixture = await openFixture(page, { count: 1 });
  let state = { modelProviderPreferences: { seedance: "fal", veo: "google", imageGeneration: "google", minimaxH3: "fal", llm: "fal" }, credentials: {}, activeCredentialIds: {} };
  const saves = [];
  await page.route(/\/api\/settings(?:\?.*)?$/, async route => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON(); saves.push(payload);
      if (failSave) return route.fulfill({ status: 500, json: { error: "Routing write failed" } });
      if (!staleReload) state = { ...state, ...payload };
    }
    return route.fulfill({ json: { ...state, secrets: { credentials: state.credentials } } });
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  return { ...fixture, saves };
}

test("Save Routing persists choices without requiring keys for every category", async ({ page }, testInfo) => {
  const { saves, errors } = await routingFixture(page);
  await page.getByRole("combobox", { name: /^Image Model/ }).selectOption("atlas");
  await page.getByRole("button", { name: "Save Routing", exact: true }).click();
  await expect.poll(() => saves.length).toBe(1);
  await expect(page.getByRole("status")).toContainText("Model provider routing saved.");
  await expect(page.getByRole("status")).toContainText("Atlas Cloud");
  await page.screenshot({ path: testInfo.outputPath("routing-save.png") });
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("combobox", { name: /^Image Model/ })).toHaveValue("atlas");
  expect(errors).toEqual([]);
});

for (const failure of ["write", "reload"]) {
  test(`Save Routing shows ${failure} failure beside the button and keeps the draft`, async ({ page }) => {
    const { saves } = await routingFixture(page, { failSave: failure === "write", staleReload: failure === "reload" });
    await page.getByRole("combobox", { name: /^Image Model/ }).selectOption("atlas");
    await page.getByRole("button", { name: "Save Routing", exact: true }).click();
    await expect.poll(() => saves.length).toBe(1);
    await expect(page.getByRole("status")).toContainText(failure === "write" ? "Routing write failed" : "did not preserve model provider routing");
    await expect(page.getByRole("combobox", { name: /^Image Model/ })).toHaveValue("atlas");
  });
}

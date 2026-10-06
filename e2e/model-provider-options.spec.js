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

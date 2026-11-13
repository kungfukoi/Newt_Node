import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

for (const batch of [false, true]) {
  test(`connected Preview keeps its image gallery for ${batch ? "Batch" : "regular"} generations`, async ({ page }) => {
    const previous = ["old-1", "old-2"].map(name => ({ url: `/outputs/e2e/${name}.png`, type: "image" }));
    const nodes = [
      { id: "model", type: "imageModel", x: 390, y: 70, data: { model: "Nano Banana Pro", prompt: "A house on a hill", aspectRatio: "1:1", resolution: "1K", batchCount: "1", settingsOpen: false,
        resultItems: previous, resultUrl: previous[0].url, selectedResultIndex: 0 } },
      { id: "preview", type: "preview", x: 790, y: 70, data: {} }
    ];
    const edges = [{ id: "viewer", from: { nodeId: "model", port: "imageOut" }, to: { nodeId: "preview", port: "sourceIn" } }];
    if (batch) {
      nodes.push({ id: "batch", type: "batch", x: 20, y: 70, data: { batchMediaType: "image", batchFiles: [1, 2].map(id => ({ id: String(id), url: `/outputs/e2e/ref-${id}.png`, type: "image" })) } });
      edges.push({ id: "input", from: { nodeId: "batch", port: "batchOut" }, to: { nodeId: "model", port: "imagePromptIn" } });
    }
    await page.addInitScript(({ nodes, edges }) => {
      const key = "seedance-node-editor-draft-v1";
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify({ nodes, edges, groups: [], viewport: { x: 20, y: 20, scale: .8 } }));
    }, { nodes, edges });
    await openFixture(page, { count: nodes.length, settings: { falKeyConfigured: true, modelProviderPreferences: { imageGeneration: "fal" } } });
    const preview = page.locator('[data-node-card-id="preview"]');
    const viewer = preview.getByRole("group", { name: "Preview image viewer" }).locator("img");
    const thumbnails = preview.locator(".preview-thumb-select");
    const run = page.locator('[data-node-card-id="model"]').getByRole("button", { name: /^Run/ });
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    let calls = 0;
    await page.route("**/api/node/generate-image", async route => {
      const index = ++calls;
      await pending;
      await route.fulfill({ json: { images: [{ localUrl: `/outputs/e2e/new-${index}.png`, mimeType: "image/png" }] } });
    });
    try {
      await expect(thumbnails).toHaveCount(2);
      await run.click();
      await expect.poll(() => calls).toBe(batch ? 2 : 1);
      await expect(viewer).toHaveAttribute("data-full-resolution-url", previous[0].url);
      await expect(thumbnails).toHaveCount(2);
      await preview.getByRole("button", { name: "Select preview 2", exact: true }).click();
      await expect(viewer).toHaveAttribute("data-full-resolution-url", previous[1].url);
    } finally {
      release();
    }
    await expect(run).toBeEnabled();
    await expect(thumbnails).toHaveCount(batch ? 4 : 3);
    await expect(viewer).toHaveAttribute("data-full-resolution-url", previous[1].url);
    await page.reload();
    await expect(thumbnails).toHaveCount(batch ? 4 : 3);
    await expect(viewer).toHaveAttribute("data-full-resolution-url", previous[1].url);
  });
}

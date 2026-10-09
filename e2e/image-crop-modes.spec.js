import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { openFixture } from "./helpers.mjs";

test("image editor locks ratios and exports the entered pixel size", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [{ id: "source", type: "image", x: 30, y: 30, data: { resultUrl: "/outputs/e2e/landscape.png", status: "complete" } }], edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 } })));
  const { errors } = await openFixture(page, { count: 1 });
  let savedSize;
  await page.route("**/api/node/upload-asset", async route => {
    const request = route.request();
    const form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    savedSize = await sharp(Buffer.from(await form.get("asset").arrayBuffer())).metadata();
    await route.fulfill({ json: { asset: { localUrl: "/outputs/e2e/cropped.png", fileName: "cropped.png", mimeType: "image/png", mediaType: "image" } } });
  });
  await page.locator('[data-node-card-id="source"] img').first().dblclick();
  await page.getByRole("button", { name: "Crop image", exact: true }).click();
  await page.getByLabel("Crop style").selectOption("ratio");
  const box = page.locator(".output-crop-box");
  await expect(box.locator(".output-crop-handle")).toHaveCount(4);
  const square = await box.boundingBox();
  expect(Math.abs(square.width - square.height)).toBeLessThan(2);
  await page.getByLabel("Crop style").selectOption("size");
  await page.getByLabel("Crop fixed width").fill("200");
  await page.getByLabel("Crop fixed height").fill("100");
  await expect(box.locator(".output-crop-handle")).toHaveCount(0);
  await page.getByLabel("Crop fixed width").fill("2");
  await page.getByLabel("Crop fixed height").fill("3");
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  await expect.poll(() => savedSize?.width).toBe(2);
  expect(savedSize.height).toBe(3);
  expect(errors).toEqual([]);
});

test("Edit Image crop offers the same locked modes", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "source", type: "image", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/landscape.png", status: "complete" } }, { id: "edit", type: "edit", x: 550, y: 20, data: { editSourceType: "image", editEffect: "imageCrop", settingsOpen: true } }],
    edges: [{ id: "edge", from: { nodeId: "source", port: "imageOut" }, to: { nodeId: "edit", port: "imageIn" } }], groups: [], viewport: { x: 20, y: 20, scale: .8 }
  })));
  const { errors } = await openFixture(page, { count: 2 });
  await page.getByLabel("Crop style").selectOption("ratio");
  const square = await page.locator(".edit-image-crop-box").boundingBox();
  expect(Math.abs(square.width - square.height)).toBeLessThan(2);
  await page.getByLabel("Crop style").selectOption("size");
  await page.getByLabel("Crop fixed width").fill("200");
  await page.getByLabel("Crop fixed height").fill("100");
  await expect(page.locator(".edit-image-crop-handle")).toHaveCount(0);
  const fixed = await page.locator(".edit-image-crop-box").boundingBox();
  expect(fixed.width / fixed.height).toBeCloseTo(2, 1);
  expect(errors).toEqual([]);
});

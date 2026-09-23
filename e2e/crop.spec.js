import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { openFixture } from "./helpers.mjs";

test("yellow crop box resizes freely on each axis and restores freeform undo", async ({ page }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "crop-source", type: "image", x: 30, y: 30, data: { title: "Crop source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: 0.8 }
  })));
  const { errors } = await openFixture(page, { count: 1 });
  let savedSize;
  await page.route("**/api/node/upload-asset", async (route) => {
    const request = route.request();
    const form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    savedSize = await sharp(Buffer.from(await form.get("asset").arrayBuffer())).metadata();
    await route.fulfill({ json: { asset: { localUrl: "/outputs/e2e/cropped.png", fileName: "cropped.png", mimeType: "image/png", mediaType: "image" } } });
  });
  await page.locator('[data-node-card-id="crop-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Crop image", exact: true }).click();
  const box = page.locator(".output-crop-box");
  await expect(box.locator(".output-crop-handle")).toHaveCount(8);
  const read = () => box.evaluate((element) => Object.fromEntries(["left", "top", "width", "height"].map((key) => [key, parseFloat(element.style[key])])));
  async function drag(handle, x, y) {
    const bounds = await box.locator(`.output-crop-handle-${handle}`).boundingBox();
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + x, bounds.y + bounds.height / 2 + y, { steps: 8 });
    await page.mouse.up();
  }
  const initial = await read();
  await drag("e", -120, -35);
  const narrow = await read();
  expect(narrow.width).toBeLessThan(initial.width);
  expect(narrow.height).toBe(initial.height);
  await drag("s", 35, -90);
  const short = await read();
  expect(short.height).toBeLessThan(narrow.height);
  expect(short.width).toBe(narrow.width);
  await drag("nw", 40, 25);
  const corner = await read();
  expect(corner.left).toBeGreaterThan(short.left);
  expect(corner.top).toBeGreaterThan(short.top);
  expect(corner.left + corner.width).toBeCloseTo(short.left + short.width, 5);
  expect(corner.top + corner.height).toBeCloseTo(short.top + short.height, 5);
  await page.keyboard.press("Control+z");
  await expect.poll(read).toEqual(short);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(read).toEqual(corner);
  await page.screenshot({ path: testInfo.outputPath("freeform-crop.png") });
  await page.getByRole("button", { name: "Apply crop", exact: true }).click();
  await expect.poll(() => savedSize?.width).toBe(Math.round(corner.width / 100 * 640));
  expect(savedSize.height).toBe(Math.round(corner.height / 100 * 360));
  await expect(box).toHaveCount(0);
  expect(errors).toEqual([]);
});

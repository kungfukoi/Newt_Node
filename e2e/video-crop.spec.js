import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("video crop can enlarge, resize, move, seek and persist", async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [
      { id: "source", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/motion.mp4", status: "complete" } },
      { id: "crop", type: "edit", x: 550, y: 20, data: { editSourceType: "video", editEffect: "crop", settingsOpen: true, editSettings: { cropX: 10, cropY: 10, cropWidth: 70, cropHeight: 70 } } }
    ], edges: [{ id: "edge", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "crop", port: "videoIn" } }], groups: [], viewport: { x: 10, y: 10, scale: 0.8 }
  })); });
  const { errors } = await openFixture(page, { count: 2 });
  await page.getByRole("button", { name: "Enlarge video crop" }).click();
  const dialog = page.getByRole("dialog", { name: "Video crop", exact: true });
  await expect(dialog).toBeVisible();
  const stage = await dialog.locator(".video-crop-stage").boundingBox();
  expect(stage.width).toBeGreaterThan(600);
  await dialog.getByLabel("Crop width percent").fill("50");
  const handle = await dialog.getByLabel("Resize crop se").boundingBox();
  await page.mouse.move(handle.x + 5, handle.y + 5); await page.mouse.down();
  await page.mouse.move(handle.x - 40, handle.y - 20); await page.mouse.up();
  expect(Number(await dialog.getByLabel("Crop width percent").inputValue())).toBeLessThan(50);
  const region = await dialog.getByLabel("Video crop region", { exact: true }).boundingBox();
  await page.mouse.move(region.x + region.width / 2, region.y + region.height / 2); await page.mouse.down();
  await page.mouse.move(region.x + region.width / 2 + 40, region.y + region.height / 2); await page.mouse.up();
  expect(Number(await dialog.getByLabel("Crop left percent").inputValue())).toBeGreaterThan(10);
  await dialog.getByLabel("Crop style").selectOption("ratio");
  await dialog.getByLabel("Crop fixed width").fill("1");
  await dialog.getByLabel("Crop fixed height").fill("1");
  const square = await dialog.getByLabel("Video crop region", { exact: true }).boundingBox();
  expect(Math.abs(square.width - square.height)).toBeLessThan(2);
  await dialog.getByLabel("Crop style").selectOption("size");
  await dialog.getByLabel("Crop fixed width").fill("320");
  await dialog.getByLabel("Crop fixed height").fill("180");
  await expect(dialog.getByLabel("Resize crop se")).toHaveCount(0);
  await expect(dialog.getByLabel("Crop width percent")).toBeDisabled();
  await dialog.getByLabel("Video crop frame").fill("500");
  await dialog.getByRole("button", { name: "Done", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(1000);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(page.getByLabel("Crop width percent")).not.toHaveValue("70");
  await expect(page.getByLabel("Crop style")).toHaveValue("size");
  await expect(page.getByLabel("Crop fixed width")).toHaveValue("320");
  expect(errors).toEqual([]);
});

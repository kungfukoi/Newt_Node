import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("widening the Timeline bin adds columns without scaling thumbnails", async ({ page }) => {
  const { errors } = await openFixture(page, { timeline: true, scale: .8 });
  const bin = page.getByLabel("Timeline media bin", { exact: true });
  for (const name of ["second", "third", "fourth"]) {
    await bin.evaluate((target, name) => {
      const transfer = new DataTransfer();
      transfer.setData("application/x-newtnode-output", JSON.stringify({ url: `/outputs/e2e/${name}.mp4`, type: "video", label: name, width: 640, height: 360 }));
      target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }));
    }, name);
  }
  const items = bin.locator(".assembly-media-bin-item");
  await expect(items).toHaveCount(4);
  const sizes = () => items.evaluateAll(elements => elements.map(element => ({
    width: element.offsetWidth,
    height: element.querySelector(".assembly-media-bin-thumb").offsetHeight,
    x: element.offsetLeft,
    y: element.offsetTop
  })));
  const before = await sizes();
  expect(new Set(before.map(item => item.x)).size).toBe(1);
  const divider = bin.getByRole("separator", { name: "Media bin width" });
  const handle = await divider.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 160, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => new Set((await sizes()).map(item => item.x)).size).toBe(2);
  const twoColumns = await sizes();
  expect(twoColumns.map(({ width, height }) => ({ width, height }))).toEqual(before.map(({ width, height }) => ({ width, height })));
  expect(twoColumns[0].y).toBe(twoColumns[1].y);
  await divider.focus();
  await divider.press("End");
  await expect.poll(async () => new Set((await sizes()).map(item => item.x)).size).toBe(3);
  expect((await sizes()).map(({ width, height }) => ({ width, height }))).toEqual(before.map(({ width, height }) => ({ width, height })));
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect.poll(async () => new Set((await sizes()).map(item => item.x)).size).toBe(3);
  expect(errors).toEqual([]);
});

import { expect, test } from "@playwright/test";
import { canvasFixture } from "./fixtures.mjs";
import { openFixture } from "./helpers.mjs";

test("Timeline Motion supports fine drags, one-step undo, and exact numeric entry", async ({ page }) => {
  const fixture = canvasFixture({ timeline: true, scale: 0.8 });
  fixture.nodes.find(node => node.id === "timeline").data.assembly.selectedClipId = "clip";
  const { errors } = await openFixture(page, { fixture });
  const timeline = page.locator('[data-node-card-id="timeline"] .assembly-node-body');
  const position = timeline.getByRole("spinbutton", { name: "Position X", exact: true });
  const handle = timeline.locator(".assembly-motion-control label").filter({ hasText: "Position X" });
  await handle.scrollIntoViewIfNeeded();
  const { x, y, width, height } = await handle.boundingBox();
  const startX = Math.round(x + width / 2);
  const startY = Math.round(y + height / 2);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 20, startY, { steps: 4 });
  await expect(position).toHaveValue("20");
  await page.keyboard.down("Shift");
  await page.mouse.move(startX + 40, startY, { steps: 4 });
  await page.keyboard.up("Shift");
  await expect(position).toHaveValue("22");
  await page.mouse.up();

  await timeline.press("Control+z");
  await expect(position).toHaveValue("0");
  await position.fill("12.35");
  await position.press("Enter");
  await expect(position).toHaveValue("12.35");
  await position.fill("99");
  await position.press("Escape");
  await expect(position).toHaveValue("12.35");
  expect(errors).toEqual([]);
});

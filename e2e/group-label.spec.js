import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

for (const scale of [0.05, 0.08, 0.15, 0.3, 1]) {
  test(`group name repeats inside the group at ${scale * 100}% zoom`, async ({ page }) => {
    const { errors } = await openFixture(page, { scale, group: true });
    const label = page.locator(".group-canvas-name");
    await expect(label).toHaveText("Resizable group");
    await expect(label).toHaveCSS("font-size", "64px");
    const groupBounds = await page.locator(".node-group-backdrop").boundingBox();
    const labelBounds = await label.boundingBox();
    expect(labelBounds.x).toBeGreaterThan(groupBounds.x);
    expect(labelBounds.y).toBeGreaterThan(groupBounds.y);
    await page.getByRole("textbox", { name: "Group name", exact: true }).fill("Lighting setup");
    await expect(label).toHaveText("Lighting setup");
    await expect(page.locator(".group-label-size")).not.toContainText("Label size");
    // The fixture header can sit above the viewport at low zoom; use keyboard activation.
    await page.getByRole("button", { name: "Decrease group label size", exact: true }).press("Enter");
    await expect(label).toHaveCSS("font-size", "56px");
    for (let step = 0; step < 13; step += 1) {
      await page.getByRole("button", { name: "Increase group label size", exact: true }).press("Enter");
    }
    await expect(label).toHaveCSS("font-size", "160px");
    await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.groups?.[0]?.labelFontSize)).toBe(160);
    await page.reload();
    await page.getByRole("button", { name: "Nodes", exact: true }).click();
    await expect(label).toHaveText("Lighting setup");
    await expect(label).toHaveCSS("font-size", "160px");
    expect(errors).toEqual([]);
  });
}

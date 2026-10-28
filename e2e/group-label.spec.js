import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { canvasFixture } from "./fixtures.mjs";

for (const scale of [0.05, 0.08, 0.3, 1]) {
  test(`double-clicking a group shows the selection menu at ${scale * 100}% zoom`, async ({ page }) => {
    const fixture = canvasFixture({ count: 3, scale, group: true });
    fixture.nodes = fixture.nodes.map((node, index) => ({
      ...node, type: "plainText", x: index === 2 ? 1400 : 90 + index * 420, y: 180
    }));
    fixture.groups[0] = { ...fixture.groups[0], y: 100, height: 650, nodeIds: ["fixture-0", "fixture-1"] };
    const { errors } = await openFixture(page, { fixture });
    const group = page.locator(".node-group-backdrop");
    const header = group.locator(".group-header");
    const originalPosition = await header.boundingBox();
    const bounds = await group.boundingBox();
    const background = { x: bounds.width * 0.8, y: bounds.height * 0.9 };
    const selection = page.locator(".selection-action-bar");
    const selectedIds = () => page.locator(".react-flow__node.selected").evaluateAll(nodes => nodes.map(node => node.dataset.id).sort());

    // The field and frame must expose the same selection and existing actions.
    await group.dblclick({ position: { x: 2, y: bounds.height * 0.6 } });
    await expect(selection).toBeVisible();
    await expect.poll(selectedIds).toEqual(["fixture-0", "fixture-1"]);
    const frameActions = await selection.getByRole("button").allTextContents();
    await group.click({ position: background });
    await expect(selection).toHaveCount(0);
    await group.dblclick({ position: background });
    await expect(selection).toBeVisible();
    await expect.poll(selectedIds).toEqual(["fixture-0", "fixture-1"]);
    await expect(selection.getByRole("button", { name: "Run All" })).toBeVisible();
    await expect(selection.getByRole("button", { name: "Group", exact: true })).toBeEnabled();
    expect(await selection.getByRole("button").allTextContents()).toEqual(frameActions);
    expect(await header.boundingBox()).toEqual(originalPosition);
    expect(await group.boundingBox()).toEqual(bounds);
    await header.getByRole("textbox", { name: "Group name", exact: true }).fill("Stationary header");
    await expect(group.locator(".group-canvas-name")).toHaveText("Stationary header");
    expect(await header.boundingBox()).toEqual(originalPosition);
    expect(errors).toEqual([]);
  });
}

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

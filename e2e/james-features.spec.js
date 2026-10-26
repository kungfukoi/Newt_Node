import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { canvasFixture } from "./fixtures.mjs";

async function openCanvasPreferences(page) {
  await page.getByLabel("Workspace mode").getByRole("button", { name: "Settings", exact: true }).click();
  const section = page.getByRole("button", { name: /User Preferences/ });
  await expect(section).toBeVisible();
  if (await section.getAttribute("aria-expanded") !== "true") await section.click();
}

test("fresh window restores the workspace and draft; reload retains its own edits", async ({ page }) => {
  const draft = canvasFixture({ count: 3, scale: .3 });
  const { errors } = await openFixture(page, { count: 3, restoreWorkspace: true, uiState: { workspaceMode: "nodes", nodePaletteCollapsed: false, draft } });
  await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText("30%");
  await page.getByLabel("Workspace mode").getByRole("button", { name: "Video", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Workspace mode").getByRole("button", { name: "Video", exact: true })).toHaveClass(/active/);
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("canvas interaction preferences persist and recovery failure is visible", async ({ page }) => {
  await openFixture(page, { count: 3 });
  await expect(page.getByText("Canvas options", { exact: true })).toHaveCount(0);
  await openCanvasPreferences(page);
  await page.getByLabel("Mouse wheel behavior").selectOption("pan");
  await page.getByText("Hover to scrub videos", { exact: true }).click();
  await page.getByText("Smooth canvas motion", { exact: true }).click();
  await page.reload();
  await openCanvasPreferences(page);
  await expect(page.getByLabel("Mouse wheel behavior")).toHaveValue("pan");
  await expect(page.getByLabel("Hover to scrub videos")).not.toBeChecked();
  await expect(page.getByLabel("Smooth canvas motion")).not.toBeChecked();
  await page.route("**/api/ui-state", route => route.fulfill({ status: 500, json: { error: "Disk full" } }));
  await page.getByRole("button", { name: "Video", exact: true }).click();
  await expect(page.getByRole("button", { name: "Retry recovery save" })).toBeVisible();
});

test("paused node video scrubs on hover and can be disabled", async ({ page }) => {
  await openFixture(page, { count: 2, scale: 1 });
  const video = page.locator('[data-node-card-id="fixture-1"] video').first();
  await expect.poll(() => video.evaluate(v => v.readyState)).toBeGreaterThan(0);
  const rect = await video.boundingBox();
  await page.mouse.move(rect.x + rect.width * .7, rect.y + 12);
  await expect.poll(() => video.evaluate(v => v.currentTime)).toBeGreaterThan(.8);
  await openCanvasPreferences(page);
  await page.getByText("Hover to scrub videos", { exact: true }).click();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  const time = await video.evaluate(v => v.currentTime);
  await page.mouse.move(rect.x + rect.width * .1, rect.y + 12);
  expect(await video.evaluate(v => v.currentTime)).toBeCloseTo(time, 1);
});

test("clicking a wire selects it for deletion", async ({ page }) => {
  await openFixture(page, { count: 6, scale: .7 });
  const edge = page.locator(".newt-flow-edge-visible").first();
  const before = await page.locator(".newt-flow-edge-visible").count();
  const point = await edge.evaluate(el => { const p = el.getPointAtLength(el.getTotalLength() / 2).matrixTransform(el.getScreenCTM()); return { x: p.x, y: p.y }; });
  await page.mouse.click(point.x, point.y);
  await expect(page.locator(".react-flow__edge.selected")).toHaveCount(1);
  await page.keyboard.press("Delete");
  await expect(page.locator(".newt-flow-edge-visible")).toHaveCount(before - 1);
});

test("reload button detects a newly built frontend", async ({ page }) => {
  await openFixture(page, { count: 2 });
  await page.route(/\/$/, route => route.fulfill({ contentType: "text/html", body: '<script src="/assets/index-new-build.js"></script>' }));
  await expect(page.getByRole("button", { name: "Update ready, reload" })).toBeVisible({ timeout: 12000 });
});

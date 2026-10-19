import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("native clipboard transfers a connected selection to another workflow over stale local storage", async ({ page, context }) => {
  const source = await openFixture(page, { count: 3, scale: 0.6 });
  await page.locator('[data-node-card-id="fixture-1"] .node-title').click();
  await page.locator('[data-node-card-id="fixture-2"] .node-title').click({ modifiers: ["Shift"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  const text = await page.evaluate(() => {
    const data = new DataTransfer();
    window.dispatchEvent(new ClipboardEvent("copy", { clipboardData: data, cancelable: true }));
    return data.getData("text/plain");
  });
  expect(text).toContain("NEWTNODE_WORKFLOW_NODES:");
  const destination = await context.newPage();
  const target = await openFixture(destination, { count: 1, scale: 0.6 });
  await destination.evaluate((text) => {
    // A different origin/window may retain an older clipboard and deny readText.
    const stale = JSON.parse(text.slice(text.indexOf(":") + 1));
    stale.nodes = [{ id: "stale", type: "plainText", data: { title: "Stale" } }];
    localStorage.setItem("newtnode:workflow-node-clipboard:v1", `NEWTNODE_WORKFLOW_NODES:${JSON.stringify(stale)}`);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { readText: async () => { throw new Error("denied"); } } });
    const data = new DataTransfer();
    data.setData("text/plain", text);
    window.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, cancelable: true }));
  }, text);
  await expect(destination.locator(".react-flow__node")).toHaveCount(3);
  await expect(destination.locator(".react-flow__node.selected")).toHaveCount(2);
  await expect(destination.locator(".newt-flow-edge-visible")).toHaveCount(1);
  await expect(destination.locator(".node-title").filter({ hasText: "Stale" })).toHaveCount(0);
  await destination.keyboard.press("ControlOrMeta+z");
  await expect(destination.locator(".react-flow__node")).toHaveCount(1);
  expect([...source.errors, ...target.errors]).toEqual([]);
});

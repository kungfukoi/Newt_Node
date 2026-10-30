import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("saved groups load and remain usable without an update loop", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 4, group: true, scale: 0.7 });
  await expect(page.getByText("Nodes failed to load.", { exact: true })).toHaveCount(0);
  await expect(page.locator("[data-node-card-id]")).toHaveCount(4);
  await page.getByRole("button", { name: "Add canvas", exact: true }).click();
  await expect(page.locator("[data-node-card-id]")).toHaveCount(0);
  await page.getByRole("tab", { name: "Canvas 1", exact: true }).click();
  await expect(page.locator("[data-node-card-id]")).toHaveCount(4);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(page.locator("[data-node-card-id]")).toHaveCount(4);
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Settings usage filters, historical models, empty states and retry are usable", async ({ page }, testInfo) => {
  const { errors, requests } = await openFixture(page);
  const at = new Date().toISOString();
  let unavailable = false;
  await page.route("**/api/feature-usage", route => unavailable
    ? route.fulfill({ status: 503, json: { error: "Usage temporarily unavailable" } })
    : route.fulfill({ json: { startedAt: at, days: [
      { type: "imageModel", action: "run", count: 99, lastUsed: at },
      { type: "videoModel", action: "run", count: 1, lastUsed: at },
      { type: "preview", action: "add", count: 4, lastUsed: at }
    ] } }));
  await page.route("**/api/stats/local", route => route.fulfill({ json: { history: [
    { id: "one", generationRunId: "same", provider: "fal", modelName: "Historical model", createdAt: at },
    { id: "two", generationRunId: "same", provider: "fal", modelName: "Historical model", createdAt: at }
  ] } }));
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Feature Usage", exact: true }).click();
  const panel = page.locator(".feature-usage");
  await expect(panel.getByText("100 node run attempts", { exact: true })).toBeVisible();
  await panel.getByLabel("Usage signal", { exact: true }).selectOption("Niche");
  await expect(panel.locator("tbody tr")).toHaveCount(1);
  await expect(panel.locator("tbody tr")).toContainText("Video Model");
  await expect(panel.locator("tbody tr")).toContainText("1.0%");
  await panel.getByLabel("Usage signal", { exact: true }).selectOption("");
  await panel.getByLabel("Measure", { exact: true }).selectOption("add");
  await expect(panel.getByText("4 palette additions", { exact: true })).toBeVisible();
  await panel.getByLabel("Measure", { exact: true }).selectOption("model");
  await expect(panel.getByText("1 recorded model operations", { exact: true })).toBeVisible();
  await panel.getByLabel("Find feature").fill("Historical model");
  await expect(panel.locator("tbody tr")).toHaveCount(1);
  await panel.getByLabel("Find feature").fill("no matching feature");
  await expect(panel.getByText("No features match these filters.")).toBeVisible();
  await panel.getByLabel("Find feature").fill("");
  await panel.getByLabel("Usage period").selectOption("all");
  await page.setViewportSize({ width: 650, height: 900 });
  await page.screenshot({ path: testInfo.outputPath("feature-usage-narrow.png"), fullPage: true });
  unavailable = true;
  await panel.getByLabel("Measure", { exact: true }).selectOption("run");
  await panel.getByRole("button", { name: "Refresh usage" }).click();
  await expect(panel.getByRole("alert")).toContainText("Usage temporarily unavailable");
  await expect(panel.locator("table")).toHaveCount(0);
  unavailable = false;
  await panel.getByRole("button", { name: "Refresh usage" }).click();
  await expect(panel.getByText("100 node run attempts", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
  expect(requests.filter(row => row.method === "POST" && row.path.includes("generate"))).toHaveLength(0);
});

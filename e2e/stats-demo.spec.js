import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { fixtureProjectId } from "./fixtures.mjs";
import { existsSync } from "node:fs";

test("synthetic preview exercises populated stats without any API or persistence calls", async ({ page }, testInfo) => {
  test.skip(!existsSync(new URL("../dist/stats-demo.html", import.meta.url)), "Build with NEWTNODE_STATS_DEMO=1 to include the explicit fixture preview.");
  const apiRequests = [], errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/")) { apiRequests.push(url.pathname); return route.abort(); }
    return url.hostname === "127.0.0.1" ? route.continue() : route.abort();
  });
  await page.goto("/stats-demo.html");
  await expect(page.getByLabel("Synthetic demo notice")).toContainText("every amount below is fabricated");
  await expect(page.locator(".analytics-ledger tbody tr")).toHaveCount(7);
  await page.getByLabel("Date range", { exact: true }).selectOption("5");
  await page.getByLabel("Provider", { exact: true }).selectOption("atlas");
  await expect(page.locator(".analytics-ledger tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Reset all filters", exact: true }).first().click();
  await page.getByRole("button", { name: "Simulate demo outage" }).click();
  await page.getByRole("button", { name: "Refresh records", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("stale");
  await page.getByRole("button", { name: "Restore demo connection" }).click();
  await page.getByRole("button", { name: "Retry local records" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Global", exact: true }).click();
  await page.getByRole("button", { name: "Apply & query providers" }).click();
  await expect(page.getByText("$80.00", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Synthetic demo notice")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("stats-synthetic-demo.png"), fullPage: true });
  expect(apiRequests).toEqual([]); expect(errors).toEqual([]);
  expect(await page.evaluate(() => Object.keys(localStorage).length + Object.keys(sessionStorage).length)).toBe(0);
});

test("ordinary non-package rename preserves workflow ID; explicit Save As creates a new identity", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 2 }); const saves = [];
  await page.route("**/api/saved-workflows", async route => {
    if (route.request().method() !== "POST") return route.fulfill({ json: [] });
    const data = route.request().postDataJSON(); saves.push(data);
    return route.fulfill({ json: { id: data.id || "new-copy", name: data.name, fileName: `${data.name}.json` } });
  });
  if (!await page.getByPlaceholder("Project name", { exact: true }).isVisible()) await page.getByTitle("Show node palette", { exact: true }).click();
  await page.getByPlaceholder("Project name", { exact: true }).fill("Renamed workflow");
  await page.getByTitle("File", { exact: true }).click(); await page.getByTitle("Save project", { exact: true }).click();
  await expect.poll(() => saves.length).toBe(1); expect(saves[0].id).toBe(fixtureProjectId);
  await page.getByTitle("File", { exact: true }).click(); await page.getByRole("button", { name: "Save As", exact: true }).click();
  await expect.poll(() => saves.length).toBe(2); expect(saves[1].id).toBe(null); expect(saves[1].sourceWorkflowId).toBe(fixtureProjectId);
  expect(errors).toEqual([]);
});

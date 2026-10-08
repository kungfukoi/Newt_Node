import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
const fingerprint = "a".repeat(64);
const record = (id, day, amountUsd, extra = {}) => ({ id, createdAt: `2026-10-${String(day).padStart(2, "0")}T10:00:00Z`, provider: "Atlas Cloud", modelName: "Seedance 2.5", mediaType: "video", generationRunId: `job-${id}`, project: { id: "workflow-a", name: "Summer film", fileName: "Summer.json" }, keyIdentity: { fingerprint }, cost: { amountUsd, currency: "USD", estimated: true, pricingBasis: "Saved provider-specific estimate" }, ...extra });
const history = [record("a", 8, 3), record("b", 7, 2, { provider: "fal.ai", modelName: "Nano Banana 2", mediaType: "image", cost: { amountUsd: 2, estimated: false } }), record("c", 3, null), record("d", 8, .000005, { project: { id: "workflow-b", name: "Summer film", fileName: "Other.json" }, provider: "Krea", modelName: "MiniMax H3" })];
const snapshot = { history, fetchedAt: "2026-10-08T12:00:00Z", coverage: { trackingStartedAt: "2026-10-08T00:00:00Z", note: "This installation only; earlier evicted history and other machines are excluded." }, capabilities: [{ provider: "atlas", note: "Account billing requires billing-read permission", docs: "https://www.atlascloud.ai/docs/public-api" }, { provider: "krea", note: "No public API balance endpoint", docs: "https://www.krea.ai/docs/developers/api-keys-and-billing" }] };
async function openStats(page) {
  await page.clock.install({ time: new Date("2026-10-08T12:00:00Z") });
  const fixture = await openFixture(page);
  await page.route("**/api/stats/local", route => route.fulfill({ json: snapshot }));
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Spend & usage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run ledger" })).toBeVisible();
  return fixture;
}
test("local ledger combines filters, resets, dates, drill-down and repeated navigation", async ({ page }, testInfo) => {
  const { errors, requests } = await openStats(page);
  const ledger = page.locator(".analytics-ledger");
  await expect(ledger.locator("tbody tr")).toHaveCount(4);
  await page.getByLabel("Date range", { exact: true }).selectOption("5"); await expect(ledger.locator("tbody tr")).toHaveCount(3);
  await page.getByLabel("Workflow / JSON file", { exact: true }).selectOption("workflow-a");
  await page.getByLabel("Provider", { exact: true }).selectOption("atlas");
  await page.getByLabel("Model", { exact: true }).selectOption("Seedance 2.5");
  await page.getByLabel("API-key identity", { exact: true }).selectOption(`atlas:${fingerprint}`);
  await page.getByLabel("Find run / job / JSON file").fill("job-a");
  await expect(ledger.locator("tbody tr")).toHaveCount(1);
  await ledger.locator("summary").click(); await expect(ledger.getByText("Saved provider-specific estimate")).toBeVisible();
  await expect(page.getByText(/5 additional filters; 1 matching records/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("stats-combined-filters.png"), fullPage: true });
  await page.getByLabel("Find run / job / JSON file").fill("missing-run"); await expect(page.getByRole("heading", { name: "No runs match this view" })).toBeVisible();
  await page.getByRole("button", { name: "Reset all filters", exact: true }).first().click(); await expect(ledger.locator("tbody tr")).toHaveCount(4);
  await page.getByLabel("Date range", { exact: true }).selectOption("custom");
  await page.getByLabel("Start date", { exact: true }).fill("2026-10-08"); await page.getByLabel("End date (inclusive)").fill("2026-10-08"); await expect(ledger.locator("tbody tr")).toHaveCount(2);
  await page.getByLabel("Start date", { exact: true }).fill("2026-10-09"); await expect(page.getByText(/Choose a valid start/)).toBeVisible();
  await page.getByRole("button", { name: "Reset all filters", exact: true }).first().click();
  await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.locator(".analytics-ranked button").first().click(); await expect(ledger.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Reset all filters", exact: true }).first().click();
  await page.screenshot({ path: testInfo.outputPath("stats-local-overview.png"), fullPage: true });
  for (let index = 0; index < 3; index++) { await page.getByRole("button", { name: "Settings", exact: true }).click(); await page.getByRole("button", { name: "Stats", exact: true }).click(); await expect(ledger.locator("tbody tr")).toHaveCount(4); }
  expect(errors).toEqual([]); expect(requests.filter(row => row.method === "POST" && row.path.includes("generate"))).toHaveLength(0);
});
test("loading and errors preserve previous totals and recover without navigation", async ({ page }, testInfo) => {
  await openStats(page);
  await page.route("**/api/stats/local", route => route.fulfill({ status: 503, json: { error: "Offline" } }));
  await page.getByRole("button", { name: "Refresh records", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("stale");
  await expect(page.locator(".analytics-ledger tbody tr")).toHaveCount(4);
  await page.screenshot({ path: testInfo.outputPath("stats-stale-error.png"), fullPage: true });
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  await page.route("**/api/stats/local", async route => { await wait; await route.fulfill({ json: snapshot }); });
  await page.getByRole("button", { name: "Retry local records" }).click(); await expect(page.getByRole("button", { name: "Refresh records" })).toBeDisabled();
  release(); await expect(page.getByRole("alert")).toHaveCount(0);
});
test("Global queries only on demand, ignores local workflow filters, labels balances and unsupported providers", async ({ page }, testInfo) => {
  const { errors } = await openStats(page); let queries = 0, received;
  await page.route("**/api/stats/accounts?**", route => {
    queries++; received = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { query: Object.fromEntries(received), fetchedAt: "2026-10-08T12:00:00Z", providers: [
      { provider: "atlas", scope: "account / self", note: "Account totals include other machines and apps", fetchedAt: "2026-10-08T12:00:00Z", spend: { status: "ready", amount: 10, scope: "account", rows: [{ date: "2026-10-08", amount: 10, model: "provider/model", key: "ak_public", partial: true, coveredUntil: "2026-10-08T11:00:00Z" }] }, balance: { status: "ready", amount: 80, unit: "USD", scope: "account" } },
      { provider: "fal", scope: "workspace", note: "Admin-scope key required", spend: { status: "permission-required", amount: null, rows: [], message: "Billing permission required" }, balance: { status: "permission-required", amount: null } },
      { provider: "krea", scope: "workspace API", note: "No public API balance endpoint", spend: { status: "unsupported", amount: null, rows: [] }, balance: { status: "unsupported", amount: null } }
    ] } });
  });
  await page.getByLabel("Workflow / JSON file", { exact: true }).selectOption("workflow-b");
  await page.getByRole("button", { name: "Global", exact: true }).click(); expect(queries).toBe(0);
  await expect(page.getByText(/local run search and local hashed key filters are paused/)).toBeVisible();
  await page.getByRole("button", { name: "Apply & query providers" }).click(); await expect(page.getByText("$80.00", { exact: true })).toBeVisible();
  expect(received.has("workflow")).toBe(false); await expect(page.getByText("permission-required", { exact: true })).toHaveCount(2);
  await page.getByText("Daily provider costs · 1 buckets", { exact: true }).click(); await expect(page.getByText("ak_public", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("stats-global-coverage.png"), fullPage: true });
  await page.getByLabel("Provider", { exact: true }).selectOption("atlas"); await expect(page.getByRole("heading", { name: /Filters changed/ })).toBeVisible(); await expect(page.getByText("$80.00", { exact: true })).toHaveCount(0);
  await page.getByLabel("Public provider key ID").fill("ak_public"); await page.getByRole("button", { name: "Query providers", exact: true }).click(); await expect(page.getByText("$80.00", { exact: true })).toBeVisible(); expect(received.get("key")).toBe("ak_public");
  await page.getByRole("button", { name: "Local", exact: true }).click(); await expect(page.getByLabel("Workflow / JSON file", { exact: true })).toHaveValue("workflow-b"); expect(errors).toEqual([]);
});
test("responsive layout and empty records remain usable", async ({ page }, testInfo) => {
  await openStats(page); await page.setViewportSize({ width: 720, height: 1000 });
  await expect(page.getByRole("button", { name: "Reset all filters", exact: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("stats-narrow.png"), fullPage: true });
  await page.route("**/api/stats/local", route => route.fulfill({ json: { ...snapshot, history: [] } }));
  await page.getByRole("button", { name: "Refresh records" }).click(); await expect(page.getByRole("heading", { name: "Your first recorded run starts the story" })).toBeVisible();
  await expect(page.locator(".analytics-metrics").getByText("Unavailable", { exact: true })).toHaveCount(2);
});

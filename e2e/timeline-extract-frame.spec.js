import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Timeline extracts the clicked playhead into a persistent still and reports extraction errors", async ({ page }, testInfo) => {
  const { errors } = await openFixture(page, { timeline: true, scale: 0.8 });
  const requests = [];
  let finish;
  await page.route("**/api/node/assembly-render", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await new Promise(resolve => { finish = resolve; });
      await route.fulfill({ json: { image: { localUrl: "/outputs/e2e/extracted.png", fileName: "extracted.png", mimeType: "image/png", label: "Timeline still" } } });
    } else await route.fulfill({ status: 500, json: { error: "Source image is unavailable" } });
  });
  const card = page.locator('[data-node-card-id="timeline"]');
  const body = card.locator(".assembly-node-body");
  await body.focus();
  await body.press("ArrowRight");
  await body.press("ArrowRight");
  await card.getByRole("button", { name: "Extract Frame", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].frameTime).toBeCloseTo(2 / 24);
  expect(requests[0].assembly.outputWidth).toBe(640);
  await expect(card.getByRole("button", { name: "Extracting...", exact: true })).toBeDisabled();
  await body.focus();
  await body.press("ArrowRight");
  finish();
  const still = page.locator('[data-node-type="image"]');
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(page.locator('img[src*="extracted.png"]').first()).toBeVisible();
  await card.getByRole("button", { name: "Extract Frame", exact: true }).click();
  await expect(card.getByRole("alert")).toHaveText("Source image is unavailable");
  expect(requests[1].frameTime).toBeCloseTo(3 / 24);
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(page.locator('img[src*="extracted.png"]').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("timeline-extract-frame.png") });
  expect(errors).toEqual([]);
});

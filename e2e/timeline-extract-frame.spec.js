import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Timeline extracts the clicked playhead into the media bin and reports extraction errors", async ({ page }, testInfo) => {
  const { errors } = await openFixture(page, { timeline: true, scale: 0.8 });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { timelineExtractFrame: true } } }));
  const requests = [];
  let finish;
  await page.route("**/api/node/assembly-extract-frame", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) {
      await new Promise(resolve => { finish = resolve; });
      await route.fulfill({ json: { image: { localUrl: "/outputs/e2e/extracted.png", fileName: "extracted.png", mimeType: "image/png", label: "Timeline still" } } });
    } else await route.fulfill({ status: 500, json: { error: "Source image is unavailable" } });
  });
  const card = page.locator('[data-node-card-id="timeline"]');
  const body = card.locator(".assembly-node-body");
  await expect(card.getByLabel("Timeline frame number", { exact: true })).toHaveText("Frame 0");
  await body.focus();
  await body.press("ArrowRight");
  await body.press("ArrowRight");
  await expect(card.getByLabel("Timeline frame number", { exact: true })).toHaveText("Frame 2");
  await card.getByRole("button", { name: "Extract Frame", exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0].frameTime).toBeCloseTo(2 / 24);
  expect(requests[0].assembly.outputWidth).toBe(640);
  await expect(card.getByRole("button", { name: "Extracting...", exact: true })).toBeDisabled();
  await body.focus();
  await body.press("ArrowRight");
  await expect(card.getByLabel("Timeline frame number", { exact: true })).toHaveText("Frame 3");
  finish();
  const bin = card.locator(".assembly-media-bin-item");
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await expect(bin.first()).toContainText("Timeline still");
  await expect(bin.first().locator("img")).toHaveAttribute("src", /extracted.png/);
  await card.getByRole("button", { name: "Extract Frame", exact: true }).click();
  await expect(card.getByRole("alert")).toHaveText("Source image is unavailable");
  expect(requests[1].frameTime).toBeCloseTo(3 / 24);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
  await page.waitForTimeout(800);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(bin.first()).toContainText("Timeline still");
  await expect(bin.first().locator("img")).toHaveAttribute("src", /extracted.png/);
  await page.evaluate(() => {
    const source = document.querySelector('[data-node-card-id="timeline"] .assembly-media-bin-item');
    const target = document.querySelector('.react-flow__pane');
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer, clientX: 1300, clientY: 800 }));
    source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
  });
  await expect(page.locator('.react-flow__node')).toHaveCount(3);
  await expect(bin).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("timeline-extract-frame.png") });
  expect(errors).toEqual([]);
});

test("an older backend cannot turn frame extraction into a video render", async ({ page }) => {
  await openFixture(page, { timeline: true, scale: 0.8 });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: {} } }));
  let submissions = 0;
  await page.route("**/api/node/assembly-*", route => { submissions++; return route.fulfill({ json: { video: { localUrl: "/outputs/unwanted.mp4" } } }); });
  const card = page.locator('[data-node-card-id="timeline"]');
  await card.getByRole("button", { name: "Extract Frame", exact: true }).click();
  await expect(card.getByRole("alert")).toContainText("Restart NewtNode to activate Timeline frame extraction");
  expect(submissions).toBe(0);
  await expect(page.locator('.react-flow__node')).toHaveCount(2);
});

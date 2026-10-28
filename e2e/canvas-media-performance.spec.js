import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { outputDragMime } from "../src/mediaAssets.js";

for (const mode of ["on", "off"]) test(`canvas motion ${mode} draws on its first animation frame`, async ({ page }) => {
  await page.addInitScript(mode => localStorage.setItem("newt.canvasMotion", mode), mode);
  const { errors } = await openFixture(page, { count: 12, scale: .35 });
  await expect(page.getByRole("button", { name: "Reset zoom", exact: true })).toHaveText("35%");
  const frame = await page.evaluate(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = document.querySelector(".node-canvas"), viewport = canvas.querySelector(".react-flow__viewport"), rect = canvas.getBoundingClientRect();
    const before = viewport.style.transform;
    canvas.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 }));
    const first = await new Promise(resolve => requestAnimationFrame(() => resolve(viewport.style.transform)));
    return { before, first };
  });
  expect(frame.first).not.toBe(frame.before);
  expect(errors).toEqual([]);
});

test("video result galleries keep playback on the active viewer", async ({ page }, testInfo) => {
  // Representative saved video-result counts from a production-sized workflow.
  const resultCounts = [23, 17, 14, 4, 3];
  const nodes = [], edges = [];
  resultCounts.forEach((count, index) => {
    const id = `model-${index}`, viewer = `viewer-${index}`;
    nodes.push({ id, type: "videoModel", x: 20 + index * 800, y: 20, data: { title: `Video ${index}`, model: "Seedance 2.5", settingsOpen: false,
      resultUrl: `/outputs/e2e/clip-${index}-0.mp4`, resultType: "video", resultItems: Array.from({ length: count }, (_, item) => ({ url: `/outputs/e2e/clip-${index}-${item}.mp4`, type: "video", label: `Clip ${item}` })) } });
    nodes.push({ id: viewer, type: "preview", x: 20 + index * 800, y: 420, data: { title: `Viewer ${index}` } });
    edges.push({ id: `edge-${index}`, from: { nodeId: id, port: "videoOut" }, to: { nodeId: viewer, port: "sourceIn" } });
  });
  await page.addInitScript(({ nodes, edges }) => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes, edges, groups: [], viewport: { x: 20, y: 20, scale: .35 } })), { nodes, edges });
  const { errors } = await openFixture(page, { count: nodes.length });
  await expect(page.locator(".preview-thumb-strip button")).toHaveCount(61);
  const counts = await page.evaluate(() => ({ videos: document.querySelectorAll(".node-canvas video").length,
    thumbnailVideos: document.querySelectorAll(".preview-thumb-strip video").length, thumbnailImages: document.querySelectorAll(".preview-thumb-strip img").length }));
  console.log("Gallery media elements", JSON.stringify(counts));
  await testInfo.attach("gallery-media-elements", { body: JSON.stringify(counts), contentType: "application/json" });
  expect(counts.videos).toBe(10);
  expect(counts.thumbnailVideos).toBe(0);
  expect(counts.thumbnailImages).toBe(61);
  const viewer = page.locator('[data-node-card-id="viewer-0"]');
  await viewer.getByRole("button", { name: "Select preview 2", exact: true }).click();
  await expect(viewer.locator(".preview-stage > video")).toHaveAttribute("src", /clip-0-1\.mp4/);
  const thumb = viewer.getByRole("button", { name: "Select preview 3", exact: true });
  const transfer = await page.evaluateHandle(() => new DataTransfer());
  await thumb.dispatchEvent("dragstart", { dataTransfer: transfer });
  const dragged = await transfer.evaluate((data, mime) => JSON.parse(data.getData(mime)), outputDragMime);
  expect(dragged.url).toBe("/outputs/e2e/clip-0-2.mp4"); expect(dragged.type).toBe("video");
  await thumb.dispatchEvent("dragend", { dataTransfer: transfer, clientX: -1, clientY: -1 });
  // Poster failure must remain a selector without allocating another player.
  await thumb.locator("img").dispatchEvent("error");
  await expect(thumb.locator("img")).toHaveCount(0);
  await expect(thumb.locator("video")).toHaveCount(0);
  await thumb.click();
  await expect(viewer.locator(".preview-stage > video")).toHaveAttribute("src", /clip-0-2\.mp4/);
  expect(errors).toEqual([]);
});

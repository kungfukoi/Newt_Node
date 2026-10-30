import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("outpaint selected view drives Preview, Output and download while preserving retained results and comparison time", async ({ page }) => {
  const details = index => ({ rawVideoUrl: `/outputs/e2e/raw-${index}.mp4`, prepared: { plan: { fps: 24, sourceFrameRate: "24/1", prerollFrames: 6 } }, matching: { finishVersion: 3 }, qc: { status: "off" } });
  const fixture = { nodes: [
    { id: "outpaint", type: "utility", x: 30, y: 20, data: { utilityMode: "video", utilityVideoModel: "Video Outpaint", status: "complete", resultUrl: "/outputs/e2e/composite-1.mp4", resultItems: [1, 2].map(index => ({ type: "video", url: `/outputs/e2e/composite-${index}.mp4`, videoOutpaint: details(index) })), selectedResultIndex: 0 } },
    { id: "output", type: "output", x: 550, y: 20, data: { outputPath: "C:/fixtures/outputs", outputFileName: "finished", outputVideoFormat: "source" } },
    { id: "preview", type: "preview", x: 950, y: 20, data: {} }
  ], edges: ["output", "preview"].map(id => ({ id, from: { nodeId: "outpaint", port: "videoOut" }, to: { nodeId: id, port: "sourceIn" } })), groups: [], viewport: { x: 10, y: 10, scale: 0.8 } };
  const { errors, requests } = await openFixture(page, { fixture });
  const node = page.locator('[data-node-card-id="outpaint"]');
  const toggle = node.getByLabel("Show composited source");
  const composite = node.getByLabel("Outpaint composite preview");
  const downstream = page.locator('[data-node-card-id="preview"] video').first();
  await expect(downstream).toHaveAttribute("src", /composite-1\.mp4/);
  await expect(toggle).toBeChecked();
  await expect.poll(() => composite.evaluate(video => video.readyState)).toBeGreaterThan(0);
  await composite.evaluate(video => { video.currentTime = 0.5; video.volume = 0.3; video.muted = true; video.dispatchEvent(new Event("timeupdate")); });
  await toggle.uncheck();
  const plate = node.getByLabel("Raw generated plate preview");
  await expect(plate).toHaveAttribute("src", /raw-1\.mp4/);
  await expect(downstream).toHaveAttribute("src", /raw-1\.mp4/);
  await expect.poll(() => plate.evaluate(video => video.currentTime)).toBeCloseTo(0.75, 1);
  expect(await plate.evaluate(video => video.muted)).toBe(true);
  expect(await plate.evaluate(video => video.volume)).toBeCloseTo(0.3);
  await toggle.check();
  await expect(composite).toHaveAttribute("src", /composite-1\.mp4/);
  await expect(downstream).toHaveAttribute("src", /composite-1\.mp4/);
  await expect.poll(() => composite.evaluate(video => video.currentTime)).toBeCloseTo(0.5, 1);
  await toggle.uncheck();
  await node.getByRole("button", { name: "Next generation" }).click();
  await expect(plate).toHaveAttribute("src", /raw-2\.mp4/);
  await expect(downstream).toHaveAttribute("src", /raw-2\.mp4/);
  const download = page.waitForEvent("download");
  await node.getByRole("button", { name: "Download result" }).click();
  expect((await download).suggestedFilename()).toBe("raw-2.mp4");
  const dragged = await node.getByRole("button", { name: "Drag video output" }).evaluate(handle => {
    const dataTransfer = new DataTransfer();
    handle.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer }));
    return Array.from(dataTransfer.types).map(type => dataTransfer.getData(type)).join(" ");
  });
  expect(dragged).toContain("/outputs/e2e/raw-2.mp4");
  const saved = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "outpaint").data);
  await expect.poll(async () => (await saved()).resultUrl).toBe("/outputs/e2e/composite-2.mp4");
  await expect.poll(async () => (await saved()).outpaintShowComposite).toBe(false);
  await page.locator('[data-node-card-id="preview"]').getByRole("button", { name: "Select preview 1", exact: true }).click();
  await expect(plate).toHaveAttribute("src", /raw-1\.mp4/);
  await expect.poll(async () => (await saved()).resultUrl).toBe("/outputs/e2e/composite-1.mp4");
  await page.locator('[data-node-card-id="preview"]').getByRole("button", { name: "Select preview 2", exact: true }).click();
  await expect.poll(async () => (await saved()).resultUrl).toBe("/outputs/e2e/composite-2.mp4");
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(toggle).not.toBeChecked();
  await expect(plate).toHaveAttribute("src", /raw-2\.mp4/);
  let save;
  await page.route("**/api/node/save-output", route => {
    save = route.request().postDataJSON();
    return route.fulfill({ json: { output: { localUrl: "/outputs/e2e/saved.mp4", fileName: "saved.mp4", mediaType: "video" } } });
  });
  await page.locator('[data-node-card-id="output"]').locator(".run-node-button").click();
  await expect.poll(() => save?.sourceUrl).toBe("/outputs/e2e/raw-2.mp4");
  expect(save.outputOriginalSourceUrl).toBe("");
  await toggle.check();
  await expect(downstream).toHaveAttribute("src", /composite-2\.mp4/);
  await page.locator('[data-node-card-id="output"]').locator(".run-node-button").click();
  await expect.poll(() => save?.sourceUrl).toBe("/outputs/e2e/composite-2.mp4");
  await expect.poll(async () => (await saved()).resultUrl).toBe("/outputs/e2e/composite-2.mp4");
  expect(requests.some(request => ["/api/node/generate-video", "/api/node/utility-video", "/api/node/video-outpaint-finish", "/api/node/video-outpaint-prepare"].includes(request.path))).toBe(false);
  expect(errors).toEqual([]);
});

test("crop-only or legacy results without a raw plate keep the standard result viewer", async ({ page }) => {
  const fixture = { nodes: [{ id: "outpaint", type: "utility", x: 30, y: 20, data: { utilityMode: "video", utilityVideoModel: "Video Outpaint", resultUrl: "/outputs/e2e/crop.mp4", resultItems: [{ type: "video", url: "/outputs/e2e/crop.mp4", videoOutpaint: { localCrop: true } }] } }], edges: [], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } };
  const { errors } = await openFixture(page, { fixture });
  const node = page.locator('[data-node-card-id="outpaint"]');
  await expect(node.getByLabel("Show composited source")).toHaveCount(0);
  await expect(node.locator(".result-pane video")).toHaveAttribute("src", /crop\.mp4/);
  expect(errors).toEqual([]);
});

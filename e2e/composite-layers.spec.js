import { test, expect } from "@playwright/test";
import { openFixture, wireAttachmentErrors } from "./helpers.mjs";
import sharp from "sharp";

test("Composite migrates shared inputs, manages layer dots, and saves independent masks and blends", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return;
    sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
      { id: "a", type: "image", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/landscape.png", status: "complete" } },
      { id: "b", type: "video", x: 20, y: 430, data: { resultUrl: "/outputs/e2e/motion.mp4", status: "complete" } },
      { id: "c", type: "utility", x: 550, y: 20, data: { title: "Composite", utilityMode: "video", utilityVideoModel: "Composite Video", compositeBlendMode: "screen", compositeMixAmount: 37, settingsOpen: false } }
    ], edges: [
      { id: "a-c", from: { nodeId: "a", port: "imageOut" }, to: { nodeId: "c", port: "referenceVideoIn" } },
      { id: "b-c", from: { nodeId: "b", port: "videoOut" }, to: { nodeId: "c", port: "referenceVideoIn" } },
      { id: "mask-c", from: { nodeId: "a", port: "imageOut" }, to: { nodeId: "c", port: "maskVideoIn" } }
    ], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } }));
  });
  const { errors } = await openFixture(page, { count: 3 });
  const composite = page.locator('[data-node-card-id="c"]');
  await expect(composite.locator('[data-port-role="input"]')).toHaveCount(4);
  const dotColor = (id) => composite.locator(`[data-port-id="${id}"]`).evaluate((element) => element.style.getPropertyValue("--port-color"));
  expect(await dotColor("referenceVideoIn")).toBe("#3d85ff");
  expect(await dotColor("compositeLayer:layer1")).toBe("#58ce63");
  expect(await dotColor("maskVideoIn")).toBe("#3d85ff");
  expect(await dotColor("compositeMask:base")).toBe("#8d8d8d");
  await expect(composite.getByLabel("Layer 1 blend method")).toHaveValue("screen");
  await expect(composite.getByLabel("Layer 1 opacity")).toHaveValue("37");
  await expect(composite.getByLabel("Invert layer 1 mask")).toBeVisible();
  const liveCanvas = composite.getByLabel("Live composite thumbnail");
  await expect.poll(() => liveCanvas.evaluate((canvas) => canvas.width)).toBe(320);
  const initialFrame = await liveCanvas.evaluate((canvas) => canvas.toDataURL());
  await composite.getByLabel("Composite preview time").focus();
  await page.keyboard.press("End");
  await expect.poll(() => liveCanvas.evaluate((canvas) => canvas.toDataURL())).not.toBe(initialFrame);
  await page.keyboard.press("Home");
  await composite.getByRole("button", { name: "Play composite preview" }).click();
  await expect.poll(async () => Number(await composite.getByLabel("Composite preview time").inputValue())).toBeGreaterThan(0.1);
  await composite.getByRole("button", { name: "Pause composite preview" }).click();
  await composite.getByLabel("Layer 0 blend method").selectOption("multiply");
  await composite.getByLabel("Invert layer 1 mask").check();
  await composite.getByRole("button", { name: "Add composite layer" }).click();
  await expect(composite.locator('[data-port-role="input"]')).toHaveCount(6);
  const addedPort = await composite.locator('[data-port-role="input"]').evaluateAll((ports) => ports.map((port) => port.dataset.portId).find((id) => id.startsWith("compositeLayer:layer_")));
  expect(await dotColor(addedPort)).toBe("#8d8d8d");
  const from = await page.locator('[data-port-key="a:imageOut"]').boundingBox();
  const to = await composite.locator(`[data-port-id="${addedPort}"]`).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
  await page.mouse.up();
  await expect(page.locator(".newt-flow-edge-visible")).toHaveCount(4);
  expect(await dotColor(addedPort)).toBe("#3d85ff");
  let submitted;
  await page.route("**/api/node/utility-video", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ modelName: "Composite Video", video: { localUrl: "/outputs/e2e/motion.mp4", fileName: "composite.mp4", mimeType: "video/mp4" }, cost: { amountUsd: 0 } }) });
  });
  await composite.locator(".run-node-button").click();
  await expect.poll(() => submitted?.compositeVideo?.layers.length).toBe(3);
  expect(submitted.compositeVideo.layers.map((layer) => layer.type)).toEqual(["image", "video", "image"]);
  expect(submitted.compositeVideo.layers[0].blendMode).toBe("multiply");
  expect(submitted.compositeVideo.layers[1].maskType).toBe("image");
  expect(submitted.compositeVideo.layers[1].invertMask).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("composite.png") });
  await composite.getByRole("button", { name: "Remove layer 2" }).click();
  await expect(composite.locator(`[data-port-id="${addedPort}"]`)).toHaveCount(0);
  await expect(page.locator(".newt-flow-edge-visible")).toHaveCount(3);
  const migrated = [
    { id: "a-c", from: { nodeId: "a", port: "imageOut" }, to: { nodeId: "c", port: "referenceVideoIn" } },
    { id: "b-c", from: { nodeId: "b", port: "videoOut" }, to: { nodeId: "c", port: "compositeLayer:layer1" } },
    { id: "mask-c", from: { nodeId: "a", port: "imageOut" }, to: { nodeId: "c", port: "maskVideoIn" } }
  ];
  await expect.poll(async () => (await wireAttachmentErrors(page, migrated)).every((edge) => !edge.missing && edge.start < 2 && edge.end < 2)).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(composite.getByLabel("Layer 0 blend method")).toHaveValue("multiply");
  await expect(composite.getByLabel("Layer 1 blend method")).toHaveValue("screen");
  await expect(composite.getByLabel("Invert layer 1 mask")).toBeChecked();
  expect(errors).toEqual([]);
});

test("live thumbnail updates blend, mix and masks without rendering", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return;
    sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
      { id: "red", type: "image", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/red.png", status: "complete" } },
      { id: "blue", type: "image", x: 20, y: 430, data: { resultUrl: "/outputs/e2e/blue.png", status: "complete" } },
      { id: "c", type: "utility", x: 550, y: 20, data: { utilityMode: "video", utilityVideoModel: "Composite Video", settingsOpen: false } }
    ], edges: [
      { id: "red-c", from: { nodeId: "red", port: "imageOut" }, to: { nodeId: "c", port: "referenceVideoIn" } },
      { id: "blue-c", from: { nodeId: "blue", port: "imageOut" }, to: { nodeId: "c", port: "compositeLayer:layer1" } }
    ], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } }));
  });
  const { errors, requests } = await openFixture(page, { count: 3 });
  for (const color of ["red", "blue"]) {
    const png = await sharp({ create: { width: 16, height: 16, channels: 4, background: color } }).png().toBuffer();
    await page.route(`**/outputs/e2e/${color}.png`, (route) => route.fulfill({ status: 200, contentType: "image/png", body: png }));
  }
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  const composite = page.locator('[data-node-card-id="c"]');
  const canvas = composite.getByLabel("Live composite thumbnail");
  const pixel = () => canvas.evaluate((element) => [...element.getContext("2d").getImageData(0, 0, 1, 1).data]);
  await expect.poll(pixel).toEqual([0, 0, 255, 255]);
  await composite.getByLabel("Layer 1 opacity").focus();
  await page.keyboard.press("Home");
  await expect.poll(pixel).toEqual([255, 0, 0, 255]);
  await composite.getByLabel("Layer 1 opacity").focus();
  await page.keyboard.press("End");
  await composite.getByLabel("Layer 1 blend method").selectOption("multiply");
  await expect.poll(pixel).toEqual([0, 0, 0, 255]);
  await composite.getByLabel("Layer 1 blend method").selectOption("screen");
  await expect.poll(pixel).toEqual([255, 0, 255, 255]);
  const from = await page.locator('[data-port-key="red:imageOut"]').boundingBox();
  const to = await composite.locator('[data-port-id="maskVideoIn"]').boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 }); await page.mouse.up();
  await expect.poll(async () => (await pixel())[2]).toBeLessThan(100);
  await composite.getByLabel("Invert layer 1 mask").check();
  await expect.poll(async () => (await pixel())[2]).toBeGreaterThan(150);
  await page.screenshot({ path: testInfo.outputPath("live-preview.png") });
  expect(requests.some((request) => request.path === "/api/node/utility-video")).toBe(false);
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import sharp from "sharp";
import { initializeCanvas, readPsd } from "ag-psd";
import { readFile } from "node:fs/promises";

initializeCanvas(() => { throw new Error("Read PSD pixels as image data."); },
  (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) }));

async function setSlider(slider, value) {
  await slider.evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, String(value));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

test("Seedream 5.5 separates, edits, and exports layers in a single Image Edit workspace", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, "Translator", { configurable: true, value: {
      availability: async () => "available",
      create: async ({ sourceLanguage, targetLanguage }) => ({
        translate: async label => sourceLanguage === "zh" && targetLanguage === "en" && label === "招牌" ? "Sign" : label,
      }),
    } });
  });
  const { errors } = await openFixture(page, {
    settings: { kreaApiKeyConfigured: true, falKeyConfigured: true, atlasApiKeyConfigured: true, userPreferences: { imageEditorModel: "Seedream 5.5" } },
    fixture: { nodes: [{ id: "seedream-source", type: "image", x: 30, y: 30, data: { resultUrl: "/outputs/e2e/landscape.png", status: "complete" } }],
      edges: [], groups: [], viewport: { x: 20, y: 20, scale: 0.8 } },
  });
  const submissions = [];
  let separations = 0;
  const output = (label, fileName, layer) => ({ label, fileName, url: `/outputs/e2e/${fileName}`, type: "image", mimeType: "image/png", provider: layer ? "Atlas Cloud" : "Krea", layer });
  await page.route("**/api/node/edit-image", async route => {
    const request = route.request();
    const form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    submissions.push(form);
    if (form.get("provider") === "atlas") {
      separations += 1;
      return route.fulfill({ json: { items: separations === 1 ? [
        { ...output("Atlas base", "atlas-base.png", { index: 0 }), width: 640, height: 360 },
        output("招牌", "atlas-sign.png", { index: 1, bbox: { absolute: [20, 30, 220, 130] }, textRecognition: { text: "OPEN" } }),
      ] : [
        { ...output("Sub-base", "sub-base.png", { index: 0 }), width: 640, height: 360 },
        output("Sub-layer", "sub-layer.png", { index: 1, bbox: { absolute: [0, 0, 320, 180] } }),
      ] } });
    }
    await route.fulfill({ json: { item: output("Image Edit", form.get("sourceUrl").endsWith("atlas-sign.png") ? "edited-sign.png" : "cutout.png") } });
  });
  await page.route(/\/outputs\/e2e\/atlas-(base|sign)\.png$/, route => route.fulfill({ path: "e2e/.generated/landscape.png", contentType: "image/png" }));
  let composite;
  let uploads = 0;
  await page.route("**/api/node/upload-asset", async route => {
    const request = route.request();
    const form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    composite = form.get("asset");
    await route.fulfill({ json: { asset: { localUrl: "/outputs/e2e/composition-" + ++uploads + ".png", fileName: composite.name } } });
  });
  await page.locator('[data-node-card-id="seedream-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with Seedream 5.5" }).click();
  const editor = page.getByRole("dialog", { name: "Image Edit", exact: true });
  const layers = editor.getByLabel("Layer stack", { exact: true });
  const desktop = page.viewportSize();
  await page.setViewportSize({ width: 420, height: 780 });
  const sourcePsd = page.waitForEvent("download");
  await editor.locator("header").getByRole("button", { name: "Export PSD" }).click();
  expect(readPsd(await readFile(await (await sourcePsd).path()), { skipLayerImageData: true, skipCompositeImageData: true }).children).toHaveLength(1);
  await editor.getByRole("button", { name: "Show layers" }).click();
  await expect(layers.locator("img")).toHaveCount(1);
  await expect(editor.getByRole("button", { name: "Export PSD" })).toBeInViewport();
  await editor.getByLabel("Layers", { exact: true }).selectOption("-1");
  await page.setViewportSize(desktop);
  await editor.getByLabel("Edit resolution").selectOption("1K");
  await editor.getByLabel("Edit background").selectOption("transparent");
  await expect(editor.getByLabel("Edit output format").locator('option[value="jpeg"]')).toHaveAttribute("disabled", "");
  await editor.getByLabel("Edit prompt").fill("Extract the lettering");
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Continue Editing" })).toBeVisible();
  expect(submissions[0].get("provider")).toBe("krea");
  expect(submissions[0].get("background")).toBe("transparent");
  expect(submissions[0].get("resolution")).toBe("1K");

  await editor.getByLabel("Layers", { exact: true }).selectOption("-1");
  await expect(editor.getByLabel("Edit method").locator("option").filter({ hasText: "Separate layers" })).toHaveCount(1);
  await editor.getByLabel("Edit method").selectOption("layers");
  await editor.getByLabel("Maximum layers", { exact: true }).fill("12");
  await editor.getByLabel("Layer resolution").selectOption("1.5k");
  await editor.getByLabel("Base image format").selectOption("jpeg");
  await editor.getByLabel("Recognize text layers").check();
  await editor.screenshot({ path: testInfo.outputPath("image-edit-inspector.png") });
  await editor.getByRole("button", { name: "Separate Layers", exact: true }).click();
  await expect(layers).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  const composition = editor.getByRole("group", { name: "Layer composition" });
  await expect(composition).toBeVisible();
  await expect(editor.getByLabel("Recognized text")).toHaveValue("OPEN");
  expect(Object.fromEntries([...submissions[1]].filter(([key]) => ["provider", "resolution", "outputFormat", "textRecognition", "maxLayers"].includes(key))))
    .toEqual({ provider: "atlas", resolution: "1.5k", outputFormat: "jpeg", textRecognition: "true", maxLayers: "13" });
  const positionX = editor.getByRole("slider", { name: "Position X" });
  await expect(positionX).toHaveValue("20");
  const selection = await editor.locator(".ies-layer-selection").boundingBox();
  expect(selection.width).toBeGreaterThan(40);
  await page.mouse.move(selection.x + 15, selection.y + 15);
  await page.mouse.down();
  await page.mouse.move(selection.x + 45, selection.y + 15);
  await page.mouse.up();
  await expect(positionX).not.toHaveValue("20");
  await setSlider(positionX, 79);
  await positionX.press("ArrowRight");
  await expect(positionX).toHaveValue("80");
  await layers.getByRole("button", { name: "Lower layer" }).click();
  await layers.getByRole("button", { name: "Show Atlas base" }).click();
  await expect(layers.getByRole("button", { name: "Show Atlas base" })).toHaveAttribute("aria-pressed", "false");
  await layers.getByRole("button", { name: "Sign", exact: true }).dblclick();
  const rename = editor.getByRole("textbox", { name: "Rename layer" });
  await rename.fill("Store sign");
  await rename.press("Enter");
  await editor.getByRole("button", { name: "Move Layers", exact: true }).click();
  const scaleHandle = editor.getByRole("button", { name: "Bottom right scale handle" });
  const bounds = await editor.getByRole("group", { name: "Layer transform" }).boundingBox();
  const corner = await scaleHandle.boundingBox();
  const centerX = bounds.x + bounds.width / 2, centerY = bounds.y + bounds.height / 2;
  const cornerX = corner.x + corner.width / 2, cornerY = corner.y + corner.height / 2;
  await page.mouse.move(cornerX, cornerY);
  await page.mouse.down();
  await page.mouse.move(centerX + (cornerX - centerX) * 1.2, centerY + (cornerY - centerY) * 1.2, { steps: 5 });
  await page.mouse.up();
  await expect(editor.getByRole("slider", { name: "Scale" })).toHaveValue("120");
  const rotateHandle = editor.getByRole("button", { name: "Rotate layer handle" });
  await rotateHandle.press("ArrowRight");
  await expect(editor.getByRole("slider", { name: "Rotation" })).toHaveValue("1");
  const rotationHandle = await rotateHandle.boundingBox();
  const rotateX = rotationHandle.x + rotationHandle.width / 2, rotateY = rotationHandle.y + rotationHandle.height / 2;
  await page.mouse.move(rotateX, rotateY);
  await page.mouse.down();
  await page.mouse.move(centerX - (rotateY - centerY), centerY + (rotateX - centerX), { steps: 8 });
  await page.mouse.up();
  await expect(editor.getByRole("slider", { name: "Rotation" })).toHaveValue("91");
  await setSlider(editor.getByRole("slider", { name: "Scale" }), 50);
  await setSlider(editor.getByRole("slider", { name: "Rotation" }), 90);
  await expect(editor.locator(".ies-layer-selection")).toHaveCSS("transform", "matrix(0, 0.5, -0.5, 0, 0, 0)");
  await editor.screenshot({ path: testInfo.outputPath("unified-image-edit.png") });

  await layers.getByRole("button", { name: "Store sign", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Move Layers", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByRole("button", { name: "Boxes", exact: true })).toBeDisabled();
  await editor.getByRole("button", { name: "Edit Pixels", exact: true }).click();
  await expect(editor.getByAltText("Original image", { exact: true })).toHaveAttribute("src", "/outputs/e2e/atlas-sign.png");
  await expect(composition.locator('img[src$="atlas-base.png"]')).toHaveCount(0);
  await layers.getByRole("button", { name: "Show Atlas base" }).click();
  await expect(composition.locator('img[src$="atlas-base.png"]')).toBeVisible();
  await layers.getByRole("button", { name: "Show Atlas base" }).click();
  await expect(editor.getByRole("button", { name: "Boxes", exact: true })).toBeEnabled();
  await editor.getByLabel("Edit prompt").fill("Change the sign lettering");
  await layers.getByRole("button", { name: "Atlas base", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Edit Pixels", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(editor.getByAltText("Original image", { exact: true })).toHaveAttribute("src", "/outputs/e2e/atlas-base.png");
  await expect(composition.locator(".ies-layer-active")).toHaveCSS("opacity", "0");
  await expect(composition.locator('img[src$="atlas-sign.png"]')).toBeVisible();
  await expect(editor.getByLabel("Edit prompt")).toHaveValue("");
  await layers.getByRole("button", { name: "Store sign", exact: true }).click();
  await expect(editor.getByLabel("Edit prompt")).toHaveValue("Change the sign lettering");
  await editor.getByLabel("Edit background").selectOption("transparent");
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await editor.getByRole("button", { name: "Apply to Layer" }).click();
  const signThumbnail = layers.getByRole("button", { name: "Store sign", exact: true }).locator("img");
  await expect(signThumbnail).toHaveAttribute("src", "/outputs/e2e/edited-sign.png");
  await expect(composition).toBeVisible();
  await expect(editor.getByRole("button", { name: "Edit Pixels", exact: true })).toHaveAttribute("aria-pressed", "true");
  await editor.getByText("Layer properties", { exact: true }).click();
  await expect(positionX).toHaveValue("80");
  expect(submissions[2].get("sourceUrl")).toBe("/outputs/e2e/atlas-sign.png");
  await editor.getByRole("slider", { name: "Opacity" }).press("ArrowLeft");
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await page.locator('[data-node-card-id="seedream-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with Seedream 5.5" }).click();
  await expect(editor.getByRole("slider", { name: "Opacity" })).toHaveValue("99");
  await expect(signThumbnail).toHaveAttribute("src", "/outputs/e2e/edited-sign.png");
  expect(submissions).toHaveLength(3);
  const downloadEvent = page.waitForEvent("download");
  await editor.getByRole("button", { name: "Export PSD" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("seedream-layers.psd");
  const psd = readPsd(await readFile(await download.path()), { useImageData: true });
  expect([psd.width, psd.height]).toEqual([640, 360]);
  expect(psd.children.map(layer => layer.name)).toEqual(["Store sign", "Atlas base"]);
  expect(psd.children[0]).toMatchObject({ left: 155, top: 30, right: 205, bottom: 130, hidden: false });
  expect(psd.children[0].opacity).toBeCloseTo(0.99, 2);
  expect(psd.children[1].hidden).toBe(true);
  expect(psd.children[1].imageData.data[3]).toBeGreaterThan(0);
  expect(psd.imageData.data[3]).toBe(0);
  expect(composite).toBeUndefined();
  await editor.getByRole("button", { name: "Edit Pixels", exact: true }).click();
  await layers.getByRole("button", { name: "Store sign", exact: true }).click();
  await editor.getByRole("button", { name: "Selection layer" }).click();
  const editable = await composition.locator(".ies-layer-active").boundingBox();
  await page.mouse.move(editable.x + editable.width * 0.3, editable.y + editable.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(editable.x + editable.width * 0.7, editable.y + editable.height * 0.7, { steps: 6 });
  await page.mouse.up();
  await editor.getByRole("button", { name: "Add to Existing Layer" }).click();
  await expect(layers.getByRole("button", { name: "Atlas base", exact: true }).locator("img")).toHaveAttribute("src", "/outputs/e2e/composition-1.png");
  await editor.getByRole("button", { name: "Add to New Layer" }).click();
  await expect(layers.getByRole("button", { name: "Selection", exact: true })).toBeVisible();
  await layers.getByRole("button", { name: "Selection", exact: true }).click();
  await editor.getByLabel("Edit method").selectOption("layers");
  await editor.getByRole("button", { name: "Separate Layers", exact: true }).click();
  await expect(layers.getByRole("button", { name: "Sub-layer", exact: true })).toBeVisible();
  await expect(editor.getByRole("button", { name: "Edit Pixels", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(layers.getByRole("button", { name: "Selection", exact: true })).toHaveCount(0);
  await expect(layers.getByRole("button", { name: "Store sign", exact: true })).toBeVisible();
  await expect(editor.getByLabel("Layers", { exact: true }).locator("option").filter({ hasText: "Separation" })).toHaveCount(1);
  await layers.getByRole("button", { name: "Store sign", exact: true }).click();
  await editor.getByRole("button", { name: "Boxes", exact: true }).click();
  const boxCanvas = await editor.getByLabel("Boxes canvas").boundingBox();
  await page.mouse.move(boxCanvas.x + boxCanvas.width * 0.25, boxCanvas.y + boxCanvas.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(boxCanvas.x + boxCanvas.width * 0.65, boxCanvas.y + boxCanvas.height * 0.65, { steps: 6 });
  await page.mouse.up();
  await expect(editor.getByLabel("Box description", { exact: true })).toBeVisible();
  await editor.getByRole("button", { name: "Add to New Layer" }).click();
  await expect(layers.locator(":scope > div")).toHaveCount(5);
  await editor.getByRole("button", { name: "Save composite as Image" }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  expect(composite.type).toBe("image/png");
  const { data: pixels, info } = await sharp(Buffer.from(await composite.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([640, 360, 4]);
  expect(pixels[3]).toBe(0);
  expect(pixels[(40 * info.width + 160) * 4 + 3]).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import fs from "node:fs/promises";
import { readSelectionMetadata } from "../src/imageEditBoxExport.js";
import sharp from "sharp";

test("new boxes name themselves, respect manual edits and save the annotated image to disk", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "edit-source", type: "image", x: 30, y: 30, data: { title: "Edit source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 }
  })));
  const { errors } = await openFixture(page, { count: 1, settings: { falKeyConfigured: true, userPreferences: { imageEditorModel: "OpenAI Image 2.5 Flare" } } });
  let naming = 0, delayed, requested;
  let waitRequest = new Promise(resolve => { requested = resolve; });
  await page.route("**/api/node/identify-image-box", async route => {
    naming++;
    expect(route.request().postDataJSON().region.w).toBeCloseTo(.15, 2);
    if (naming === 2 || naming === 4) { delayed = route; requested(); return; }
    return route.fulfill({ json: { label: naming === 1 ? "pickleball" : "Object", confidence: naming === 1 ? .95 : .3, provider: "fal", model: "fixture" } });
  });
  await page.locator('[data-node-card-id="edit-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with OpenAI Image 2.5 Flare", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Image Edit", exact: true });
  const save = editor.getByRole("button", { name: "Save image to disk", exact: true });
  await expect(save).toBeVisible();
  const firstDownload = page.waitForEvent("download"); await save.click();
  const originalDownload = await firstDownload;
  expect(originalDownload.suggestedFilename()).toBe("landscape.png");
  const original = await fs.readFile(await originalDownload.path());
  await editor.getByRole("button", { name: "Boxes", exact: true }).click();
  const surface = await editor.locator(".ies-surface").boundingBox();
  async function draw(x, y) {
    await page.mouse.move(surface.x + surface.width * x, surface.y + surface.height * y); await page.mouse.down();
    await page.mouse.move(surface.x + surface.width * (x + .15), surface.y + surface.height * (y + .15)); await page.mouse.up();
  }
  await draw(.1, .15);
  await expect(editor.getByLabel("Box description", { exact: true })).toHaveValue("pickleball");
  await expect(editor.getByLabel("Rename box 1", { exact: true })).toHaveText("1. pickleball");
  await draw(.5, .15); await waitRequest;
  await expect(save).toBeDisabled();
  await editor.getByLabel("Box description", { exact: true }).fill("my cup");
  await delayed.fulfill({ json: { label: "pencil cup", confidence: .9 } });
  await expect(editor.getByLabel("Box description", { exact: true })).toHaveValue("my cup");
  await draw(.5, .6);
  await expect(editor.getByLabel("Box description", { exact: true })).toHaveValue("Object");
  await expect(save).toBeEnabled();
  const downloadWait = page.waitForEvent("download"); await save.click();
  const download = await downloadWait, png = await fs.readFile(await download.path());
  expect(download.suggestedFilename()).toBe("image-selection.png");
  const metadata = readSelectionMetadata(png);
  expect(metadata.boxes.map(box => box.label)).toEqual(["pickleball", "my cup", "Object"]);
  const pixel = async (bytes, left = 320, top = 340) => (await sharp(bytes).ensureAlpha().extract({ left, top, width: 1, height: 1 }).raw().toBuffer()).toString("hex");
  expect(await pixel(png)).toBe(await pixel(original));
  waitRequest = new Promise(resolve => { requested = resolve; });
  await draw(.1, .6); await waitRequest;
  await editor.getByRole("button", { name: "Delete box", exact: true }).click();
  await delayed.fulfill({ json: { label: "deleted box", confidence: .99 } });
  await expect(editor.locator(".ies-box-target")).toHaveCount(3);
  await editor.getByRole("button", { name: "Draw", exact: true }).click();
  async function stroke() {
    await page.mouse.move(surface.x + surface.width * .3, surface.y + surface.height * .8); await page.mouse.down();
    await page.mouse.move(surface.x + surface.width * .4, surface.y + surface.height * .8); await page.mouse.up();
  }
  await stroke(); await editor.getByRole("button", { name: "Erase marks", exact: true }).click(); await stroke();
  const erasedWait = page.waitForEvent("download"); await save.click();
  const erased = await fs.readFile(await (await erasedWait).path());
  expect(await pixel(erased, 224, 288)).toBe(await pixel(original, 224, 288));
  await expect(editor).toBeVisible(); expect(errors).toEqual([]);
});

test("Save Selection creates a tagged PNG output and canvas copy with more than eight boxes", async ({ page }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "edit-source", type: "image", x: 30, y: 30, data: { title: "Edit source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 }
  })));
  await openFixture(page, { count: 1, settings: { falKeyConfigured: true, userPreferences: { imageEditorModel: "OpenAI Image 2.5 Flare" } } });
  await page.locator('[data-node-card-id="edit-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with OpenAI Image 2.5 Flare", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Image Edit", exact: true });
  await editor.getByRole("button", { name: "Boxes", exact: true }).click();
  const surface = await editor.locator(".ies-surface").boundingBox();
  for (let i = 0; i < 12; i++) {
    const x = .1 + i % 4 * .2, y = .15 + Math.floor(i / 4) * .25;
    await page.mouse.move(surface.x + surface.width * x, surface.y + surface.height * y);
    await page.mouse.down(); await page.mouse.move(surface.x + surface.width * (x + .08), surface.y + surface.height * (y + .08)); await page.mouse.up();
    await editor.getByLabel("Box description", { exact: true }).fill(`Lamp ${i + 1}`);
  }
  await expect(editor.locator(".ies-box-target")).toHaveCount(12);
  await expect(editor.getByLabel("Load box selections", { exact: true })).toHaveCount(0);
  let saved;
  await page.route("**/api/node/save-image-selection", async route => {
    const body = route.request().postDataBuffer(), start = body.indexOf(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(start).toBeGreaterThan(0);
    let end = start + 8;
    for (;;) { const length = body.readUInt32BE(end), type = body.subarray(end + 4, end + 8).toString(); end += length + 12; if (type === "IEND") break; }
    const png = body.subarray(start, end); saved = readSelectionMetadata(png);
    expect(saved.boxes).toHaveLength(12); expect(saved.boxes[11].tag).toBe("@lamp-12");
    const info = await sharp(png).metadata(); expect(info.width).toBe(saved.source.width); expect(info.height).toBe(saved.source.height);
    await fs.writeFile(testInfo.outputPath("image-selection.png"), png);
    await route.fulfill({ json: { item: { url: "/outputs/e2e/landscape.png", label: "Image Selection", fileName: "image-selection.png", type: "image", provider: "local", width: info.width, height: info.height } } });
  });
  await editor.getByRole("button", { name: "Save selections and boxes", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(page.locator('[data-node-card-id]')).toHaveCount(2);
  await expect(page.locator('[data-node-card-id="edit-source"] img').first()).toHaveAttribute("src", /landscape.png/);
  expect(saved.boxes).toHaveLength(12);
});

test("Boxes modes, transforms, undo, reference upload and preferred-model submission", async ({ page }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "edit-source", type: "image", x: 30, y: 30, data: { title: "Edit source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 }
  })));
  const { errors } = await openFixture(page, { count: 1, settings: { falKeyConfigured: true, userPreferences: { imageEditorModel: "OpenAI Image 2.5 Flare" } } });
  await page.locator('[data-node-card-id="edit-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with OpenAI Image 2.5 Flare", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Image Edit", exact: true });
  await editor.getByRole("button", { name: "Boxes", exact: true }).click();
  const surface = await editor.locator(".ies-surface").boundingBox();
  const move = (x, y) => page.mouse.move(surface.x + surface.width * x, surface.y + surface.height * y);
  await move(.2, .2); await page.mouse.down(); await move(.4, .4); await page.mouse.up();
  await editor.getByLabel("Rename box 1", { exact: true }).dblclick();
  await editor.getByLabel("Canvas box description").fill("Cat");
  await editor.getByLabel("Canvas box description").press("Enter");
  await expect(editor.getByLabel("Box description", { exact: true })).toHaveValue("Cat");
  await editor.getByLabel("Rename box 1", { exact: true }).dblclick();
  await editor.getByLabel("Canvas box description").fill("Discarded name");
  await editor.getByLabel("Canvas box description").press("Escape");
  await expect(editor.getByLabel("Box description", { exact: true })).toHaveValue("Cat");
  const corner = editor.locator(".ies-box-corner").first(), hit = editor.locator(".ies-box-scale-hit").first();
  expect(Number(await corner.getAttribute("r"))).toBe(Number(await hit.getAttribute("r")) / 4);
  await expect(editor.getByLabel("Shadow / lighting area", { exact: true })).toHaveValue("35");
  await editor.getByLabel("Shadow / lighting area", { exact: true }).fill("60");
  await editor.getByLabel("Translate X (%)", { exact: true }).fill("60");
  await editor.getByLabel("Rotation (°)", { exact: true }).fill("35");
  await editor.getByRole("button", { name: "Undo stroke" }).click();
  await expect(editor.getByLabel("Rotation (°)")).toHaveValue("0");
  await editor.getByRole("button", { name: "Redo stroke" }).click();
  await expect(editor.getByLabel("Rotation (°)")).toHaveValue("35");
  await expect(editor.getByLabel("Edit method")).toBeDisabled();
  const target = editor.locator(".ies-box-target");
  const before = await target.getAttribute("points");
  const handle = await editor.getByLabel("Scale box 1", { exact: true }).last().boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x - 20, handle.y + 20); await page.mouse.up();
  await expect(target).not.toHaveAttribute("points", before);
  const rotation = await editor.getByLabel("Rotate box 1", { exact: true }).boundingBox();
  await page.mouse.move(rotation.x + rotation.width / 2, rotation.y + rotation.height / 2); await page.mouse.down();
  await page.mouse.move(rotation.x + 25, rotation.y + 15); await page.mouse.up();
  await expect(editor.getByLabel("Rotation (°)")).not.toHaveValue("35");
  for (const mode of ["new", "keep", "remove", "text", "reference", "move"]) {
    await editor.getByLabel("Box mode", { exact: true }).selectOption(mode);
    if (mode === "text") await editor.getByLabel("Box text", { exact: true }).fill("Hello world");
    if (mode === "reference") {
      await page.route("**/api/node/upload-asset", route => route.fulfill({ json: { asset: { localUrl: "/outputs/e2e/reference.png", fileName: "reference.png" } } }));
      await editor.getByLabel("Box reference image").setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: Buffer.from("fixture") });
      await expect(editor.getByAltText("Box reference", { exact: true })).toBeVisible();
    }
  }
  await editor.getByLabel("Translate X (%)", { exact: true }).fill("65");
  await editor.getByLabel("Rotation (°)", { exact: true }).fill("25");
  await editor.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("boxes.png") });
  let form, edits = 0;
  await page.route("**/api/node/edit-image", async route => {
    edits++;
    if (edits === 1) { await route.fulfill({ status: 503, json: { error: "Temporary edit failure" } }); return; }
    const request = route.request();
    form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    await route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", fileName: "edited.png", type: "image" } } });
  });
  await editor.getByLabel("Box description", { exact: true }).fill("");
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect(editor.getByRole("alert")).toBeInViewport();
  await expect(editor.getByRole("alert")).toContainText("Describe each boxed object");
  expect(form).toBeUndefined();
  await editor.getByLabel("Box description", { exact: true }).fill("Cat");
  await page.route("**/api/node/image-objects", route => route.fulfill({ json: { masks: [] } }));
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText('No object matched "Cat"');
  expect(form).toBeUndefined();
  let selections = 0;
  await page.route("**/api/node/image-objects", route => { selections++; expect(route.request().postDataJSON().prompt).toBe("Cat"); return route.fulfill({ json: { masks: [{ width: 10, height: 10, runs: [22, 2, 32, 2], area: 4 }] } }); });
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("Temporary edit failure");
  await expect(editor.getByText("Object selected. Check", { exact: false })).toBeVisible();
  expect(selections).toBe(1);
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect.poll(() => Boolean(form)).toBe(true);
  expect(selections).toBe(1);
  expect(form.get("model")).toBe("OpenAI Image 2.5 Flare");
  expect(form.get("boxObjects")).toBeTruthy();
  const [box] = JSON.parse(form.get("boxes"));
  expect(box.contextPadding).toBe(.6); expect(box.label).toBe("Cat"); expect(box.mode).toBe("move");
  expect(box.target.x).toBe(.65); expect(box.target.rotation).toBe(25);
  expect(box.source.x).toBeCloseTo(.3, 2);
  const divider = editor.getByRole("slider", { name: "Compare divider", exact: true });
  await expect(divider).toBeVisible();
  const resultDownload = page.waitForEvent("download");
  await editor.getByRole("button", { name: "Save image to disk", exact: true }).click();
  expect((await resultDownload).suggestedFilename()).toBe("edited.png");
  const imageRect = await editor.locator(".ies-surface").boundingBox();
  const transform = await editor.locator(".ies-surface").evaluate(el => el.style.transform);
  const grip = await divider.boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
  await page.mouse.move(imageRect.x + imageRect.width * .8, imageRect.y + imageRect.height * .5); await page.mouse.up();
  await expect(divider).toHaveAttribute("aria-valuenow", "80");
  expect(Number(await editor.getByLabel("Comparison split", { exact: true }).inputValue())).toBeCloseTo(80, 0);
  expect(await editor.locator(".ies-surface").evaluate(el => el.style.transform)).toBe(transform);
  await editor.getByLabel("Comparison split", { exact: true }).focus();
  await page.keyboard.press("Home"); await page.keyboard.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "1");
  await divider.focus(); await page.keyboard.press("End");
  await expect(divider).toHaveAttribute("aria-valuenow", "100");
  await page.keyboard.press("Home");
  await expect(divider).toHaveAttribute("aria-valuenow", "0");
  expect(errors).toEqual([]);
});

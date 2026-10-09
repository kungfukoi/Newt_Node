import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { openFixture } from "./helpers.mjs";

const masks = [
  { id: "left", width: 10, height: 10, runs: [21, 2, 31, 2], area: 4 },
  { id: "right", width: 10, height: 10, runs: [26, 2, 36, 2], area: 4 }
];
async function openEditor(page, falKeyConfigured = true) {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "edit-source", type: "image", x: 30, y: 30, data: { title: "Edit source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 }
  })));
  const fixture = await openFixture(page, { count: 1, settings: { falKeyConfigured, userPreferences: { imageEditorModel: "Flux 3" } } });
  await page.locator('[data-node-card-id="edit-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with Flux 3", exact: true }).click();
  return { ...fixture, editor: page.getByRole("dialog", { name: "Image Edit", exact: true }) };
}
const alpha = (canvas, x, y) => canvas.evaluate((element, p) => element.getContext("2d").getImageData(Math.floor(element.width * p.x), Math.floor(element.height * p.y), 1, 1).data[3], { x, y });
async function move(page, editor, x, y, click = false, modifier) {
  const box = await editor.locator(".ies-surface").boundingBox();
  if (modifier) await page.keyboard.down(modifier);
  await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
  if (click) await page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  if (modifier) await page.keyboard.up(modifier);
}

test("object hover, modifiers, undo, prompt selection and exported edit mask", async ({ page }, testInfo) => {
  const { editor, errors } = await openEditor(page);
  const calls = []; let editForm;
  await page.route("**/api/node/image-objects", async route => {
    const body = route.request().postDataJSON(); calls.push(body);
    await route.fulfill({ json: { masks: body.point ? [{ id: "missed", width: 10, height: 10, runs: [75, 1], area: 1 }] : body.prompt ? [masks[1]] : masks } });
  });
  await page.route("**/api/node/edit-image", async route => {
    const req = route.request();
    editForm = await new Response(req.postDataBuffer(), { headers: { "content-type": req.headers()["content-type"] } }).formData();
    await route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", fileName: "edited.png", type: "image", provider: "fal.ai" } } });
  });
  await expect(editor.getByRole("group", { name: "SAM 2 settings" })).toHaveCount(0);
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  await expect(editor.getByText("2 objects ready.", { exact: false })).toBeVisible();
  await expect(editor.getByRole("group", { name: "SAM 2 settings" })).toBeVisible();
  const selection = editor.getByLabel("Selection canvas"), hover = editor.getByLabel("Object hover preview");
  await move(page, editor, .2, .3);
  await expect.poll(() => alpha(hover, .2, .3)).toBe(255);
  expect(await alpha(selection, .2, .3)).toBe(0);
  await move(page, editor, .2, .3, true);
  await expect.poll(() => alpha(selection, .2, .3)).toBe(255);
  await move(page, editor, .7, .3, true, "Shift");
  await expect.poll(() => alpha(selection, .7, .3)).toBe(255);
  expect(await alpha(selection, .2, .3)).toBe(255);
  await move(page, editor, .2, .3, true, "Alt");
  await expect.poll(() => alpha(selection, .2, .3)).toBe(0);
  await editor.getByRole("button", { name: "Undo stroke", exact: true }).click();
  await expect.poll(() => alpha(selection, .2, .3)).toBe(255);
  await editor.getByRole("button", { name: "Redo stroke", exact: true }).click();
  await expect.poll(() => alpha(selection, .2, .3)).toBe(0);
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  expect(calls).toHaveLength(1);
  await editor.getByRole("button", { name: "Zoom in", exact: true }).click();
  await move(page, editor, .55, .75, true, "Shift");
  await expect.poll(() => calls.length).toBe(2);
  await expect.poll(() => alpha(selection, .55, .75)).toBe(255);
  expect(calls[1].point.x).toBeCloseTo(.55, 2);
  await editor.getByLabel("Object selection prompt").fill("the jacket");
  await editor.getByRole("button", { name: "Select", exact: true }).click();
  await expect(editor.getByText("Selected 1 matching regions.", { exact: false })).toBeVisible();
  expect(calls[2].prompt).toBe("the jacket");
  await expect.poll(() => alpha(selection, .55, .75)).toBe(0);
  expect(await alpha(selection, .7, .3)).toBe(255);
  await page.screenshot({ path: testInfo.outputPath("object-selection.png") });
  await editor.getByLabel("Edit prompt").fill("Make it blue");
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect.poll(() => Boolean(editForm)).toBe(true);
  const { data, info } = await sharp(Buffer.from(await editForm.get("selection").arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = (x, y) => data[(Math.floor(y * info.height) * info.width + Math.floor(x * info.width)) * 4 + 3];
  expect(pixel(.7, .3)).toBe(255); expect(pixel(.2, .3)).toBe(0);
  expect(calls).toHaveLength(3);
  expect(errors).toEqual([]);
});

test("selection failure is visible, preserves draft, and never automatically retries", async ({ page }) => {
  const { editor } = await openEditor(page);
  let calls = 0;
  await page.route("**/api/node/image-objects", async route => { calls++; await route.fulfill({ status: 502, json: { error: "SAM 2 unavailable. Check Fal history." } }); });
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("SAM 2 unavailable");
  await move(page, editor, .2, .3);
  await move(page, editor, .7, .3);
  expect(calls).toBe(1);
});

test("SAM 2 controls only appear in object mode and apply on explicit rescan", async ({ page }) => {
  const { editor } = await openEditor(page);
  const calls = [];
  await page.route("**/api/node/image-objects", async route => { calls.push(route.request().postDataJSON()); await route.fulfill({ json: { masks } }); });
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  await expect(editor.getByText("2 objects ready.", { exact: false })).toBeVisible();
  for (const [label, value] of [["Sampling density", "64"], ["Confidence threshold", "0.70"], ["Stability threshold", "0.80"], ["Minimum region area", "20"]]) {
    await editor.getByLabel(label, { exact: true }).evaluate((element, next) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(element, next);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  }
  expect(calls).toHaveLength(1);
  await editor.getByRole("button", { name: "Rescan objects", exact: true }).click();
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].sam2).toEqual({ pointsPerSide: 64, confidence: .7, stability: .8, minRegionArea: 20 });
  await expect(editor.getByRole("button", { name: "Rescan objects", exact: true })).toBeEnabled();
  await editor.getByRole("button", { name: "Draw", exact: true }).click();
  await expect(editor.getByRole("group", { name: "SAM 2 settings" })).toHaveCount(0);
});


test("Object Selection converts to a named Move box with its exact mask and no extra SAM call", async ({ page }) => {
  const { editor } = await openEditor(page); let selections = 0, form;
  await page.route("**/api/node/image-objects", async route => { selections++; await route.fulfill({ json: { masks: [masks[0]] } }); });
  await page.route("**/api/node/edit-image", async route => {
    const request = route.request();
    form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    await route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", fileName: "edited.png", type: "image" } } });
  });
  await editor.getByLabel("Object selection prompt").fill("the red jacket");
  await editor.getByRole("button", { name: "Select", exact: true }).click();
  await expect(editor.getByText("Selected 1 matching regions.", { exact: false })).toBeVisible();
  await editor.getByRole("button", { name: "Boxes", exact: true }).click();
  await expect(editor.getByLabel("Box description", { exact: true })).toHaveValue("the red jacket");
  await expect(editor.getByText("Object selected. Check", { exact: false })).toBeVisible();
  expect(selections).toBe(1);
  await editor.getByRole("button", { name: "Undo stroke" }).click();
  await expect(editor.getByLabel("Box description", { exact: true })).toHaveCount(0);
  await expect.poll(() => alpha(editor.getByLabel("Selection canvas"), .2, .3)).toBe(255);
  await editor.getByRole("button", { name: "Redo stroke" }).click();
  await editor.getByLabel("Translate X (%)", { exact: true }).fill("65");
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect.poll(() => Boolean(form)).toBe(true);
  expect(form.get("selection")).toBeNull();
  const objects = JSON.parse(await form.get("boxObjects").text());
  expect(Object.values(objects)[0].area).toBeGreaterThan(0);
  expect(form.get("model")).toBe("Flux 3");
  expect(selections).toBe(1);
});

test("Shift-selected objects stay one named selection through rename, undo and transforms", async ({ page }, testInfo) => {
  const { editor, errors } = await openEditor(page); let selections = 0, form;
  await page.route("**/api/node/image-objects", async route => { selections++; await route.fulfill({ json: { masks } }); });
  await page.route("**/api/node/edit-image", async route => {
    const request = route.request();
    form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    await route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", type: "image" } } });
  });
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  await expect(editor.getByText("2 objects ready.", { exact: false })).toBeVisible();
  await move(page, editor, .2, .3, true);
  await move(page, editor, .7, .3, true, "Shift");
  await editor.getByRole("button", { name: "Boxes", exact: true }).click();
  await expect(editor.getByLabel("Active box").locator("option")).toHaveCount(2);
  await editor.getByRole("button", { name: "Undo stroke" }).click();
  await expect.poll(() => alpha(editor.getByLabel("Selection canvas"), .2, .3)).toBe(255);
  expect(await alpha(editor.getByLabel("Selection canvas"), .7, .3)).toBe(255);
  await editor.getByRole("button", { name: "Redo stroke" }).click();
  await editor.getByLabel("Box description", { exact: true }).fill("People");
  await expect(editor.getByText("All selected regions share", { exact: false })).toBeVisible();
  await editor.getByLabel("Translate X (%)", { exact: true }).fill("55");
  await editor.getByLabel("Width (%)", { exact: true }).fill("60");
  await editor.getByLabel(/^Rotation /).fill("20");
  await page.screenshot({ path: testInfo.outputPath("combined-selection.png") });
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect.poll(() => Boolean(form)).toBe(true);
  const boxes = JSON.parse(form.get("boxes"));
  expect(boxes).toHaveLength(1);
  expect(boxes[0].label).toBe("People");
  expect(boxes[0].target).toMatchObject({ x: .55, w: .6, rotation: 20 });
  const objects = JSON.parse(await form.get("boxObjects").text());
  expect(Object.keys(objects)).toEqual([boxes[0].id]);
  const mask = objects[boxes[0].id];
  const selected = (x, y) => {
    const pixel = Math.floor(y * mask.height) * mask.width + Math.floor(x * mask.width);
    return mask.runs.some((start, i) => i % 2 === 0 && pixel >= start && pixel < start + mask.runs[i + 1]);
  };
  expect(selected(.2, .3)).toBe(true);
  expect(selected(.7, .3)).toBe(true);
  expect(selected(.45, .3)).toBe(false);
  expect(form.get("selection")).toBeNull();
  expect(selections).toBe(1);
  expect(errors).toEqual([]);
});

test("native Flux boxes identify by description without a segmentation request", async ({ page }) => {
  const { editor } = await openEditor(page); let selections = 0, form;
  await page.route("**/api/node/image-objects", route => { selections++; return route.fulfill({ json: { masks: [] } }); });
  await page.route("**/api/node/edit-image", async route => {
    const request = route.request();
    form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    await route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", type: "image" } } });
  });
  await editor.getByRole("button", { name: "Boxes", exact: true }).click();
  await move(page, editor, .2, .2); await page.mouse.down(); await move(page, editor, .4, .4); await page.mouse.up();
  await editor.getByLabel("Box description", { exact: true }).fill("Cat");
  await editor.getByLabel("Translate X (%)", { exact: true }).fill("65");
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect.poll(() => Boolean(form)).toBe(true);
  expect(selections).toBe(0);
  expect(form.get("boxObjects")).toBeNull();
  expect(JSON.parse(form.get("boxes"))[0].label).toBe("Cat");
});

test("saved objects survive Continue Editing, reopen, and explicit rescan without losing the selection", async ({ page }, testInfo) => {
  const { editor, errors } = await openEditor(page);
  const saved = new Map(), scans = [], links = [];
  await page.route("**/api/node/image-object-cache", async route => {
    const body = route.request().postDataJSON();
    if (body.targetUrl) {
      links.push(body);
      saved.set(body.targetUrl, (saved.get(body.sourceUrl) || []).map(entry => ({ ...entry, data: { ...entry.data, inherited: true } })));
      return route.fulfill({ json: { inherited: true } });
    }
    return route.fulfill({ json: { entries: saved.get(body.sourceUrl) || [] } });
  });
  await page.route("**/api/node/image-objects", async route => {
    const body = route.request().postDataJSON(); scans.push(body);
    const options = { sam2: body.sam2 };
    const data = { masks: body.rescan ? [masks[1]] : masks, inherited: false };
    saved.set(body.sourceUrl, [{ key: JSON.stringify(options), options, data }]);
    await route.fulfill({ json: data });
  });
  await page.route("**/api/node/edit-image", route => route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", type: "image" } } }));
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  await expect(editor.getByText("2 objects ready.", { exact: false })).toBeVisible();
  await editor.getByLabel("Edit prompt").fill("Change the colors");
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Continue Editing", exact: true })).toBeVisible();
  expect(links).toEqual([{ sourceUrl: "/outputs/e2e/landscape.png", targetUrl: "/outputs/e2e/edited.png" }]);
  await editor.getByRole("button", { name: "Continue Editing", exact: true }).click();
  await expect(editor.getByText("Using scan from before this edit.", { exact: false })).toBeVisible();
  await move(page, editor, .2, .3, true);
  const selection = editor.getByLabel("Selection canvas");
  await expect.poll(() => alpha(selection, .2, .3)).toBe(255);
  await editor.getByRole("button", { name: "Undo stroke", exact: true }).click();
  await expect.poll(() => alpha(selection, .2, .3)).toBe(0);
  await editor.getByRole("button", { name: "Redo stroke", exact: true }).click();
  await expect.poll(() => alpha(selection, .2, .3)).toBe(255);
  expect(scans).toHaveLength(1);
  await page.screenshot({ path: testInfo.outputPath("object-scan-inherited.png") });
  await editor.getByRole("button", { name: "Rescan objects", exact: true }).click();
  await expect(editor.getByText("1 objects ready.", { exact: false })).toBeVisible();
  await expect(editor.getByText("Using scan from before this edit.", { exact: false })).toHaveCount(0);
  expect(scans).toHaveLength(2); expect(scans[1].rescan).toBe(true);
  expect(await alpha(selection, .2, .3)).toBe(255);
  await editor.getByRole("button", { name: "Close image editor", exact: true }).click();
  await editor.getByRole("button", { name: "Discard Draft", exact: true }).click();
  // Reopen the original: its saved map remains distinct from the edited scan.
  await page.getByRole("button", { name: "Draw and edit with Flux 3", exact: true }).click();
  await expect(editor.getByText("Saved scan restored", { exact: false })).toBeVisible();
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  await move(page, editor, .2, .3, true);
  await expect.poll(() => alpha(editor.getByLabel("Selection canvas"), .2, .3)).toBe(255);
  expect(scans).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("a saved scan works without Fal credentials", async ({ page }) => {
  const { editor } = await openEditor(page, false);
  const options = { sam2: { pointsPerSide: 32, confidence: .88, stability: .95, minRegionArea: 100 } };
  let paid = 0;
  await page.route("**/api/node/image-object-cache", route => route.fulfill({ json: { entries: [{ key: JSON.stringify(options), options, data: { masks } }] } }));
  await page.route("**/api/node/image-objects", route => { paid++; return route.fulfill({ status: 400, json: { error: "No key" } }); });
  // Remount so restoration reads the persisted scan with no provider enabled.
  await editor.getByRole("button", { name: "Close image editor", exact: true }).click();
  await page.getByRole("button", { name: "Draw and edit with Flux 3", exact: true }).click();
  await expect(editor.getByText("Saved scan restored", { exact: false })).toBeVisible();
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  await move(page, editor, .2, .3, true);
  await expect.poll(() => alpha(editor.getByLabel("Selection canvas"), .2, .3)).toBe(255);
  expect(paid).toBe(0);
});

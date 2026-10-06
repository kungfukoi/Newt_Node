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
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  await expect(editor.getByText("2 objects ready.", { exact: false })).toBeVisible();
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
  await editor.getByRole("button", { name: "Select with SAM 3", exact: true }).click();
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

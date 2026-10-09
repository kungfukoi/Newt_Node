import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

async function editorFixture(page) {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "edit-source", type: "image", x: 30, y: 30, data: { title: "Edit source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 }
  })));
  const fixture = await openFixture(page, { count: 1, settings: { falKeyConfigured: true, userPreferences: { imageEditorModel: "Flux 3" } } });
  await page.locator('[data-node-card-id="edit-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with Flux 3", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Image Edit", exact: true });
  await page.route("**/api/node/image-objects", route => route.fulfill({ json: { masks: [{ id: "object", width: 10, height: 10, runs: [21, 2, 31, 2], area: 4 }] } }));
  await editor.getByRole("button", { name: "Object Selection", exact: true }).click();
  await expect(editor.getByText("1 objects ready.", { exact: false })).toBeVisible();
  const rect = await editor.locator(".ies-surface").boundingBox();
  await page.mouse.click(rect.x + rect.width * .2, rect.y + rect.height * .3);
  await editor.getByLabel("Edit prompt").fill("Make the jacket blue");
  return { ...fixture, editor };
}
const alpha = editor => editor.getByLabel("Selection canvas").evaluate(canvas => canvas.getContext("2d").getImageData(Math.floor(canvas.width * .2), Math.floor(canvas.height * .3), 1, 1).data[3]);

test("header and User Preferences share immediate persisted changes and preserve the editor draft", async ({ page }, testInfo) => {
  const { editor, errors } = await editorFixture(page);
  let settings = { version: "e2e", credentials: {}, activeCredentialIds: {}, falKeyConfigured: true,
    modelProviderPreferences: { imageGeneration: "fal" },
    userPreferences: { imageEditorModel: "Flux 3", showPresetPanel: false, showPriceSnapshot: false, directorProcessingModel: "sol", textAgentModel: "astra" } };
  const writes = [], reads = [];
  await page.route(/\/api\/settings(?:\?.*)?$/, async route => {
    if (route.request().method() === "POST") { const body = route.request().postDataJSON(); writes.push(body); settings = { ...settings, ...body }; }
    else reads.push(route.request().url());
    await route.fulfill({ json: settings });
  });
  const picker = editor.getByRole("combobox", { name: "Image Editor Model", exact: true });
  await picker.selectOption("Ideogram 4.5");
  await expect(picker).toHaveValue("Ideogram 4.5");
  expect(writes[0]).toEqual({ userPreferences: { ...settings.userPreferences, imageEditorModel: "Ideogram 4.5" } });
  expect(reads.some(url => url.endsWith("includeSecrets=0"))).toBe(true);
  await expect(editor.getByLabel("Edit prompt")).toHaveValue("Make the jacket blue");
  expect(await alpha(editor)).toBe(255);
  await expect(editor.getByLabel("Edit quality")).toHaveValue("high");
  await expect(editor.getByLabel("Edit resolution")).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("shared-editor-model.png") });
  let form;
  await page.route("**/api/node/edit-image", async route => {
    const request = route.request();
    form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    await route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", type: "image", provider: "fal.ai" } } });
  });
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect(editor.getByRole("button", { name: "Continue Editing", exact: true })).toBeVisible();
  expect(form.get("model")).toBe("Ideogram 4.5"); expect(form.get("selection")).not.toBeNull();
  await picker.selectOption("Nano Banana 2.1");
  await expect(picker).toHaveValue("Nano Banana 2.1");
  await expect(editor.locator(".ies-run-section")).toContainText("Ideogram 4.5");
  await editor.getByRole("button", { name: "Close image editor", exact: true }).click();
  await editor.getByRole("button", { name: "Discard Draft", exact: true }).click();
  await page.getByRole("button", { name: "Close preview", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const section = page.getByRole("button", { name: /User Preferences/ });
  if (await section.getAttribute("aria-expanded") !== "true") await section.click();
  const preferencesPicker = page.getByRole("combobox", { name: "Image Editor Model", exact: true });
  await expect(preferencesPicker).toHaveValue("Nano Banana 2.1");
  await preferencesPicker.selectOption("Flux 3");
  await expect.poll(() => settings.userPreferences.imageEditorModel).toBe("Flux 3");
  await expect(preferencesPicker).toHaveValue("Flux 3");
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await page.locator('[data-node-card-id="edit-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with Flux 3", exact: true }).click();
  await expect(picker).toHaveValue("Flux 3");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(picker).toBeVisible();
  const header = await editor.locator(".ies-header").boundingBox(), bounds = await picker.boundingBox();
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(header.x + header.width);
  await page.screenshot({ path: testInfo.outputPath("shared-editor-model-narrow.png") });
  expect(errors).toEqual([]);
});

test("failed preference saves keep the previous model, prompt and selection", async ({ page }) => {
  const { editor } = await editorFixture(page);
  await page.route(/\/api\/settings(?:\?.*)?$/, route => route.request().method() === "POST"
    ? route.fulfill({ status: 500, json: { error: "Preference storage unavailable" } })
    : route.fulfill({ json: { userPreferences: { imageEditorModel: "Flux 3" } } }));
  const picker = editor.getByRole("combobox", { name: "Image Editor Model", exact: true });
  await picker.selectOption("Ideogram 4.5");
  await expect(editor.getByRole("alert")).toContainText("Preference storage unavailable");
  await expect(picker).toHaveValue("Flux 3");
  await expect(picker).toBeEnabled();
  await expect(editor.getByLabel("Edit prompt")).toHaveValue("Make the jacket blue");
  expect(await alpha(editor)).toBe(255);
});

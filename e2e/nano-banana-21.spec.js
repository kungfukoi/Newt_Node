import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

for (const type of ["imageModel", "character", "coverage", "autoAspect", "storyboard", "explore"]) {
  test(`Nano Banana 2.1 remains selected in ${type} after reopening`, async ({ page }) => {
    await page.addInitScript(type => {
      if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
        nodes: [{ id: "nano21", type, x: 20, y: 20, data: { title: "Nano 2.1", model: "Nano Banana 2.1", characterSheetModel: "Nano Banana 2.1", resolution: "4K", settingsOpen: true, advancedOpen: true } }],
        edges: [], groups: [], viewport: { x: 20, y: 20, scale: 0.8 }
      }));
    }, type);
    const { errors } = await openFixture(page, { count: 1, settings: { falKeyConfigured: true, modelProviderPreferences: { imageGeneration: "fal" } } });
    if (type === "storyboard") await page.getByRole("tab", { name: "Advanced", exact: true }).click();
    const picker = page.locator('[data-node-card-id="nano21"] select').filter({ has: page.locator('option[value="Nano Banana 2.1"]') }).first();
    await expect(picker).toHaveValue("Nano Banana 2.1");
    await expect(picker.locator('option[value="Nano Banana 2.1"]')).toBeEnabled();
    await page.reload();
    await page.getByRole("button", { name: "Nodes", exact: true }).click();
    if (type === "storyboard") await page.getByRole("tab", { name: "Advanced", exact: true }).click();
    await expect(picker).toHaveValue("Nano Banana 2.1");
    expect(errors).toEqual([]);
  });
}
test("saved editor preference opens Nano Banana 2.1 without a per-edit model picker", async ({ page }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "edit-source", type: "image", x: 30, y: 30, data: { title: "Edit source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: 0.8 }
  })));
  const { errors } = await openFixture(page, { count: 1, settings: { falKeyConfigured: true, userPreferences: { imageEditorModel: "Nano Banana 2.1" } } });
  let payload;
  await page.route("**/api/node/edit-image", async (route) => {
    const request = route.request();
    payload = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    await route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", fileName: "edited.png", type: "image", provider: "fal.ai", width: 640, height: 360 } } });
  });
  await page.locator('[data-node-card-id="edit-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with Nano Banana 2.1", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Image Edit", exact: true });
  await expect(editor.getByText("Nano Banana 2.1", { exact: false })).toBeVisible();
  await expect(editor.getByRole("combobox", { name: /model/i })).toHaveCount(0);
  await editor.getByLabel("Edit prompt").fill("Make the sky blue");
  await expect(editor.getByLabel("Edit quality")).toHaveCount(0);
  await editor.getByLabel("Edit resolution").selectOption("4K");
  await page.screenshot({ path: testInfo.outputPath("nano-banana-21-editor.png") });
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect.poll(() => payload?.get("model")).toBe("Nano Banana 2.1");
  expect(payload.get("provider")).toBe("fal");
  expect(payload.get("resolution")).toBe("4K");
  await expect(editor.getByRole("button", { name: "Add Image to Canvas", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});
test("Settings saves Nano Banana 2.1 as the editor preference", async ({ page }, testInfo) => {
  const { errors } = await openFixture(page, { count: 1 });
  let settings = { version: "e2e", credentials: {}, activeCredentialIds: {}, modelProviderPreferences: { seedance: "fal", imageGeneration: "fal", minimaxH3: "fal", llm: "fal", veo: "fal" } };
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "POST") settings = { ...settings, ...route.request().postDataJSON() };
    await route.fulfill({ json: settings });
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /User Preferences/ }).click();
  await page.getByLabel("Image Editor Model", { exact: true }).selectOption("Nano Banana 2.1");
  await page.getByRole("button", { name: "Save Preferences", exact: true }).click();
  await expect.poll(() => settings.userPreferences?.imageEditorModel).toBe("Nano Banana 2.1");
  await expect(page.getByLabel("Image Editor Model", { exact: true })).toHaveValue("Nano Banana 2.1");
  const providers = page.getByRole("button", { name: /Model Providers/ });
  if (await providers.getAttribute("aria-expanded") !== "true") await providers.click();
  const images = page.locator("label.settings-field").filter({ has: page.locator("span", { hasText: /^Image Model$/ }) });
  await images.locator("select").selectOption("krea");
  await expect(images).toContainText("Krea 2 Large");
  await expect(page.getByText("Veo / Google Video", { exact: true })).toHaveCount(0);
  const videos = page.locator("label.settings-field").filter({ has: page.locator("span", { hasText: /^Video Model$/ }) });
  await videos.locator("select").selectOption("fal");
  await expect(videos.locator(".settings-provider-models")).toContainText("Gemini Omni Flash");
  await expect(videos.locator(".settings-provider-models")).not.toContainText("Seedance");
  await expect(videos.locator(".settings-provider-models")).not.toContainText("MiniMax");
  await page.screenshot({ path: testInfo.outputPath("nano-banana-21-preferences.png") });
  expect(errors).toEqual([]);
});

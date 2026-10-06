import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Settings saves the editor model and exposes Krea image routing", async ({ page }, testInfo) => {
  const { errors } = await openFixture(page, { count: 1 });
  let settings = { version: "e2e", credentials: {}, activeCredentialIds: {}, modelProviderPreferences: { seedance: "fal", imageGeneration: "fal", minimaxH3: "fal", llm: "fal", veo: "fal" } };
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "POST") settings = { ...settings, ...route.request().postDataJSON() };
    await route.fulfill({ json: settings });
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /User Preferences/ }).click();
  await page.getByLabel("Image Editor Model", { exact: true }).selectOption("Ideogram 4.5");
  await page.getByRole("button", { name: "Save Preferences", exact: true }).click();
  await expect.poll(() => settings.userPreferences?.imageEditorModel).toBe("Ideogram 4.5");
  await expect(page.getByLabel("Image Editor Model", { exact: true })).toHaveValue("Ideogram 4.5");
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
  await page.screenshot({ path: testInfo.outputPath("image-preferences.png") });
  expect(errors).toEqual([]);
});

test("saved editor preference opens Ideogram without a per-edit model picker", async ({ page }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "edit-source", type: "image", x: 30, y: 30, data: { title: "Edit source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: 0.8 }
  })));
  const { errors } = await openFixture(page, { count: 1, settings: { falKeyConfigured: true, userPreferences: { imageEditorModel: "Ideogram 4.5" } } });
  let payload;
  await page.route("**/api/node/edit-image", async (route) => {
    const request = route.request();
    payload = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    await route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", fileName: "edited.png", type: "image", provider: "fal.ai", width: 640, height: 360 } } });
  });
  await page.locator('[data-node-card-id="edit-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with Ideogram 4.5", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Image Edit", exact: true });
  await expect(editor.getByText("Ideogram 4.5 Precise Edit", { exact: false })).toBeVisible();
  await expect(editor.getByRole("combobox", { name: /model/i })).toHaveCount(0);
  await editor.getByLabel("Edit prompt").fill("Make the sky blue");
  await editor.getByLabel("Edit quality").selectOption("medium");
  await page.screenshot({ path: testInfo.outputPath("ideogram-editor.png") });
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect.poll(() => payload?.get("model")).toBe("Ideogram 4.5");
  expect(payload.get("provider")).toBe("fal");
  expect(payload.get("quality")).toBe("medium");
  await expect(editor.getByRole("button", { name: "Add Image to Canvas", exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

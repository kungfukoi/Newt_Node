import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Text Agent model can be saved independently and reloaded", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 1 });
  let settings = { version: "e2e", credentials: {}, activeCredentialIds: {}, userPreferences: { directorProcessingModel: "astra" } };
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "POST") settings = { ...settings, ...route.request().postDataJSON() };
    await route.fulfill({ json: settings });
  });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /User Preferences/ }).click();
  const selector = page.getByLabel("Text Agent Model", { exact: true });
  await expect(selector).toHaveValue("sol");
  for (const model of ["astra", "sol"]) {
    await selector.selectOption(model);
    await page.getByRole("button", { name: "Save Preferences", exact: true }).click();
    await expect.poll(() => settings.userPreferences.textAgentModel).toBe(model);
    await expect(page.getByRole("button", { name: "Save Preferences", exact: true })).toBeEnabled();
    expect(settings.userPreferences.directorProcessingModel).toBe("astra");
  }
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const section = page.getByRole("button", { name: /User Preferences/ });
  if (await section.getAttribute("aria-expanded") !== "true") await section.click();
  await expect(selector).toHaveValue("sol");
  expect(errors).toEqual([]);
});

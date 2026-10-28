import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

for (const explicit of [false, true]) test(`resized Text Agent fields stay adjacent with ${explicit ? "saved field sizes" : "automatic sizing"}`, async ({ page }, testInfo) => {
  const node = { id: "agent", type: "textAgent", x: 40, y: 30, data: { title: "Text Agent", nodeWidth: 650, nodeHeight: 720,
    agentDraft: "Keep the subject and change the background", resultText: "A detailed prompt. ".repeat(100), lastRunModel: "fixture", batchResults: [],
    ...(explicit ? { textareaResizeMode: true, textareaHeights: { "0:Text Agent response": 150, "1:Message Text Agent": 110 } } : {}) } };
  await page.addInitScript(node => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [node], edges: [], groups: [], viewport: { x: 20, y: 20, scale: .7 } })); }, node);
  const { errors } = await openFixture(page, { count: 1 });
  const card = page.locator('[data-node-card-id="agent"]');
  const response = card.getByLabel("Text Agent response", { exact: true });
  const message = card.getByLabel("Message Text Agent", { exact: true });
  const gap = () => card.evaluate(element => { const response = element.querySelector(".text-agent-response").getBoundingClientRect(); const composer = element.querySelector(".text-agent-composer").getBoundingClientRect(); const divider = element.querySelector(".text-split-divider").getBoundingClientRect(); return composer.top - response.bottom - divider.height; });
  expect(await gap()).toBeLessThan(2);
  const originalResponse = await response.boundingBox(), originalMessage = await message.boundingBox();
  const divider = card.getByRole("separator", { name: "Response and user prompt split" });
  const initialSplit = Number(await divider.getAttribute("aria-valuenow"));
  const handle = await card.getByRole("button", { name: "Resize node", exact: true }).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + 60, handle.y + 130, { steps: 8 }); await page.mouse.up();
  expect((await response.boundingBox()).height).toBeGreaterThan(originalResponse.height + 20);
  expect((await message.boundingBox()).height).toBeGreaterThan(originalMessage.height + 15);
  expect(Number(await divider.getAttribute("aria-valuenow"))).toBe(initialSplit);
  expect(await gap()).toBeLessThan(2);
  const footer = await card.locator(".batch-result-controls").boundingBox();
  expect(footer.height).toBeLessThan(40);
  const bounds = await card.boundingBox();
  expect(footer.y + footer.height).toBeLessThanOrEqual(bounds.y + bounds.height);
  await expect(message).toHaveValue(node.data.agentDraft);
  const responseBeforeSplit = (await response.boundingBox()).height;
  const messageBeforeSplit = (await message.boundingBox()).height;
  const splitHandle = await divider.boundingBox();
  await page.mouse.move(splitHandle.x + splitHandle.width / 2, splitHandle.y + splitHandle.height / 2); await page.mouse.down();
  await page.mouse.move(splitHandle.x + splitHandle.width / 2, splitHandle.y - 45, { steps: 8 }); await page.mouse.up();
  expect((await response.boundingBox()).height).toBeLessThan(responseBeforeSplit - 25);
  expect((await message.boundingBox()).height).toBeGreaterThan(messageBeforeSplit + 25);
  expect(await gap()).toBeLessThan(2);
  await divider.focus(); await page.keyboard.press("ArrowDown");
  const finalSplit = Number(await divider.getAttribute("aria-valuenow"));
  await page.screenshot({ path: testInfo.outputPath("text-agent-normalized.png") });
  const height = (await message.boundingBox()).height;
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes[0].data.nodeHeight)).toBeGreaterThan(720);
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  expect((await message.boundingBox()).height).toBeCloseTo(height, 0);
  expect(Number(await divider.getAttribute("aria-valuenow"))).toBe(finalSplit);
  expect(await gap()).toBeLessThan(2);
  await expect(message).toHaveValue(node.data.agentDraft);
  expect(errors).toEqual([]);
});

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

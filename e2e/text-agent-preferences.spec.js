import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Text Agent revisions include the current prompt and latest downstream generation after reload", async ({ page }) => {
  const fixture = { groups: [], viewport: { x: 20, y: 20, scale: .8 }, nodes: [
    { id: "agent", type: "textAgent", x: 20, y: 20, data: { title: "Text Agent", resultText: "A fox in snow, manually revised.", agentDraft: "The fox came out too small. Bring it closer." } },
    { id: "render", type: "imageModel", x: 1000, y: 20, data: { title: "Render", model: "OpenAI Image 2.6 Flare", resultUrl: "/outputs/e2e/old.png", resultItems: [
      { url: "/outputs/e2e/old.png", type: "image" },
      { url: "/outputs/e2e/latest.png", type: "image", prompt: "A fox in snow." }
    ] } }
  ], edges: [{ id: "prompt-render", from: { nodeId: "agent", port: "promptOut" }, to: { nodeId: "render", port: "promptIn" } }] };
  await page.addInitScript(value => {
    if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(value));
  }, fixture);
  const { errors } = await openFixture(page, { count: 2 });
  const submitted = [];
  let generationCount = 0;
  await page.route("**/api/node/generate-image", async route => { generationCount += 1; await route.fulfill({ json: {} }); });
  await page.route("**/api/node/process-text", async route => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({ json: { text: "A close view of a fox in snow, manually revised.", model: "fixture" } });
  });
  const agent = page.locator('[data-node-card-id="agent"]');
  await agent.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => submitted.length).toBe(1);
  expect(submitted[0].messages.at(-1).text).toBe("A fox in snow, manually revised.");
  expect(submitted[0].imageInputs.map(item => item.url)).toEqual(["/outputs/e2e/latest.png"]);
  expect(submitted[0].textInputs.some(item => item.text.includes("A fox in snow."))).toBe(true);
  await expect(agent.getByLabel("Text Agent response", { exact: true })).toHaveValue("A close view of a fox in snow, manually revised.");
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await agent.getByLabel("Message Text Agent", { exact: true }).fill("Keep the snow, soften the lighting.");
  await agent.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => submitted.length).toBe(2);
  expect(submitted[1].messages.at(-1).text).toBe("A close view of a fox in snow, manually revised.");
  expect(submitted[1].imageInputs.map(item => item.url)).toEqual(["/outputs/e2e/latest.png"]);
  expect(generationCount).toBe(0);
  expect(errors).toEqual([]);
});

test("Enter formats the Text Agent user prompt and only Send submits it", async ({ page }) => {
  const node = { id: "agent", type: "textAgent", x: 20, y: 20, data: { title: "Text Agent", agentDraft: "" } };
  await page.addInitScript(node => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [node], edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 } })), node);
  const { errors } = await openFixture(page, { count: 1 });
  const submitted = [];
  await page.route("**/api/node/process-text", async route => { submitted.push(route.request().postDataJSON()); await route.fulfill({ json: { text: "Formatted response", model: "fixture" } }); });
  const agent = page.locator('[data-node-card-id="agent"]');
  const field = agent.getByLabel("Message Text Agent", { exact: true });
  await field.fill("First line"); await field.press("Enter"); await field.pressSequentially("Second line"); await field.press("Shift+Enter"); await field.pressSequentially("Third line");
  await expect(field).toHaveValue("First line\nSecond line\nThird line");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes[0].data.agentDraft)).toBe("First line\nSecond line\nThird line");
  expect(submitted).toHaveLength(0);
  await agent.getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(() => submitted.length).toBe(1);
  expect(submitted[0].text).toContain("First line\nSecond line\nThird line");
  expect(errors).toEqual([]);
});

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
  await section.click();
  await expect(selector).toHaveValue("sol");
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture, wireAttachmentErrors } from "./helpers.mjs";

const settings = { falKeyConfigured: true, modelProviderPreferences: { imageGeneration: "fal", llm: "fal" } };
const direction = name => ({ name, concept: `${name} concept`, composition: "Wide", lighting: "Soft", palette: "Warm", treatment: "Editorial", styleBrief: "Warm editorial light", prompt: `${name} image of the bottle` });
const nodeCard = (page, id) => page.locator(`[data-node-card-id="${id}"]`);

async function seed(page, nodes, edges = []) {
  await page.addInitScript(({ nodes, edges }) => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes, edges, groups: [], viewport: { x: 20, y: 20, scale: 0.8 } })); }, { nodes, edges });
  return openFixture(page, { count: nodes.length, settings });
}

test("Explore plans, pauses, resumes and refines while preserving Preview connections", async ({ page }, testInfo) => {
  const edges = [{ id: "explore-preview", from: { nodeId: "explore", port: "imageOut" }, to: { nodeId: "preview", port: "sourceIn" } }];
  const { errors } = await seed(page, [
    { id: "explore", type: "explore", x: 20, y: 20, data: { title: "Explore", prompt: "A perfume bottle", directionCount: 3, settingsOpen: true } },
    { id: "preview", type: "preview", x: 760, y: 20, data: { title: "Explore preview" } }
  ], edges);
  const card = nodeCard(page, "explore");
  await expect(card.getByLabel("Explore image model")).toHaveValue("OpenAI Image 2.5 Flare");
  await card.getByLabel("Explore image model").selectOption("OpenAI Image 2.5 Sunburst");
  await expect(card.getByLabel("Variant", { exact: true })).toHaveCount(0);
  let plans = [], images = [], release;
  await page.route("**/api/node/explore-plan", async route => {
    const request = route.request().postDataJSON(); plans.push(request);
    await route.fulfill({ json: { directions: Array.from({ length: request.count }, (_, i) => direction(`Look ${plans.length}-${i + 1}`)) } });
  });
  await page.route("**/api/node/generate-image", async route => {
    images.push(route.request().postDataJSON());
    if (images.length === 1) await new Promise(resolve => { release = resolve; });
    await route.fulfill({ json: { images: [{ localUrl: `/outputs/e2e/look-${images.length}.png`, mimeType: "image/png" }] } });
  });
  await card.getByRole("button", { name: /^Explore 3 images/ }).click();
  await expect.poll(() => images.length).toBe(1);
  await card.getByRole("button", { name: "Stop remaining generations" }).click();
  release();
  await expect(card.getByRole("button", { name: "Resume 2" })).toBeVisible();
  expect(images[0].model).toBe("OpenAI Image 2.5 Sunburst");
  expect(images[0].openAiImageVariant).toBe("sunburst");
  await card.getByRole("button", { name: "Resume 2" }).click();
  await expect(card.locator(".explore-result")).toHaveCount(3);
  await expect(card.getByRole("button", { name: /^More Like This/ })).toBeEnabled();
  expect(plans).toHaveLength(1);
  expect(images).toHaveLength(3);
  await card.getByRole("button", { name: /^More Like This/ }).click();
  await expect(card.locator(".explore-result")).toHaveCount(4);
  expect(plans).toHaveLength(1);
  expect(images[3].imagePromptUrls).toHaveLength(1);
  await card.getByRole("button", { name: "Refine", exact: true }).click();
  await card.getByLabel("Branch direction").fill("Make the lighting softer");
  await card.getByRole("button", { name: /^Refine \(/ }).click();
  await expect(card.locator(".explore-result")).toHaveCount(5);
  expect(plans.at(-1).action).toBe("refine");
  expect(plans.at(-1).note).toBe("Make the lighting softer");
  await card.getByRole("button", { name: "References", exact: true }).click();
  await expect(card.locator('[data-port-key="explore:imageIn"]')).toBeVisible();
  await expect.poll(async () => (await wireAttachmentErrors(page, edges)).every(edge => !edge.missing && edge.start < 5 && edge.end < 5)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("explore.png") });
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "explore").data.resultItems?.length || 0)).toBe(5);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(card.locator(".explore-result")).toHaveCount(5);
  await expect(card.getByLabel("Explore image model")).toHaveValue("OpenAI Image 2.5 Sunburst");
  expect(errors).toEqual([]);
});

test("old variant fields migrate and both choices reach all existing image model selectors", async ({ page }) => {
  const { errors } = await seed(page, [
    { id: "model", type: "imageModel", x: 20, y: 20, data: { title: "Legacy Sunburst", model: "OpenAI Image 2.5", openAiImageVariant: "sunburst", prompt: "A bottle", settingsOpen: true } },
    { id: "board", type: "storyboard", x: 850, y: 20, data: { title: "Board", storyboardTab: "advanced", model: "OpenAI Image 2.5", openAiImageVariant: "sunburst" } }
  ]);
  const card = nodeCard(page, "model");
  await expect(card.locator("select").filter({ has: page.locator('option:checked', { hasText: /^OpenAI Image 2.5 Sunburst$/ }) })).toHaveCount(1);
  await expect(card.getByText("Variant", { exact: true })).toHaveCount(0);
  const board = nodeCard(page, "board");
  await expect(board.getByLabel("Storyboard image model")).toHaveValue("OpenAI Image 2.5 Sunburst");
  await board.getByLabel("Storyboard image model").selectOption("OpenAI Image 2.5 Flare");
  await board.getByLabel("Storyboard image model").selectOption("Flux 3");
  await expect(board.getByLabel("Storyboard image model")).toHaveValue("Flux 3");
  const modelPicker = card.locator("select").filter({ has: page.locator('option:checked', { hasText: /^OpenAI Image 2.5 Sunburst$/ }) });
  await modelPicker.selectOption("Flux 3");
  await expect(card.locator("select").filter({ has: page.locator('option:checked', { hasText: /^Flux 3$/ }) })).toHaveCount(1);
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: /User Preferences/ }).click();
  const editor = page.getByLabel("Image Editor Model", { exact: true });
  await expect(editor.locator("option")).toHaveText(["OpenAI Image 2.5 Sunburst", "OpenAI Image 2.5 Flare", "Ideogram 4.5", "Flux 3", "Nano Banana 2.1"]);
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture, wireAttachmentErrors } from "./helpers.mjs";
import { gradePresetPrompts } from "../src/colorLook.js";

test("Style and Mood Board selections create typed batches that run matching pairs after reload", async ({ page }) => {
  const nodes = [
    ...["A", "B"].map((name, index) => ({ id: `style-${name}`, type: "style", x: 20, y: 30 + index * 260,
      data: { title: `Style ${name}`, gradePreset: name === "A" ? "Warm" : "Cool", libraryStyle: { id: name, name, prompt: `Distinct treatment ${name}` } } })),
    ...["A", "B"].map((name, index) => ({ id: `board-${name}`, type: "transfer", x: 20, y: 560 + index * 260,
      data: { title: `Board ${name}`, locked: true, activated: true, resultUrl: `/outputs/e2e/board-${name}.png`, libraryBoardPrompt: `Board direction ${name}` } })),
    { id: "model", type: "imageModel", x: 800, y: 100, data: { title: "Image Model", model: "Nano Banana Pro", aspectRatio: "1:1", resolution: "1K", prompt: "A house on a hill", batchCount: "1", settingsOpen: true } }
  ];
  await page.addInitScript(nodes => {
    const key = "seedance-node-editor-draft-v1";
    if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify({ nodes, edges: [], groups: [], viewport: { x: 30, y: 30, scale: .75 } }));
  }, nodes);
  const { errors } = await openFixture(page, { count: nodes.length, settings: { falKeyConfigured: true, modelProviderPreferences: { imageGeneration: "fal" } } });
  const title = id => page.locator(`[data-node-card-id="${id}"] .node-title-label > svg`);
  const makeBatch = async (prefix, label) => {
    await title(`${prefix}-B`).click();
    await title(`${prefix}-A`).click({ modifiers: ["Shift"] });
    await page.locator(".selection-action-bar").getByRole("button", { name: "Batch", exact: true }).click();
    const batch = page.locator(".batch-body").filter({ hasText: `${label} Batch output` });
    const entry = prefix === "style" ? "Style" : "Board";
    await expect(batch.locator(".batch-entry strong")).toHaveText([`${entry} A`, `${entry} B`]);
    await batch.getByRole("button", { name: `Move ${entry} B up` }).click();
    await expect(batch.locator(".batch-entry strong")).toHaveText([`${entry} B`, `${entry} A`]);
    return batch;
  };
  const styles = await makeBatch("style", "Style");
  const boards = await makeBatch("board", "Mood Board");
  const model = page.locator('[data-node-card-id="model"]');
  async function connect(batch, input) {
    const from = await batch.locator('[data-port-role="output"]').boundingBox({ timeout: 10000 });
    const to = await model.locator(`[data-port-role="input"][data-port-id="${input}"]`).boundingBox({ timeout: 10000 });
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
    await page.mouse.up();
  }
  await connect(styles, "styleIn");
  await connect(boards, "transferIn");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).edges
    .filter(edge => edge.to.nodeId === "model").map(edge => edge.to.port).sort())).toEqual(["styleIn", "transferIn"]);
  await page.reload();
  const submitted = [];
  await page.route("**/api/node/generate-image", route => {
    const request = route.request().postDataJSON();
    submitted.push(request);
    return route.fulfill({ json: { images: [{ localUrl: `/outputs/e2e/result-${submitted.length}.png`, mimeType: "image/png" }] } });
  });
  await model.getByRole("button", { name: /^Run Batch/ }).click();
  await expect.poll(() => submitted.length).toBe(2);
  await expect(model.getByRole("button", { name: /^Run Batch/ })).toBeEnabled();
  for (const name of ["A", "B"]) {
    const request = submitted.find(item => item.imagePromptUrls.includes(`/outputs/e2e/board-${name}.png`));
    expect(request.imagePromptUrls).toEqual([`/outputs/e2e/board-${name}.png`]);
    expect(request.prompt).toContain("A house on a hill");
    expect(request.prompt).toContain(`Distinct treatment ${name}`);
    expect(request.prompt).toContain(`Board direction ${name}`);
    expect(request.prompt).toContain(gradePresetPrompts[name === "A" ? "Warm" : "Cool"]);
    expect(request.prompt).not.toContain(`Distinct treatment ${name === "A" ? "B" : "A"}`);
  }
  expect(errors).toEqual([]);
});

test("Batch keeps live sources and entry prompts, runs in parallel and survives reload", async ({ page }, testInfo) => {
  const nodes = [
    ...["a", "b", "c", "d"].map((id, index) => ({ id, type: "image", x: 20, y: index * 270, data: { title: `Source ${id}`, resultUrl: `/outputs/e2e/${id}.png` } })),
    { id: "batch", type: "batch", x: 390, y: 20, data: { title: "Batch", nodeWidth: 310, nodeHeight: 440, batchOrder: ["b:imageOut", "a:imageOut"], batchSettings: { "a:imageOut": { prompt: "Red backdrop" } } } },
    { id: "model", type: "imageModel", x: 830, y: 20, data: { title: "Batch Image Model", model: "Nano Banana 2", aspectRatio: "1:1", resolution: "1K", prompt: "Preserve the product", batchCount: "1", settingsOpen: false } }
  ];
  const edges = [
    ...["a", "b", "c", "d"].map(id => ({ id: `${id}-batch`, from: { nodeId: id, port: "imageOut" }, to: { nodeId: "batch", port: "imageIn" } })),
    { id: "batch-model", from: { nodeId: "batch", port: "batchOut" }, to: { nodeId: "model", port: "imagePromptIn" } }
  ];
  await page.addInitScript(({ nodes, edges }) => {
    if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes, edges, groups: [], viewport: { x: 20, y: 20, scale: .8 } }));
  }, { nodes, edges });
  const { errors } = await openFixture(page, { count: nodes.length, settings: { falKeyConfigured: true, modelProviderPreferences: { imageGeneration: "fal", llm: "fal" } } });
  const batch = page.locator('[data-node-card-id="batch"]'), model = page.locator('[data-node-card-id="model"]');
  await expect(batch.locator(".batch-entry")).toHaveCount(4);
  await expect(batch.getByRole("button", { name: /^Move .* (up|down)$/ })).toHaveCount(0);
  await expect(batch).not.toContainText("Up to 3 entries");
  const rowLayout = await batch.locator(".batch-entry").first().evaluate(row => {
    const image = row.querySelector("img").getBoundingClientRect();
    const caption = row.querySelector(".batch-entry-caption").getBoundingClientRect();
    const remove = row.querySelector(".batch-entry-remove").getBoundingClientRect();
    return { clear: image.right <= caption.left && caption.right <= remove.left, captionWidth: caption.width, fit: getComputedStyle(row.querySelector("img")).objectFit };
  });
  expect(rowLayout.clear).toBe(true); expect(rowLayout.captionWidth).toBeGreaterThan(50); expect(rowLayout.fit).toBe("contain");
  await batch.locator(".batch-entry-select").first().click();
  await batch.getByLabel("Entry prompt").fill("Blue backdrop");
  let active = 0, maximum = 0;
  const submitted = [];
  await page.route("**/api/node/generate-image", async route => {
    const request = route.request().postDataJSON(); submitted.push(request);
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 180)); active--;
    if (request.imagePromptUrls.includes("/outputs/e2e/c.png") && submitted.length <= 4) return route.fulfill({ status: 500, json: { error: "Mock provider failure" } });
    await route.fulfill({ json: { images: [{ localUrl: `/outputs/e2e/result-${request.generationBatchIndex}.png`, mimeType: "image/png" }] } });
  });
  await model.getByRole("button", { name: /^Run Batch/ }).click();
  await expect.poll(() => submitted.length).toBe(4);
  await expect(model.getByRole("button", { name: /^Run Batch/ })).toBeEnabled();
  expect(maximum).toBeGreaterThan(1); expect(maximum).toBeLessThanOrEqual(3);
  expect(submitted[0].imagePromptUrls).toEqual(["/outputs/e2e/b.png"]);
  expect(submitted[0].prompt).toContain("Blue backdrop");
  expect(submitted[1].prompt).toContain("Red backdrop");
  expect(submitted.every(item => item.prompt.includes("Preserve the product"))).toBe(true);
  await expect(model.getByRole("button", { name: "Retry Source c · 1" })).toBeVisible();
  await model.getByRole("button", { name: "Retry Source c · 1" }).click();
  await expect.poll(() => submitted.length).toBe(5);
  await expect(model.getByRole("button", { name: "Retry Source c · 1" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "model").data.resultItems || []).map(item => item.batchSourceId))).toEqual(["b:imageOut", "a:imageOut", "c:imageOut", "d:imageOut"]);
  await batch.getByRole("button", { name: "Remove Source c from batch" }).click();
  await expect(batch.locator(".batch-entry")).toHaveCount(3);
  await expect(page.locator('[data-node-card-id="c"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).edges.length)).toBe(4);
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(batch.locator(".batch-entry")).toHaveCount(3);
  await expect(batch.locator(".batch-entry").first()).toContainText("Blue backdrop");
  await expect.poll(async () => (await wireAttachmentErrors(page, edges.filter(edge => edge.id !== "c-batch"))).every(edge => !edge.missing && edge.start < 5 && edge.end < 5)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("batch-audition.png") });
  await batch.screenshot({ path: testInfo.outputPath("batch-cleanup.png") });
  expect(errors).toEqual([]);
});

test("selection creates a linked Batch and uploaded files append without replacing sources", async ({ page }) => {
  const nodes = ["a", "b"].map((id, index) => ({ id, type: "image", x: 20 + index * 340, y: 20, data: { title: `Image ${id}`, resultUrl: `/outputs/e2e/${id}.png` } }));
  await page.addInitScript(nodes => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes, edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 } })), nodes);
  await openFixture(page, { count: 2 });
  await page.getByRole("button", { name: "Show node palette", exact: true }).click();
  await expect(page.locator(".node-catalog").getByRole("button", { name: "Batch", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Hide node palette", exact: true }).click();
  await page.locator(".node-canvas").click({ button: "right", position: { x: 1300, y: 800 } });
  await expect(page.locator(".node-context-menu")).toBeVisible();
  await expect(page.locator(".node-context-menu").getByRole("button", { name: "Batch", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator('[data-node-card-id="a"] .node-title-label > svg').click();
  await expect(page.locator(".selection-action-bar").getByRole("button", { name: "Batch", exact: true })).toHaveCount(0);
  await page.locator('[data-node-card-id="b"] .node-title-label > svg').click({ modifiers: ["Shift"] });
  await page.locator(".selection-action-bar").getByRole("button", { name: "Batch", exact: true }).click();
  const batch = page.locator(".batch-body");
  await expect(batch.locator(".batch-entry")).toHaveCount(2);
  await page.route("**/api/node/upload-asset", route => route.fulfill({ json: { asset: { localUrl: "/outputs/e2e/upload.png", fileName: "upload.png", mimeType: "image/png" } } }));
  const droppedFiles = await page.evaluateHandle(() => { const transfer = new DataTransfer(); transfer.items.add(new File(["mock image"], "landscape.png", { type: "image/png" })); return transfer; });
  await batch.dispatchEvent("drop", { dataTransfer: droppedFiles });
  await expect(batch.getByText("+ Add files", { exact: true })).toHaveCount(0);
  await expect(batch.getByRole("button", { name: "+ Selected nodes", exact: true })).toHaveCount(0);
  await expect(batch.locator(".batch-entry")).toHaveCount(3);
  await expect(page.locator(".react-flow__node")).toHaveCount(3);
  await page.locator('[data-node-card-id="a"] input[type="file"]').setInputFiles("e2e/.generated/landscape.png");
  await expect(batch.locator(".batch-entry").first().locator("img")).toHaveAttribute("src", "/outputs/e2e/upload.png");
});

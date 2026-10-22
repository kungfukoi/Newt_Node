import { test, expect } from "@playwright/test";
import { openFixture, wireAttachmentErrors } from "./helpers.mjs";

const passes = Object.fromEntries(["alpha", "fg", "checker", "cutout"].map(pass => [pass, { type: "video", label: pass, url: `/outputs/e2e/${pass}.mp4` }]));
const result = { ...passes.cutout, keyer: { passes, settings: { mode: "auto", despill: .5, frameLimit: 0 } } };

async function setup(page, { completed = false, reconnect = false, scale = .7, legacy = false } = {}) {
  await page.addInitScript(({ result, completed, reconnect, scale, legacy }) => {
    if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return;
    sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
      { id: "source", type: "video", x: 15, y: 20, data: { title: "Plate", resultUrl: "/outputs/e2e/source.mp4", resultType: "video", status: "complete" } },
      { id: "keyer", type: legacy ? "keyer" : "utility", x: 430, y: 20, data: { title: legacy ? "Keyer" : "Utility", utilityMode: "video", utilityVideoModel: "CorridorKey 2.0", settingsOpen: true, sourceVideoUrl: "/outputs/e2e/upload.mp4", keyerJobId: reconnect ? "previous" : "", ...(completed ? { resultItems: [result], resultUrl: result.url, selectedResultIndex: 0, status: "complete" } : {}) } },
      { id: "output", type: "output", x: 880, y: 20, data: { title: "Matte Output", outputPath: "C:/fixtures/outputs", outputFileName: "matte" } }
    ], edges: [
      { id: "source-wire", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "keyer", port: "videoIn" } },
      { id: "matte-wire", from: { nodeId: "keyer", port: "matteOut" }, to: { nodeId: "output", port: "sourceIn" } }
    ], groups: [], viewport: { x: 10, y: 10, scale } }));
  }, { result, completed, reconnect, scale, legacy });
  const fixture = await openFixture(page, { count: 3 });
  await page.route("**/api/keyer/status", route => route.fulfill({ json: { ready: true, busy: false, message: "Local engine configured" } }));
  const node = page.locator('[data-node-card-id="keyer"]');
  await node.getByRole("button", { name: "Refresh Keyer engine" }).click();
  await expect(node.locator('[role="status"].keyer-status')).toHaveText("Local engine configured");
  return { ...fixture, node };
}

test("Keyer controls persist and hint modes retain stable handles", async ({ page }) => {
  const { node, errors } = await setup(page);
  await expect(node.locator('input[type="file"]')).toHaveCount(0);
  await expect(node.locator('[data-port-role="output"]')).toHaveCount(3);
  await node.getByLabel("Keyer hint mode").selectOption("first");
  await expect(node.getByRole("button", { name: "Run Keyer", exact: true })).toBeDisabled();
  await node.getByLabel("Keyer GPU memory").selectOption("low");
  await node.getByLabel("Keyer test frames").fill("48");
  await node.getByLabel("Keyer hint mode").selectOption("auto");
  await expect(node.getByRole("button", { name: "Test key · first 48 frames" })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "keyer").data.keyerFrameLimit)).toBe("48");
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(node.getByLabel("Keyer GPU memory")).toHaveValue("low");
  await expect(node.getByLabel("Keyer test frames")).toHaveValue("48");
  await expect(node.locator('[data-port-role="output"]')).toHaveCount(3);
  const fit = await node.locator(".keyer-node-body").evaluate(el => el.scrollWidth <= el.clientWidth + 2);
  expect(fit).toBe(true); expect(errors).toEqual([]);
});

test("missing components offer automatic setup while Mac disables CUDA runs", async ({ page }) => {
  const { node } = await setup(page);
  await page.route("**/api/keyer/status", route => route.fulfill({ json: { ready: false, canInstall: true, busy: false, message: "Install missing components on Run" } }));
  await node.getByRole("button", { name: "Refresh Keyer engine" }).click();
  await expect(node.getByRole("button", { name: "Install & Run Keyer", exact: true })).toBeEnabled();
  await page.route("**/api/keyer/status", route => route.fulfill({ json: { ready: false, canInstall: false, busy: false, message: "The Python engine requires CUDA and cannot run on macOS" } }));
  await node.getByRole("button", { name: "Refresh Keyer engine" }).click();
  await expect(node.getByRole("button", { name: "Run Keyer", exact: true })).toBeDisabled();
  await expect(node.locator('[role="status"].keyer-status')).toContainText("macOS");
});

test("Utility model switching preserves the source connection and restores CorridorKey controls", async ({ page }) => {
  const { node, errors } = await setup(page);
  const selector = node.getByLabel("Utility video model");
  const visible = await selector.locator("option").evaluateAll(options => options.filter(option => !option.hidden && !option.disabled).map(option => option.textContent));
  expect(visible).toContain("CorridorKey 2.0");
  for (const name of ["Extract Frame", "Wan VACE Mask-to-Video", "Wan VACE 14B Inpainting"]) expect(visible).not.toContain(name);
  await selector.selectOption("BiRefNet Video");
  await expect(node.locator('[data-port-id="referenceVideoIn"]')).toHaveCount(1);
  await expect.poll(() => page.locator('[data-edge-id="source-wire"] .newt-flow-edge-visible').count()).toBe(1);
  await selector.selectOption("CorridorKey 2.0");
  await expect(node.getByRole("button", { name: "Run Keyer", exact: true })).toBeVisible();
  await expect(node.locator('input[type="file"]')).toHaveCount(0);
  await expect(node.locator('[data-port-id="videoIn"]')).toHaveCount(1);
  await expect.poll(() => page.locator('[data-edge-id="source-wire"] .newt-flow-edge-visible').count()).toBe(1);
  expect(errors).toEqual([]);
});

test("Video disclosure collapses the node while preserving connections and saved state", async ({ page }) => {
  const { node, errors } = await setup(page, { completed: true });
  const expanded = await node.boundingBox();
  const section = node.locator(".keyer-video-section");
  await section.locator(":scope > summary").click();
  await expect(node.getByLabel("Utility video model")).toHaveCount(0);
  await expect(node.locator('[data-port-role="input"]')).toHaveCount(3);
  await expect(node.locator('[data-port-role="output"]')).toHaveCount(3);
  await expect.poll(async () => (await node.boundingBox()).height).toBeLessThan(expanded.height * .6);
  await expect(node.getByRole("button", { name: "Run Keyer", exact: true })).toBeEnabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "keyer").data.keyerVideoOpen)).toBe(false);
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(section).not.toHaveAttribute("open", "");
  await expect(node.getByLabel("Utility video model")).toHaveCount(0);
  await expect(page.locator('[data-edge-id="matte-wire"] .newt-flow-edge-visible')).toHaveCount(1);
  await section.locator(":scope > summary").click();
  await expect(node.getByLabel("Utility video model")).toHaveValue("CorridorKey 2.0");
  await expect(node.locator(".result-item video")).toHaveAttribute("src", /checker\.mp4/);
  await expect(node.locator('input[type="file"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("legacy Keyer loads as Utility with its selected matte port and results preserved", async ({ page }) => {
  const { node, errors } = await setup(page, { legacy: true, completed: true });
  await expect(node.getByLabel("Utility video model")).toHaveValue("CorridorKey 2.0");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "keyer").type)).toBe("utility");
  await expect(node.locator(".result-item video")).toHaveAttribute("src", /checker\.mp4/);
  await expect(page.locator('[data-edge-id="matte-wire"] .newt-flow-edge-visible')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("retired Utility selections keep saved results and disable generation", async ({ page }) => {
  const names = ["Extract Frame", "Wan VACE Mask-to-Video", "Wan VACE 14B Inpainting"];
  await page.addInitScript(names => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: names.map((name, index) => ({ id: `retired-${index}`, type: "utility", x: 20 + index * 500, y: 20, data: { title: name, utilityMode: "video", utilityVideoModel: name, settingsOpen: true, status: "complete", resultUrl: "/outputs/e2e/previous.mp4", resultItems: [{ type: "video", url: "/outputs/e2e/previous.mp4" }] } })), edges: [], groups: [], viewport: { x: 10, y: 10, scale: .7 } })), names);
  const { errors } = await openFixture(page, { count: 3 });
  for (let index = 0; index < names.length; index++) {
    const node = page.locator(`[data-node-card-id="retired-${index}"]`);
    await expect(node.getByText("This model is disabled. Choose an available model. Saved results are preserved.")).toBeVisible();
    await expect(node.locator(".run-node-button")).toBeDisabled();
    await expect(node.getByLabel("Utility video model")).toHaveValue(names[index]);
    await expect(node.locator(".result-item video")).toHaveAttribute("src", /previous\.mp4/);
  }
  expect(errors).toEqual([]);
});

test("Keyer runs connected source once and Matte output never resolves the Cutout", async ({ page }) => {
  const { node, errors } = await setup(page);
  let body, starts = 0, polls = 0, saved;
  await page.route("**/api/node/keyer", route => { starts++; body = route.request().postDataJSON(); return route.fulfill({ status: 202, json: { jobId: "key-test" } }); });
  await page.route("**/api/keyer/jobs/key-test", route => route.fulfill({ json: ++polls === 1 ? { state: "running", message: "Temporal processing: window 1/1" } : { state: "complete", item: result } }));
  await page.route("**/api/node/save-output", route => { saved = route.request().postDataJSON(); return route.fulfill({ json: { output: { localUrl: "/outputs/e2e/saved.mp4", mediaType: "video" } } }); });
  await node.getByRole("button", { name: "Run Keyer", exact: true }).click();
  await expect(node.locator('[role="status"].keyer-status')).toContainText("Temporal processing");
  await expect(node.locator(".result-item video")).toHaveAttribute("src", /checker\.mp4/);
  expect(starts).toBe(1); expect(body.sourceVideoUrl).toBe("/outputs/e2e/source.mp4");
  expect(body.outputTargetNodeId).toBe("");
  // Changing viewer tab must never change the port that Output saves.
  await node.getByRole("button", { name: "Foreground", exact: true }).click();
  const out = page.locator('[data-node-card-id="output"]');
  await out.locator(".run-node-button").click();
  await expect.poll(() => saved?.sourceUrl).toBe(passes.alpha.url);
  expect(starts).toBe(1);
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(node.locator(".result-item video")).toHaveAttribute("src", /fg\.mp4/);
  expect(errors).toEqual([]);
});

test("Keyer reconnect tracks an existing job without resubmission", async ({ page }) => {
  const { node, errors } = await setup(page, { reconnect: true }); let starts = 0;
  await page.route("**/api/node/keyer", route => { starts++; return route.abort(); });
  await page.route("**/api/keyer/jobs/previous", route => route.fulfill({ json: { state: "complete", item: result } }));
  await node.getByRole("button", { name: "Reconnect to previous key" }).click();
  await expect(node.locator(".result-item video")).toHaveAttribute("src", /checker\.mp4/);
  expect(starts).toBe(0); expect(errors).toEqual([]);
});

for (const scale of [.05, .08, .15, .3, 1]) test(`Keyer ports and full media at ${scale * 100}% zoom and resize`, async ({ page }) => {
  const { node, errors } = await setup(page, { completed: true, scale });
    await expect(page.getByRole("button", { name: "Reset zoom" })).toHaveText(`${Math.round(scale * 100)}%`);
    await expect(node.locator('[data-port-role="output"]')).toHaveCount(3);
    const attachments = await wireAttachmentErrors(page, [{ id: "source-wire", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "keyer", port: "videoIn" } }]);
    expect(attachments[0].missing).not.toBe(true);
    expect(attachments[0].end).toBeLessThan(10);
    await expect(node.locator(".result-item video")).toHaveCSS("object-fit", "contain");
  if (scale === 1 && process.env.NEWTNODE_KEYER_SCREENSHOT) await node.screenshot({ path: process.env.NEWTNODE_KEYER_SCREENSHOT });
  const handle = node.locator(".node-width-resize-handle");
  if (await handle.count()) {
    const box = await handle.boundingBox(); if (box) { await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + 120, box.y + 80, { steps: 6 }); await page.mouse.up(); }
    await expect(node.locator(".result-item video")).toHaveCSS("object-fit", "contain");
  }
  expect(errors).toEqual([]);
});

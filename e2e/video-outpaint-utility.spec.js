import { test, expect } from "@playwright/test";

test("supplied Canvas port sits beside Canvas and routes independently of source", async ({ page }) => {
  await page.addInitScript(() => { if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return; sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
    { id: "canvas", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/source.mp4", status: "complete" } },
    { id: "outpaint", type: "utility", x: 550, y: 20, data: { utilityMode: "video", utilityVideoModel: "Video Outpaint", settingsOpen: true, outpaintPromptMode: "manual", prompt: "A continuous landscape" } }
  ], edges: [{ id: "canvas-wire", from: { nodeId: "canvas", port: "videoOut" }, to: { nodeId: "outpaint", port: "canvasVideoIn" } }], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } })); });
  const { errors } = await openFixture(page, { count: 2 });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { videoOutpaint: true, videoOutpaintSuppliedCanvas: true, videoOutpaintFullResolution: true, videoOutpaintLocalMasks: true, videoOutpaintMatching: true, videoOutpaintSeedance: true, videoOutpaintSeedanceRepeats: true, seedanceVideoEditing: true } } }));
  let preparation, generation;
  const generations = [];
  await page.route("**/api/node/video-outpaint-prepare", route => {
    preparation = route.request().postDataJSON();
    return route.fulfill({ json: { videoUrl: "/outputs/e2e/padded.mp4", maskImageUrl: "/outputs/e2e/mask.png", fingerprint: videoOutpaintFingerprint("", preparation.videoOutpaint, preparation.canvasVideoUrl), plan: planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 1 }, preparation.videoOutpaint) } });
  });
  await page.route("**/api/node/generate-video", route => { generation = route.request().postDataJSON(); generations.push(generation); return route.fulfill({ json: { generationRunId: generation.generationRunId, video: { localUrl: `/outputs/e2e/done-${generations.length}.mp4` } } }); });
  const node = page.locator('[data-node-card-id="outpaint"]');
  const canvasRow = node.locator(".node-row").filter({ has: page.locator(".node-row-label", { hasText: /^Canvas$/ }) });
  await expect(canvasRow.locator('[data-port-role="input"]')).toHaveCount(1);
  await expect(node.getByRole("button", { name: "Canvas Edit", exact: true })).toBeDisabled();
  const repeats = node.getByRole("spinbutton", { name: "Outpaint canvas repeats" });
  const count = node.getByRole("combobox", { name: "Utility video generations" });
  await expect(count).toHaveValue("1");
  await expect(count.locator("option")).toHaveText(["1 gen", "2 gens", "3 gens", "4 gens"]);
  await count.selectOption("2");
  await expect(repeats).toHaveValue("1");
  await repeats.fill("3");
  await repeats.press("ArrowDown");
  await expect(repeats).toHaveValue("2");
  await node.getByRole("button", { name: "Prepare supplied canvas & mask" }).click();
  await expect(node.getByLabel("Prepared outpainting canvas")).toBeVisible();
  expect(preparation.canvasVideoUrl).toBe("/outputs/e2e/source.mp4");
  expect(preparation.sourceVideoUrl).toBe("");
  expect(preparation.videoOutpaint.repeatCount).toBe(2);
  await node.locator(".run-node-button").click();
  await expect.poll(() => generation?.canvasVideoUrl).toBe("/outputs/e2e/source.mp4");
  await expect.poll(() => generations.length).toBe(2);
  expect(new Set(generations.map(item => item.generationRunId)).size).toBe(2);
  expect(generations.every(item => item.videoOutpaint.repeatCount === 2)).toBe(true);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.resultItems?.length)).toBe(2);
  expect(generation.referenceVideoUrls).toEqual([]);
  expect(generation.videoOutpaint.repeatCount).toBe(2);
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(node.getByRole("button", { name: "Prepare supplied canvas & mask" })).toBeVisible();
  await expect(repeats).toHaveValue("2");
  await expect(count).toHaveValue("2");
  expect(errors).toEqual([]);
});
import { openFixture, wireAttachmentErrors } from "./helpers.mjs";
import { normalizeVideoOutpaintSettings, videoOutpaintFingerprint, planVideoOutpaint } from "../src/videoOutpaint.js";

test("Run Output finishes an existing raw outpaint locally before considering a new generation", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
    { id: "outpaint", type: "utility", x: 30, y: 20, data: { title: "Outpaint", utilityMode: "video", utilityVideoModel: "Video Outpaint", status: "error", resultUrl: "/outputs/e2e/old.mp4", resultItems: [{ type: "video", url: "/outputs/e2e/old.mp4", videoOutpaint: { rawVideoUrl: "/outputs/e2e/raw.mp4", prepared: { sourceUrl: "/outputs/e2e/source.mp4", plan: { settings: { model: "seedance-2.5" } } }, qc: { status: "needs_review" } } }], selectedResultIndex: 0 } },
    { id: "output", type: "output", x: 550, y: 20, data: { title: "Final", outputPath: "C:/fixtures/outputs", outputFileName: "finished" } }
  ], edges: [{ id: "out", from: { nodeId: "outpaint", port: "videoOut" }, to: { nodeId: "output", port: "sourceIn" } }], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } })));
  const { requests, errors } = await openFixture(page, { count: 2 });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { videoOutpaintMatching: true } } }));
  let finishes = 0;
  await page.route("**/api/node/video-outpaint-finish", route => {
    finishes++;
    return route.fulfill({ json: { type: "video", url: "/outputs/e2e/finished.mp4", fileName: "finished.mp4", videoOutpaint: { outputFormat: "ProRes 4444 XQ MOV (10-bit processing)", qc: { status: "passed_checks" } } } });
  });
  await page.locator('[data-node-card-id="output"]').locator(".run-node-button").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "output")?.data?.resultUrl)).toBe("/outputs/e2e/finished.mp4");
  expect(finishes).toBe(1);
  expect(requests.some(request => request.path === "/api/node/generate-video")).toBe(false);
  expect(errors).toEqual([]);
});

for (const master of [true, false]) test(master ? "Output preserves an outpaint master, including explicit MOV" : "Video Output defaults to its input format and honors conversion choices", async ({ page }) => {
  await page.addInitScript(master => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
    { id: "outpaint", type: master ? "utility" : "video", x: 30, y: 20, data: { title: "Outpaint", utilityMode: "video", utilityVideoModel: "Video Outpaint", status: "complete", resultUrl: "/outputs/e2e/master.mov", resultItems: [{ type: "video", url: "/outputs/e2e/master.mov", fileName: "master.mov", ...(master ? { videoOutpaint: { outputFormat: "ProRes 4444 XQ MOV (10-bit processing)", qc: { status: "passed_checks" } } } : {}) }], selectedResultIndex: 0 } },
    { id: "output", type: "output", x: 550, y: 20, data: { title: "Final", outputPath: "C:/fixtures/outputs", outputFileName: "finished", outputVideoFormat: "mp4" } }
  ], edges: [{ id: "out", from: { nodeId: "outpaint", port: "videoOut" }, to: { nodeId: "output", port: "sourceIn" } }], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } })), master);
  const { errors } = await openFixture(page, { count: 2 });
  await page.route("**/api/video-preview?**", route => route.fulfill({ status: 302, headers: { location: "/outputs/e2e/preview.mp4" } }));
  const saves = [];
  await page.route("**/api/node/save-output", route => {
    const request = route.request().postDataJSON(); saves.push(request);
    return route.fulfill({ json: { output: { localUrl: "/outputs/e2e/saved.mov", fileName: "saved.mov", mediaType: "video", mimeType: "video/quicktime" } } });
  });
  const output = page.locator('[data-node-card-id="output"]');
  await expect(output.locator("select")).toHaveValue("source");
  await output.locator(".run-node-button").click();
  await expect.poll(() => saves.length).toBe(1);
  expect(saves[0].outputFormat).toBe("source");
  await output.locator("select").selectOption("prores");
  await output.locator(".run-node-button").click();
  await expect.poll(() => saves.length).toBe(2);
  expect(saves[1].outputFormat).toBe(master ? "source" : "prores");
  await expect(output.locator("select")).toHaveValue("prores");
  await output.locator("select").selectOption("mp4");
  await output.locator(".run-node-button").click();
  await expect.poll(() => saves.length).toBe(3);
  expect(saves[2].outputFormat).toBe("mp4");
  expect(errors).toEqual([]);
});

for (const entry of ["output", "outpaint"]) for (const succeeds of [true, false]) test(`${entry} preserves user settings and ${succeeds ? "passes on its single generation" : "retains failure without QC regeneration"}`, async ({ page }) => {
  const frame = { x: 0, y: -0.3, width: 1 };
  await page.addInitScript(({ frame, entry }) => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
    { id: "source", type: "video", x: 10, y: 10, data: { resultUrl: "/outputs/e2e/source.mp4", status: "complete" } },
    { id: "outpaint", type: "utility", x: 450, y: 10, data: { title: "Outpaint", utilityMode: "video", utilityVideoModel: "Video Outpaint", videoOutpaint: { model: "seedance-2.5", frame }, prompt: "User approved: continue the coat and trees.", outpaintPromptMode: "manual", settingsOpen: true } },
    { id: "output", type: "output", x: 950, y: 10, data: { title: "Final", outputPath: "C:/fixtures/outputs", outputFileName: "finished_$index" } }
  ], edges: [{ id: "in", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "outpaint", port: "referenceVideoIn" } }, ... (entry === "output" ? [{ id: "out", from: { nodeId: "outpaint", port: "videoOut" }, to: { nodeId: "output", port: "sourceIn" } }] : [])], groups: [], viewport: { x: 10, y: 10, scale: 0.7 } })), { frame, entry });
  const { errors, requests } = await openFixture(page, { count: 3 });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { videoOutpaint: true, videoOutpaintMatching: true, videoOutpaintFullResolution: true, videoOutpaintLocalMasks: true, videoOutpaintSeedance: true, seedanceVideoEditing: true } } }));
  const generations = [];
  await page.route("**/api/node/generate-video", async route => {
    generations.push(route.request().postDataJSON());
    await expect(page.locator('[data-node-card-id="outpaint"]').getByRole("button", { name: generations.at(-1).videoOutpaintRepair ? "QC Edits..." : "Generating Fill...", exact: true })).toBeVisible();
    const passed = succeeds;
    return route.fulfill({ json: { modelName: "Seedance 2.5", video: { localUrl: passed ? "/outputs/e2e/finished.mp4" : "/outputs/e2e/candidate.mp4", fileName: passed ? "finished.mp4" : "candidate.mp4" }, videoOutpaint: { rawVideoUrl: "/outputs/e2e/raw.mp4", matching: { finishVersion: 3, motionValidation: { status: passed ? "passed_checks" : "needs_review", flaggedFrames: passed ? 0 : 2 } }, qc: { status: "off" } }, warning: passed ? "" : "Outpaint motion needs review", cost: { amountUsd: null } } });
  });
  const output = page.locator(`[data-node-card-id="${entry}"]`);
  await output.locator(".run-node-button").click();
  if (succeeds) await expect.poll(() => page.evaluate(id => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === id)?.data?.resultUrl, entry)).toBe("/outputs/e2e/finished.mp4");
  else await expect.poll(() => page.evaluate(id => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === id)?.data?.status, entry)).toBe("error");
  expect(generations).toHaveLength(1);
  expect(generations[0].videoOutpaintRepair).toBeUndefined();
  expect(requests.some(r => r.path === "/api/node/save-output")).toBe(false);
  for (const generation of generations) { expect(generation.prompt).toBe("User approved: continue the coat and trees."); expect(generation.videoOutpaint.frame).toEqual(frame); expect(generation.outputTargetNodeId).toBe(entry === "output" ? "output" : ""); }
  expect(requests.some(r => r.path === "/api/node/video-outpaint-prompt")).toBe(false);
  expect(errors).toEqual([]);
});

test("outpaint keeps automatic finishing metadata without a local-finish button", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return;
    const result = { type: "video", url: "/outputs/e2e/matched.mp4", videoOutpaint: { rawVideoUrl: "/outputs/e2e/raw.mp4", prepared: { sourceUrl: "/outputs/e2e/source.mp4", plan: { settings: {} } }, matching: { applied: true }, qc: { status: "needs_review", flags: ["Generated tail is short"] } } };
    sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [{ id: "outpaint", type: "utility", x: 50, y: 20, data: { title: "Outpaint", utilityMode: "video", utilityVideoModel: "Video Outpaint", settingsOpen: true, status: "complete", resultUrl: result.url, resultItems: [result], selectedResultIndex: 0 } }], edges: [], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } }));
  });
  const { errors, requests } = await openFixture(page, { count: 1 });
  const node = page.locator('[data-node-card-id="outpaint"]');
  await expect(node.getByLabel("Outpaint auto match")).toHaveCount(0);
  await expect(node.getByRole("button", { name: "Reprocess raw result" })).toHaveCount(0);
  await expect(node.getByText("Local finish", { exact: true })).toHaveCount(0);
  await expect(node.getByLabel("Outpaint QC Status")).toHaveText("Needs review.\nBlend or consistency checks need review.");
  await node.getByLabel("Outpaint seam feather").fill("48");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.videoOutpaint?.feather)).toBe("48");
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(node.getByLabel("Outpaint seam feather")).toHaveValue("48");
  await expect(node.getByRole("button", { name: "Reprocess raw result" })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.resultItems[0].videoOutpaint.qc.status)).toBe("needs_review");
  expect(requests.some(r => ["/api/node/video-outpaint-finish", "/api/node/utility-video", "/api/node/generate-video"].includes(r.path))).toBe(false);
  expect(errors).toEqual([]);
});

test("Seedance outpaint switches controls, prepares a short clip, analyzes context and edits with durable routing", async ({ page }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
    { id: "source", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/source.mp4", status: "complete" } },
    { id: "look", type: "image", x: 20, y: 400, data: { resultUrl: "/outputs/e2e/framing.png", status: "complete" } },
    { id: "outpaint", type: "utility", x: 550, y: 20, data: { title: "Outpaint", utilityMode: "video", utilityVideoModel: "Video Outpaint", settingsOpen: true, outpaintPromptMode: "guided" } }
  ], edges: [{ id: "wire", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "outpaint", port: "referenceVideoIn" } }, { id: "look-wire", from: { nodeId: "look", port: "imageOut" }, to: { nodeId: "outpaint", port: "referenceImageIn" } }], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } })));
  const { errors } = await openFixture(page, { count: 3 });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { videoOutpaint: true, videoOutpaintPrompt: true, videoOutpaintFramePresence: true, videoOutpaintMatching: true, videoOutpaintFraming: true, videoOutpaintFullResolution: true, videoOutpaintLocalMasks: true, videoOutpaintSeedance: true, seedanceVideoEditing: true } } }));
  let preparation, analysis, generation;
  await page.route("**/api/node/video-outpaint-prepare", route => {
    preparation = route.request().postDataJSON();
    const settings = normalizeVideoOutpaintSettings(preparation.videoOutpaint);
    return route.fulfill({ json: { sourceUrl: preparation.sourceVideoUrl, videoUrl: "/outputs/e2e/padded.mp4", generationVideoUrl: "/outputs/e2e/gray-conditioned.mp4", maskImageUrl: "/outputs/e2e/mask.png", previewUrl: "/outputs/e2e/framing.png", fingerprint: videoOutpaintFingerprint(preparation.sourceVideoUrl, settings), plan: { ...planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 1.666667 }, settings), generationPaddingColor: "gray" } } });
  });
  await page.route("**/api/node/video-outpaint-prompt", route => {
    analysis = route.request().postDataJSON();
    return route.fulfill({ json: { text: "Extend the floor and moving shadows into the padded regions.", provider: "fal", model: "vision" } });
  });
  await page.route("**/api/node/generate-video", route => {
    generation = route.request().postDataJSON();
    return route.fulfill({ json: { modelName: "Seedance 2.5", generationRunId: generation.generationRunId, video: { localUrl: "/outputs/e2e/seedance.mp4", fileName: "seedance.mp4" }, videoOutpaint: { model: "seedance-2.5", rawVideoUrl: "/outputs/e2e/raw.mp4", restoredSource: true, matching: { finishVersion: 3 }, qc: { status: "off" } }, cost: { amountUsd: null } } });
  });
  const node = page.locator('[data-node-card-id="outpaint"]');
  await expect(node.getByLabel("Outpaint model")).toHaveValue("seedance-2.5");
  await expect(node.getByLabel("Outpainting guidance")).toHaveValue("");
  await expect(node.getByLabel("Outpainting guidance")).not.toHaveAttribute("placeholder");
  await node.getByLabel("Outpaint model").selectOption("seedance-2.5");
  await expect(node.getByLabel("Outpaint inference steps")).toHaveCount(0);
  await expect(node.getByLabel("Outpaint guidance scale")).toHaveCount(0);
  await expect(node.getByLabel("Outpaint negative prompt")).toHaveCount(0);
  await expect(node.getByLabel("Outpaint Seedance resolution")).toBeVisible();
  await expect(node.getByLabel("Outpaint delivery size")).toHaveCount(0);
  await node.getByLabel("Outpaint Seedance resolution").selectOption("1080p");
  await expect(node.getByLabel("Outpaint duration seconds")).toHaveValue("3.375");
  await node.getByRole("button", { name: "Prepare canvas & mask" }).click();
  await expect(node.getByLabel("Prepared outpainting canvas")).toBeVisible();
  expect(preparation.videoOutpaint.model).toBe("seedance-2.5");
  expect(preparation.videoOutpaint.seedanceResolution).toBe("1080p"); expect(preparation.videoOutpaint.outputSize).toBe("1080p");
  await node.getByLabel("Outpainting guidance").fill("Keep the warm lighting");
  await node.getByRole("button", { name: "Analyze & draft prompt" }).click();
  const prompt = node.locator(".node-row").filter({ has: page.locator(".node-row-label", { hasText: /^Prompt$/ }) }).locator("textarea");
  await expect(prompt).toHaveValue("Extend the floor and moving shadows into the padded regions.");
  expect(analysis.outpaintModel).toBe("seedance-2.5");
  expect(analysis.sourceVideoUrl).toBe("/outputs/e2e/gray-conditioned.mp4");
  expect(analysis.preparedPlan.generationPaddingColor).toBe("gray");
  expect(analysis.referenceImageUrls).toEqual(["/outputs/e2e/framing.png"]);
  expect(analysis.maskImageUrl).toBe("/outputs/e2e/mask.png");
  expect(analysis.preparedPlan.outputFrames).toBe(40);
  expect(analysis.preparedPlan.prerollFrames).toBe(0);
  expect((analysis.preparedPlan.frames - 1) % 8).toBe(0);
  await node.locator(".run-node-button").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.resultItems?.at(-1)?.videoOutpaint?.rawVideoUrl)).toBe("/outputs/e2e/raw.mp4");
  expect(generation.model).toBe("Seedance 2.5"); expect(generation.videoOutpaintUtility).toBe(true);
  expect(preparation.regenerateMaskFill).toBeUndefined();
  expect(generation.videoOutpaint.seedanceResolution).toBe("1080p"); expect(generation.videoOutpaint.outputSize).toBe("1080p");
  expect(generation.seedanceTask).toBe("edit"); expect(generation.durableGeneration).toBe(true);
  expect(generation.referenceVideoUrls).toEqual(["/outputs/e2e/source.mp4"]);
  await page.screenshot({ path: testInfo.outputPath("seedance-outpaint.png") });
  await expect(node.getByLabel("Outpaint model").locator("option")).toHaveCount(2);
  await expect(node.getByLabel("Outpaint model")).toHaveValue("seedance-2.5");
  await expect(node.getByLabel("Outpaint inference steps")).toHaveCount(0);
  await node.getByLabel("Outpaint model").selectOption("wan-vace");
  await expect(node.getByLabel("Outpaint inference steps")).toBeVisible();
  await expect(node.getByLabel("Outpaint guidance scale")).toBeVisible();
  await expect(node.getByLabel("Prepared outpainting canvas")).toHaveCount(0);
  await expect(node.getByLabel("Outpaint model")).toHaveValue("wan-vace");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.resultItems?.at(-1)?.videoOutpaint?.rawVideoUrl)).toBe("/outputs/e2e/raw.mp4");
  expect(errors).toEqual([]);
});

test("Video Outpaint prepares locally, drafts a prompt, runs with refinements and restores its saved workflow", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return;
    sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
      { id: "source", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/source.mp4", status: "complete" } },
      { id: "outpaint", type: "utility", x: 550, y: 20, data: { title: "Outpaint", utilityMode: "video", utilityVideoModel: "Video Outpaint", videoOutpaint: { model: "wan-vace" }, settingsOpen: true, prompt: "Complete the person attached to the visible arm.", outpaintPromptMode: "guided", seed: "12345" } }
    ], edges: [{ id: "source-outpaint", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "outpaint", port: "referenceVideoIn" } }], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } }));
  });
  const { errors, requests } = await openFixture(page, { count: 2 });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { videoOutpaint: true, videoOutpaintPrompt: true, videoOutpaintFramePresence: true, videoOutpaintMatching: true, videoOutpaintFraming: true, videoOutpaintFullResolution: true, videoOutpaintLocalMasks: true, videoOutpaintSeedance: true, seedanceVideoEditing: true } } }));
  let preparation, analysis, generation, shouldFail = false;
  await page.route("**/api/node/video-outpaint-prepare", route => {
    preparation = route.request().postDataJSON();
    const settings = normalizeVideoOutpaintSettings(preparation.videoOutpaint);
    return route.fulfill({ json: { sourceUrl: preparation.sourceVideoUrl, videoUrl: "/outputs/e2e/padded.mp4", maskVideoUrl: "/outputs/e2e/mask.mp4", previewUrl: "/outputs/e2e/framing.png", fingerprint: videoOutpaintFingerprint(preparation.sourceVideoUrl, settings), plan: planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 1.666667 }, settings) } });
  });
  await page.route("**/api/node/video-outpaint-prompt", route => {
    analysis = route.request().postDataJSON();
    return route.fulfill({ json: { text: "Complete one anatomically connected person in the lower extension.", provider: "fal", model: "vision" } });
  });
  await page.route("**/api/node/utility-video", route => {
    generation = route.request().postDataJSON();
    const localCrop = !planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 4 }, generation.videoOutpaint).needsOutpaint;
    return route.fulfill({ status: shouldFail ? 502 : 200, json: shouldFail ? { error: "Fal unavailable" } : { modelName: "Video Outpaint", video: { localUrl: "/outputs/e2e/outpaint.mp4", fileName: "outpaint.mp4", mimeType: "video/mp4" }, videoOutpaint: { rawVideoUrl: "/outputs/e2e/raw.mp4", restoredSource: true, localCrop }, cost: { amountUsd: localCrop ? 0 : 0.405 } } });
  });
  const node = page.locator('[data-node-card-id="outpaint"]');
  await expect(node.locator('[data-port-role="input"]')).toHaveCount(4);
  await expect(node.getByRole("button", { name: "Analyze & draft prompt" })).toBeDisabled();
  await node.getByRole("button", { name: "Prepare canvas & mask" }).click();
  await expect(node.getByLabel("Prepared outpainting canvas")).toBeVisible();
  await expect(node.getByRole("button", { name: "Analyze & draft prompt" })).toBeEnabled();
  expect(preparation.sourceVideoUrl).toBe("/outputs/e2e/source.mp4");
  expect(preparation.videoOutpaint.aspectRatio).toBe("9:16");
  expect(requests.some(item => item.path === "/api/node/utility-video")).toBe(false);
  await node.getByLabel("Outpainting guidance").fill("Complete the person connected to the arm");
  await node.getByRole("button", { name: "Analyze & draft prompt" }).click();
  const prompt = node.locator(".node-row").filter({ has: page.locator(".node-row-label", { hasText: /^Prompt$/ }) }).locator("textarea");
  await expect(prompt).toHaveValue("Complete one anatomically connected person in the lower extension.");
  expect(analysis.sourceVideoUrl).toBe("/outputs/e2e/padded.mp4"); expect(analysis.maskVideoUrl).toBe("/outputs/e2e/mask.mp4");
  await prompt.fill("My reviewed person-completion prompt");
  await node.locator(".run-node-button").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.resultItems?.at(-1)?.videoOutpaint?.rawVideoUrl)).toBe("/outputs/e2e/raw.mp4");
  expect(generation.model).toBe("Video Outpaint"); expect(generation.videoOutpaint.model).toBe("wan-vace"); expect(generation.prompt).toBe("My reviewed person-completion prompt");
  expect(generation.referenceVideoUrls).toEqual(["/outputs/e2e/source.mp4"]);
  expect(generation.maskVideoUrls).toEqual([]);
  expect(generation.videoOutpaint.restoreSource).toBe(true);
  await node.getByLabel("Outpaint target ratio").selectOption("16:9");
  await expect(node.getByLabel("Prepared outpainting canvas")).toHaveCount(0);
  await expect(node.getByRole("button", { name: "Analyze & draft prompt" })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.resultItems?.at(-1)?.videoOutpaint?.rawVideoUrl)).toBe("/outputs/e2e/raw.mp4");
  await node.getByRole("button", { name: "Canvas Edit", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Outpainting canvas editor" });
  await expect(dialog).toBeVisible();
  const region = dialog.getByRole("group", { name: "Outpainting crop region" });
  await expect(region).toBeVisible();
  const before = await region.boundingBox();
  expect(Math.abs(before.width / before.height - 16 / 9)).toBeLessThan(0.02);
  await expect(dialog.getByLabel("Snap canvas frame")).toBeChecked();
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 4, before.y + before.height / 2 + 3, { steps: 3 });
  await expect(dialog.getByLabel("Vertical snap guide")).toBeVisible();
  await expect(dialog.getByLabel("Canvas frame left pixels")).toHaveValue("0");
  await page.screenshot({ path: testInfo.outputPath("canvas-soft-snap-guides.png") });
  await page.mouse.move(before.x + before.width / 2 + 25, before.y + before.height / 2 + 20, { steps: 5 }); await page.mouse.up();
  expect(Number(await dialog.getByLabel("Canvas frame left pixels").inputValue())).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "Reset framing", exact: true }).click();
  const snapBox = await region.boundingBox();
  await page.keyboard.down("Alt");
  await page.mouse.move(snapBox.x + snapBox.width / 2, snapBox.y + snapBox.height / 2); await page.mouse.down();
  await page.mouse.move(snapBox.x + snapBox.width / 2 + 4, snapBox.y + snapBox.height / 2, { steps: 3 }); await page.mouse.up();
  await page.keyboard.up("Alt");
  expect(Number(await dialog.getByLabel("Canvas frame left pixels").inputValue())).toBeGreaterThan(0);
  await dialog.getByLabel("Snap canvas frame").uncheck();
  await dialog.getByLabel("Canvas frame left pixels").fill("80");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await node.getByRole("button", { name: "Canvas Edit", exact: true }).click();
  await expect(dialog.getByLabel("Canvas frame left pixels")).toHaveValue("0");
  await expect(dialog.getByLabel("Snap canvas frame")).not.toBeChecked();
  await dialog.getByLabel("Snap canvas frame").check();
  const box = await region.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 15, { steps: 5 }); await page.mouse.up();
  expect(Number(await dialog.getByLabel("Canvas frame left pixels").inputValue())).toBeGreaterThan(0);
  const handle = await dialog.getByRole("button", { name: "Resize outpainting frame se" }).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 35, handle.y + handle.height / 2 + 20, { steps: 5 }); await page.mouse.up();
  const resized = await region.boundingBox();
  expect(Math.abs(resized.width / resized.height - 16 / 9)).toBeLessThan(0.02);
  expect(Number(await dialog.getByLabel("Canvas frame width pixels").inputValue())).toBeGreaterThan(640);
  await dialog.getByLabel("Canvas frame left pixels").fill("80");
  await dialog.getByLabel("Canvas frame top pixels").fill("-90");
  await dialog.getByLabel("Canvas frame width pixels").fill("960");
  await dialog.getByLabel("Canvas preview time").focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.screenshot({ path: testInfo.outputPath("outpaint-canvas-editor.png") });
  await dialog.getByRole("button", { name: "Apply & prepare" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(node.getByLabel("Prepared outpainting canvas")).toBeVisible();
  expect(preparation.videoOutpaint.frame).toEqual({ x: 0.125, y: -0.140625, width: 1.5 });
  await expect(prompt).toHaveValue("My reviewed person-completion prompt");
  shouldFail = true;
  await node.locator(".run-node-button").click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.resultItems?.at(-1)?.videoOutpaint?.rawVideoUrl)).toBe("/outputs/e2e/raw.mp4");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(node => node.id === "outpaint")?.data?.videoOutpaint?.aspectRatio)).toBe("16:9");
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(node.getByLabel("Outpaint target ratio")).toHaveValue("16:9");
  await node.getByRole("button", { name: "Canvas Edit", exact: true }).click();
  await expect(dialog.getByLabel("Canvas frame left pixels")).toHaveValue("80");
  await expect(dialog.getByLabel("Canvas frame width pixels")).toHaveValue("960");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(prompt).toHaveValue("My reviewed person-completion prompt");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.resultItems?.at(-1)?.videoOutpaint?.rawVideoUrl)).toBe("/outputs/e2e/raw.mp4");
  await node.locator(".model-settings-drawer > summary").click();
  await expect(node.getByLabel("Outpaint target ratio")).toBeHidden();
  await expect(node.locator('[data-port-role="input"]')).toHaveCount(4);
  await expect.poll(async () => (await wireAttachmentErrors(page, [{ id: "source-outpaint", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "outpaint", port: "referenceVideoIn" } }])).every(edge => !edge.missing && edge.start < 2 && edge.end < 2)).toBe(true);
  await node.locator(".model-settings-drawer > summary").click();
  await node.getByRole("button", { name: "Canvas Edit", exact: true }).click();
  await dialog.getByLabel("Canvas frame left pixels").fill("100");
  await dialog.getByLabel("Canvas frame top pixels").fill("0");
  await dialog.getByLabel("Canvas frame width pixels").fill("320");
  await dialog.getByRole("button", { name: "Apply & prepare" }).click();
  await expect(node.getByLabel("Prepared outpainting canvas")).toBeVisible();
  await prompt.fill("");
  await expect(node.getByRole("button", { name: "Export crop", exact: true })).toBeEnabled();
  shouldFail = false;
  await node.getByRole("button", { name: "Export crop", exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find(n => n.id === "outpaint")?.data?.resultItems?.at(-1)?.videoOutpaint?.localCrop)).toBe(true);
  expect(generation.prompt).toBe("");
  expect(errors).toEqual([]);
});

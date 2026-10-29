import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { normalizeVideoOutpaintSettings, planVideoOutpaint, videoOutpaintFingerprint } from "../src/videoOutpaint.js";
import { defaultOutpaintFrame } from "../src/videoOutpaintFrame.js";

const card = (page, id) => page.locator(`[data-node-card-id="${id}"]`);
const batch = (kind = "image") => ({ id: "batch", type: "batch", x: 20, y: 20, data: { title: `${kind} Batch`, batchMediaType: kind,
  batchFiles: [1, 2].map(index => ({ id: `entry-${index}`, type: kind, url: `/outputs/e2e/source-${index}.${kind === "image" ? "png" : "mp4"}`, label: `Entry ${index}`, prompt: `Direction ${index}` })) } });
const wire = (fromId, toId, input) => ({ id: `${fromId}-${toId}-${input}`, from: { nodeId: fromId, port: "batchOut" }, to: { nodeId: toId, port: input } });
async function seed(page, nodes, edges) {
  await page.addInitScript(({ nodes, edges }) => { if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes, edges, groups: [], viewport: { x: 20, y: 20, scale: .8 } })); }, { nodes, edges });
  return openFixture(page, { count: nodes.length, settings: { falKeyConfigured: true, modelProviderPreferences: { imageGeneration: "fal", llm: "fal", seedance: "fal", kling4: "fal" } } });
}
const savedNode = (page, id) => page.evaluate(id => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === id)?.data, id);

test("Preview shows every completed batch video and synchronizes model and thumbnail selection", async ({ page }) => {
  const results = [1, 2, 3].map((index) => ({ id: `take-${index}`, type: "video", url: `/outputs/e2e/take-${index}.mp4`, batchRunIndex: index - 1 }));
  const { errors, requests } = await seed(page, [{ id: "model", type: "videoModel", x: 20, y: 20,
    data: { title: "Batch videos", model: "Seedance 2.5", settingsOpen: false, status: "complete", resultItems: results, batchResults: results,
      batchMediaType: "video", resultUrl: results[0].url, selectedResultIndex: 0 } },
    { id: "viewer", type: "preview", x: 500, y: 20, data: { title: "Batch preview", previewSourceId: "model:videoOut", previewItemIndex: 0 } }],
    [{ id: "normal-video", from: { nodeId: "model", port: "videoOut" }, to: { nodeId: "viewer", port: "sourceIn" } }]);
  const viewer = card(page, "viewer"), model = card(page, "model");
  await expect(viewer.getByRole("button", { name: /^Select preview \d+$/ })).toHaveCount(3);
  await model.getByRole("button", { name: "Next generation", exact: true }).click();
  await expect(viewer.locator(".preview-stage video")).toHaveAttribute("src", /take-2\.mp4$/);
  await viewer.getByRole("button", { name: "Select preview 3", exact: true }).click();
  await expect(model.locator(".result-item video")).toHaveAttribute("src", /take-3\.mp4$/);
  await expect.poll(async () => (await savedNode(page, "model"))?.selectedResultIndex).toBe(2);
  await expect.poll(async () => (await savedNode(page, "viewer"))?.previewItemIndex).toBe(2);
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(viewer.getByRole("button", { name: /^Select preview \d+$/ })).toHaveCount(3);
  await expect(viewer.locator(".preview-stage video")).toHaveAttribute("src", /take-3\.mp4$/);
  expect(requests.filter(request => request.path === "/api/node/generate-video")).toHaveLength(0);
  expect(errors).toEqual([]);
});

test("image Batch processes each source through Utility and exposes its output collection", async ({ page }) => {
  const { errors } = await seed(page, [batch(), { id: "utility", type: "utility", x: 410, y: 20, data: { title: "Depth maps", utilityMode: "image", utilityImageModel: "Depth Anything", prompt: "Shared instruction" } }], [wire("batch", "utility", "imageIn")]);
  const calls = [];
  await page.route("**/api/node/utility-image", async route => { const request = route.request().postDataJSON(); calls.push(request); await route.fulfill({ json: { images: [{ localUrl: `/outputs/e2e/depth-${calls.length}.png` }] } }); });
  await card(page, "utility").getByRole("button", { name: /Run Depth Map/ }).click();
  await expect.poll(() => calls.length).toBe(2);
  await expect.poll(async () => (await savedNode(page, "utility"))?.batchResults?.length).toBe(2);
  expect(calls.map(call => call.imageUrls)).toEqual([["/outputs/e2e/source-1.png"], ["/outputs/e2e/source-2.png"]]);
  expect(calls[0].prompt).toContain("Direction 1"); expect(calls[1].prompt).toContain("Direction 2");
  await expect(card(page, "utility").locator('[data-port-key="utility:batchOut"]')).toHaveCount(0);
  await expect(card(page, "utility").locator('[data-port-key="utility:utilityOut"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test("image Batch runs each start frame through a Video Model", async ({ page }) => {
  const { errors } = await seed(page, [batch(), { id: "video", type: "videoModel", x: 410, y: 20, data: { title: "Animate", model: "Kling 4.0 Image-to-Video", prompt: "Slow camera move", resolution: "720p", duration: "3 seconds", batchCount: "1", settingsOpen: false } }], [wire("batch", "video", "startFrameIn")]);
  const calls = [];
  await page.route("**/api/node/generate-video", async route => { calls.push(route.request().postDataJSON()); await route.fulfill({ json: { video: { localUrl: `/outputs/e2e/animate-${calls.length}.mp4`, mimeType: "video/mp4" } } }); });
  await card(page, "video").getByRole("button", { name: /^Run Video/ }).click();
  await expect.poll(() => calls.length).toBe(2);
  await expect.poll(async () => (await savedNode(page, "video"))?.batchResults?.length).toBe(2);
  expect(calls.map(call => call.startFrameUrls).sort()).toEqual([["/outputs/e2e/source-1.png"], ["/outputs/e2e/source-2.png"]]);
  expect(new Set(calls.map(call => call.generationGroupId)).size).toBe(1);
  expect((await savedNode(page, "video")).batchMediaType).toBe("video");
  expect(errors).toEqual([]);
});

test("normal Utility image outputs carry all batch entries to processors and Preview after reload", async ({ page }) => {
  const utility = id => ({ id, type: "utility", x: id === "first" ? 370 : 730, y: 20,
    data: { title: id, utilityMode: "image", utilityImageModel: "Depth Anything" } });
  const { errors } = await seed(page, [batch(), utility("first"), utility("second"), { id: "viewer", type: "preview", x: 1100, y: 20, data: {} }],
    [wire("batch", "first", "imageIn"), { id: "ordinary-media", from: { nodeId: "first", port: "utilityOut" }, to: { nodeId: "second", port: "imageIn" } },
      { id: "ordinary-viewer", from: { nodeId: "second", port: "utilityOut" }, to: { nodeId: "viewer", port: "sourceIn" } }]);
  const calls = [];
  await page.route("**/api/node/utility-image", async route => { calls.push(route.request().postDataJSON()); await route.fulfill({ json: { images: [{ localUrl: `/outputs/e2e/processed-${calls.length}.png` }] } }); });
  await card(page, "first").getByRole("button", { name: /Run Depth Map/ }).click();
  await expect.poll(async () => (await savedNode(page, "first"))?.status).toBe("complete");
  await card(page, "second").getByRole("button", { name: /Run Depth Map/ }).click();
  await expect.poll(async () => (await savedNode(page, "second"))?.status).toBe("complete");
  expect(calls).toHaveLength(4);
  expect(calls.slice(2).flatMap(call => call.imageUrls).sort()).toEqual(["/outputs/e2e/processed-1.png", "/outputs/e2e/processed-2.png"]);
  await expect(card(page, "viewer").getByRole("button", { name: /^Select preview \d+$/ })).toHaveCount(2);
  await expect(card(page, "second").locator('[data-port-key="second:batchOut"]')).toHaveCount(0);
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(card(page, "viewer").getByRole("button", { name: /^Select preview \d+$/ })).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("normal Text Agent Prompt output keeps original videos paired for downstream video edits", async ({ page }) => {
  const { errors } = await seed(page, [batch("video"), { id: "agent", type: "textAgent", x: 370, y: 20, data: { agentDraft: "Change the lighting" } },
    { id: "video", type: "videoModel", x: 780, y: 20, data: { model: "Seedance 2.5", seedanceTask: "edit", prompt: "Preserve motion", resolution: "720p", duration: "4 seconds", aspectRatio: "16:9", batchCount: "1", settingsOpen: false } }],
    [wire("batch", "agent", "videoIn"), { id: "normal-prompt", from: { nodeId: "agent", port: "promptOut" }, to: { nodeId: "video", port: "promptIn" } }]);
  await page.route("**/api/node/process-text", async route => { const request = route.request().postDataJSON(); await route.fulfill({ json: { text: `Lighting for ${request.videoInputs[0].url}`, model: "fixture" } }); });
  const calls = [];
  await page.route("**/api/node/generate-video", async route => { calls.push(route.request().postDataJSON()); await route.fulfill({ json: { video: { localUrl: `/outputs/e2e/edited-${calls.length}.mp4` } } }); });
  await card(page, "agent").getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(async () => (await savedNode(page, "agent"))?.status).toBe("complete");
  await card(page, "video").getByRole("button", { name: /^Edit Video/ }).click();
  await expect.poll(() => calls.length).toBe(2);
  for (const request of calls) { expect(request.referenceVideoUrls).toHaveLength(1); expect(request.prompt).toContain(request.referenceVideoUrls[0]); }
  await expect(card(page, "agent").locator('[data-port-key="agent:batchOut"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("video Batch processes every video through Utility and renders contained video thumbnails", async ({ page }) => {
  const { errors } = await seed(page, [batch("video"), { id: "utility", type: "utility", x: 410, y: 20, data: { title: "Upscale videos", utilityMode: "video", utilityVideoModel: "Topaz Video Upscale", batchCount: "1", settingsOpen: false } }], [wire("batch", "utility", "referenceVideoIn")]);
  const calls = [];
  await page.route("**/api/node/utility-video", async route => { calls.push(route.request().postDataJSON()); await route.fulfill({ json: { video: { localUrl: `/outputs/e2e/upscale-${calls.length}.mp4`, mimeType: "video/mp4" } } }); });
  await expect(card(page, "batch").locator(".batch-entry video")).toHaveCount(2);
  await card(page, "utility").getByRole("button", { name: /Run Topaz Upscale/ }).click();
  await expect.poll(() => calls.length).toBe(2);
  await expect.poll(async () => (await savedNode(page, "utility"))?.batchResults?.length).toBe(2);
  expect(JSON.stringify(calls[0])).toContain("source-1.mp4"); expect(JSON.stringify(calls[1])).toContain("source-2.mp4");
  await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(card(page, "batch").locator(".batch-entry video")).toHaveCount(2);
  expect(errors).toEqual([]);
});

test("video Batch supplies a separate video reference to every Video Model edit", async ({ page }) => {
  const { errors } = await seed(page, [batch("video"), { id: "video", type: "videoModel", x: 410, y: 20, data: { title: "Edit videos", model: "Seedance 2.5", seedanceTask: "edit", prompt: "Change the lighting", resolution: "720p", duration: "4 seconds", aspectRatio: "16:9", batchCount: "1", settingsOpen: false } }], [wire("batch", "video", "referenceVideoIn")]);
  const calls = [];
  await page.route("**/api/node/generate-video", async route => { calls.push(route.request().postDataJSON()); await route.fulfill({ json: { video: { localUrl: `/outputs/e2e/edit-${calls.length}.mp4`, mimeType: "video/mp4" } } }); });
  await card(page, "video").getByRole("button", { name: /^Edit Video/ }).click();
  await expect.poll(() => calls.length).toBe(2);
  await expect.poll(async () => (await savedNode(page, "video"))?.batchResults?.length).toBe(2);
  expect(calls.flatMap(call => call.referenceVideoUrls).sort()).toEqual(["/outputs/e2e/source-1.mp4", "/outputs/e2e/source-2.mp4"]);
  expect(errors).toEqual([]);
});

test("Preview and Timeline receive every member of an image Batch", async ({ page }) => {
  const { errors } = await seed(page, [batch(), { id: "preview", type: "preview", x: 360, y: 20, data: { title: "Preview" } },
    { id: "timeline", type: "assembly", x: 740, y: 20, data: { title: "Timeline" } }], [wire("batch", "preview", "sourceIn"), wire("batch", "timeline", "imageIn")]);
  await expect(card(page, "preview").getByRole("button", { name: /^Select preview \d+$/ })).toHaveCount(2);
  await card(page, "preview").getByRole("button", { name: "Select preview 2", exact: true }).click();
  await expect(card(page, "preview").locator(".preview-stage img")).toHaveAttribute("data-full-resolution-url", "/outputs/e2e/source-2.png");
  await expect.poll(async () => (await savedNode(page, "timeline"))?.assembly?.media?.length).toBe(2);
  const media = (await savedNode(page, "timeline")).assembly.media;
  expect(new Set(media.map(item => item.id)).size).toBe(2);
  expect(media.map(item => item.url).sort()).toEqual(["/outputs/e2e/source-1.png", "/outputs/e2e/source-2.png"]);
  expect(errors).toEqual([]);
});

test("Text Agent's normal Prompt output pairs each batch prompt with its image behind the scenes", async ({ page }) => {
  const instruction = "Add a soccer ball to this image";
  const { errors } = await seed(page, [batch(), { id: "agent", type: "textAgent", x: 380, y: 20, data: { title: "Write prompts", agentDraft: instruction,
    resultText: "Old unrelated prompt", agentMessages: [{ role: "user", text: "Old instruction" }, { role: "assistant", text: "Old unrelated prompt" }] } },
    { id: "model", type: "imageModel", x: 820, y: 20, data: { title: "Generate", model: "Nano Banana 2", prompt: "Preserve the product", aspectRatio: "1:1", resolution: "1K", settingsOpen: false, batchCount: "1" } }], [wire("batch", "agent", "imageIn")]);
  const texts = [], images = [];
  let active = 0, maximum = 0, completed = 0, revision = 1;
  await page.route("**/api/node/process-text", async route => {
    const request = route.request().postDataJSON(); texts.push(request);
    maximum = Math.max(maximum, ++active);
    const first = request.imageInputs[0].url.includes("source-1");
    await new Promise(resolve => setTimeout(resolve, first ? 150 : 50));
    await route.fulfill({ json: { text: `${first ? "Use a red background" : "Use a blue background"} with a soccer ball revision ${revision}`, model: "fixture" } });
    active--; completed++;
  });
  // Wire the fresh agent, then explicitly run it before consuming its results.
  await expect(card(page, "agent").locator('[data-port-key="agent:batchOut"]')).toHaveCount(0);
  const output = await card(page, "agent").locator('[data-port-key="agent:promptOut"]').boundingBox();
  const input = await card(page, "model").locator('[data-port-key="model:promptIn"]').boundingBox();
  await page.mouse.move(output.x + output.width / 2, output.y + output.height / 2); await page.mouse.down(); await page.mouse.move(input.x + input.width / 2, input.y + input.height / 2, { steps: 8 }); await page.mouse.up();
  await page.route("**/api/node/generate-image", async route => {
    expect(completed).toBe(revision === 3 ? 4 : 2);
    const request = route.request().postDataJSON(); images.push(request);
    await route.fulfill({ json: { images: [{ localUrl: `/outputs/e2e/final-${images.length}.png` }] } });
  });
  await card(page, "agent").getByRole("button", { name: "Send message", exact: true }).click();
  await expect.poll(async () => (await savedNode(page, "agent"))?.status).toBe("complete");
  await card(page, "model").getByRole("button", { name: /^Run Batch/ }).click();
  await expect.poll(() => images.length).toBe(2);
  expect(texts).toHaveLength(2); expect(texts.every(request => request.imageInputs.length === 1)).toBe(true);
  expect(texts.every(request => request.messages.length === 0 && request.text.includes(instruction))).toBe(true);
  expect(maximum).toBe(2);
  const first = images.find(request => request.imagePromptUrls[0].includes("source-1"));
  const second = images.find(request => request.imagePromptUrls[0].includes("source-2"));
  expect(first.prompt).toContain("red background"); expect(second.prompt).toContain("blue background");
  await expect.poll(async () => (await savedNode(page, "model"))?.status).toBe("complete");
  revision = 2;
  await card(page, "model").getByRole("button", { name: /^Run Batch/ }).click();
  await expect.poll(() => images.length).toBe(4);
  expect(texts).toHaveLength(2);
  expect(texts.every(request => request.messages.length === 0)).toBe(true);
  for (const request of images.slice(2)) {
    expect(request.prompt).toContain("revision 1");
    expect(request.prompt).not.toContain("revision 2");
    expect(request.prompt).toContain(request.imagePromptUrls[0].includes("source-1") ? "red background" : "blue background");
    expect(request.prompt).not.toContain(request.imagePromptUrls[0].includes("source-1") ? "blue background" : "red background");
  }
  await expect.poll(async () => (await savedNode(page, "model"))?.status).toBe("complete");
  await expect(card(page, "agent").getByLabel("Message Text Agent")).toHaveValue(instruction);
  // Existing Run All remains valid and does not prepare the same agent twice.
  revision = 3;
  await card(page, "agent").locator(".node-title-label > svg").click();
  await card(page, "model").locator(".node-title-label > svg").click({ modifiers: ["Shift"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  await page.getByRole("button", { name: "Run All", exact: true }).click();
  await expect.poll(async () => (await savedNode(page, "model"))?.batchResults?.[0]?.batchPrompt).toContain("revision 3");
  expect(texts).toHaveLength(4); expect(images).toHaveLength(6);
  expect(errors).toEqual([]);
});

test("downstream Run with missing batch results never starts its Text Agent", async ({ page }) => {
  const { errors } = await seed(page, [batch(),
    { id: "agent", type: "textAgent", x: 380, y: 20, data: { title: "Write prompts", agentDraft: "Add a soccer ball" } },
    { id: "model", type: "imageModel", x: 820, y: 20, data: { title: "Generate", prompt: "Preserve the product", settingsOpen: false } }
  ], [wire("batch", "agent", "imageIn"), wire("agent", "model", "imagePromptIn")]);
  let texts = 0, images = 0;
  await page.route("**/api/node/process-text", async route => { texts++; await route.fulfill({ status: 500, json: { error: "Agent unavailable" } }); });
  await page.route("**/api/node/generate-image", async route => { images++; await route.fulfill({ json: { images: [] } }); });
  await card(page, "model").getByRole("button", { name: /^Run Batch/ }).click();
  await expect.poll(async () => (await savedNode(page, "model"))?.status).toBe("error");
  expect(texts).toBe(0); expect(images).toBe(0);
  expect((await savedNode(page, "model")).error).toBeTruthy();
  expect((await savedNode(page, "agent")).batchResults).toEqual([]);
  expect(errors).toEqual([]);
});

test("Stop all during explicitly selected Text Agent execution prevents downstream generation", async ({ page }) => {
  const { errors } = await seed(page, [batch(),
    { id: "agent", type: "textAgent", x: 380, y: 20, data: { title: "Write prompts", agentDraft: "Add a soccer ball" } },
    { id: "model", type: "imageModel", x: 820, y: 20, data: { title: "Generate", settingsOpen: false } }
  ], [wire("batch", "agent", "imageIn"), wire("agent", "model", "imagePromptIn")]);
  let release, started = 0, finished = 0, images = 0;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/api/node/process-text", async route => {
    started++; await gate;
    await route.fulfill({ json: { text: "Late prompt", model: "fixture" } }); finished++;
  });
  await page.route("**/api/node/generate-image", async route => { images++; await route.fulfill({ json: { images: [] } }); });
  await card(page, "agent").locator(".node-title-label > svg").click();
  await card(page, "model").locator(".node-title-label > svg").click({ modifiers: ["Shift"] });
  await page.getByRole("button", { name: "Run All", exact: true }).click();
  await expect.poll(() => started).toBe(2);
  await page.getByRole("button", { name: "Stop all active canvas nodes", exact: true }).click();
  await expect.poll(async () => (await savedNode(page, "model"))?.status).toBe("error");
  await expect.poll(async () => (await savedNode(page, "agent"))?.status).toBe("error");
  release();
  await expect.poll(() => finished).toBe(2);
  expect(images).toBe(0);
  expect((await savedNode(page, "agent")).batchResults).toEqual([]);
  expect(errors).toEqual([]);
});

for (const edited of [true, false]) test(`Video Outpaint shares ${edited ? "edited" : "default"} framing across all batch videos and reuses matching canvases`, async ({ page }) => {
  const frame = edited ? { x: -.1, y: -.25, width: 1.2 } : defaultOutpaintFrame({ width: 640, height: 360 }, "9:16");
  const { errors } = await seed(page, [batch("video"), { id: "outpaint", type: "utility", x: 410, y: 20, data: { title: "Outpaint batch", utilityMode: "video", utilityVideoModel: "Video Outpaint", prompt: "Continue the scene", batchCount: "1", settingsOpen: true, videoOutpaint: { model: "wan-vace", aspectRatio: "9:16", ...(edited ? { frame } : {}) } } }], [wire("batch", "outpaint", "referenceVideoIn")]);
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { videoOutpaint: true, videoOutpaintPrompt: true, videoOutpaintFramePresence: true, videoOutpaintFullResolution: true, videoOutpaintLocalMasks: true, videoOutpaintFraming: true, videoOutpaintMatching: true, videoOutpaintConsistency: true, videoOutpaintPreparedReuse: true, videoOutpaintWanConditioning: true } } }));
  const prepared = [], generated = [];
  await page.route("**/api/node/assembly-probe", route => route.fulfill({ json: { media: { width: 640, height: 360, fps: 24, duration: 4, type: "video" } } }));
  await page.route("**/api/node/video-outpaint-prepare", async route => {
    const request = route.request().postDataJSON(); prepared.push(request);
    const settings = normalizeVideoOutpaintSettings(request.videoOutpaint);
    await route.fulfill({ json: { sourceUrl: request.sourceVideoUrl, videoUrl: `/outputs/e2e/prepared-${prepared.length}.mp4`, generationVideoUrl: "/outputs/e2e/conditioning.mp4", maskVideoUrl: "/outputs/e2e/mask.mp4", maskImageUrl: "/outputs/e2e/mask.png", previewUrl: "/outputs/e2e/framing.png", fingerprint: videoOutpaintFingerprint(request.sourceVideoUrl, settings), plan: planVideoOutpaint({ width: request.sourceVideoUrl.includes("source-2") ? 512 : 640, height: request.sourceVideoUrl.includes("source-2") ? 512 : 360, fps: 24, duration: 4 }, settings) } });
  });
  await page.route("**/api/node/utility-video", async route => { const request = route.request().postDataJSON(); generated.push(request); await route.fulfill({ json: { video: { localUrl: `/outputs/e2e/outpaint-${generated.length}.mp4` }, videoOutpaint: { model: "wan-vace", restoredSource: true, matching: { finishVersion: 3 }, qc: { status: "off" } } } }); });
  const node = card(page, "outpaint");
  await node.getByRole("button", { name: "Prepare canvas & mask", exact: true }).click();
  await expect.poll(async () => Object.keys((await savedNode(page, "outpaint"))?.batchPreparations || {}).length).toBe(2);
  expect(prepared).toHaveLength(2);
  expect(prepared.every(request => JSON.stringify(request.videoOutpaint.frame) === JSON.stringify(frame))).toBe(true);
  await node.locator(".run-node-button").click();
  await expect.poll(() => generated.length).toBe(2);
  for (const request of generated) expect(request.videoOutpaintPrepared.sourceUrl).toBe(request.referenceVideoUrls[0]);
  expect(prepared).toHaveLength(2);
  expect(errors).toEqual([]);
});

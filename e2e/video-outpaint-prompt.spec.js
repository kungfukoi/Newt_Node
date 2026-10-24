import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { normalizeVideoOutpaintSettings, videoOutpaintFingerprint, planVideoOutpaint } from "../src/videoOutpaint.js";

test("Video Outpaint drafts an editable guided prompt without generating video and preserves edits on failure", async ({ page }) => {
  await page.addInitScript(() => { if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return; sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [
      { id: "source", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/source.mp4", status: "complete" } },
      { id: "vace", type: "utility", x: 550, y: 20, data: { title: "Outpaint", utilityMode: "video", utilityVideoModel: "Video Outpaint", settingsOpen: true, outpaintPromptMode: "guided", videoOutpaint: { model: "wan-vace", aspectRatio: "9:16" }, prompt: "Existing prompt" } }
    ], edges: [
      { id: "s-v", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "vace", port: "referenceVideoIn" } }
    ], groups: [], viewport: { x: 10, y: 10, scale: 0.8 }
  })); });
  const { errors, requests } = await openFixture(page, { count: 2 });
  await page.route("**/api/node/video-outpaint-prepare", route => {
    const body = route.request().postDataJSON();
    const settings = normalizeVideoOutpaintSettings(body.videoOutpaint);
    return route.fulfill({ json: { sourceUrl: body.sourceVideoUrl, videoUrl: "/outputs/e2e/padded.mp4", generationVideoUrl: "/outputs/e2e/conditioned.mp4", maskVideoUrl: "/outputs/e2e/mask.mp4", maskImageUrl: "/outputs/e2e/mask.png", fingerprint: videoOutpaintFingerprint(body.sourceVideoUrl, settings), plan: planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 3.375 }, settings) } });
  });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { videoOutpaint: true, videoOutpaintPrompt: true, videoOutpaintFramePresence: true, videoOutpaintFullResolution: true, videoOutpaintLocalMasks: true, videoOutpaintFraming: true, videoOutpaintMatching: true, videoOutpaintConsistency: true, videoOutpaintPreparedReuse: true } } }));
  let submitted, fail = false, release;
  await page.route("**/api/node/video-outpaint-prompt", async route => {
    submitted = route.request().postDataJSON();
    if (release) await new Promise(resolve => { release = resolve; });
    await route.fulfill({ status: fail ? 502 : 200, json: fail ? { error: "Analysis unavailable" } : { text: "Continue the carpet with plausible arm proportions.", provider: "fal", model: "vision" } });
  });
  const node = page.locator('[data-node-card-id="vace"]');
  const about = node.getByRole("button", { name: "About this Node", exact: true });
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await about.hover();
  await expect(page.getByRole("tooltip")).toContainText("Analyze and Run reuse the last canvas");
  await page.mouse.move(0, 0);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await about.focus();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await about.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  const prompt = node.locator(".node-row").filter({ has: page.locator(".node-row-label", { hasText: /^Prompt$/ }) }).locator("textarea");
  await node.getByRole("button", { name: "Prepare canvas & mask" }).click();
  await expect(node.getByLabel("Prepared outpainting canvas")).toBeVisible();
  await node.getByLabel("Outpainting guidance").fill("No new windows");
  await node.getByRole("button", { name: "Analyze & draft prompt" }).click();
  await expect(prompt).toHaveValue("Continue the carpet with plausible arm proportions.");
  expect(submitted.guidance).toBe("No new windows");
  expect(submitted.sourceVideoUrl).toBe("/outputs/e2e/padded.mp4");
  expect(submitted.maskImageUrl).toBe("/outputs/e2e/mask.png");
  expect(submitted.outpaintModel).toBe("wan-vace");
  expect(submitted.aspectRatio).toBe("9:16");
  await prompt.fill("My edited prompt");
  fail = true;
  await node.getByRole("button", { name: "Analyze & draft prompt" }).click();
  await expect(node.getByRole("status").filter({ hasText: "Analysis unavailable" })).toBeVisible();
  await expect(prompt).toHaveValue("My edited prompt");
  fail = false;
  release = true;
  await node.getByRole("button", { name: "Analyze & draft prompt" }).click();
  await expect.poll(() => typeof release).toBe("function");
  await expect(page.locator('[data-edge-id="s-v"]')).toHaveClass(/active/);
  await prompt.fill("Keep this edit made during analysis");
  release();
  await expect(node.getByRole("status").filter({ hasText: "Inputs or prompt changed" })).toBeVisible();
  await expect(page.locator('[data-edge-id="s-v"]')).not.toHaveClass(/active/);
  await expect(prompt).toHaveValue("Keep this edit made during analysis");
  await node.getByLabel("Outpainting prompt mode").selectOption("manual");
  await expect(node.getByRole("button", { name: "Analyze & draft prompt" })).toHaveCount(0);
  expect(requests.some(item => item.path === "/api/node/utility-video")).toBe(false);
  expect(requests.some(item => item.path === "/api/node/generate-video")).toBe(false);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes?.find(node => node.id === "vace")?.data?.outpaintPromptMode)).toBe("manual");
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(node.getByLabel("Outpainting prompt mode")).toHaveValue("manual");
  await expect(prompt).toHaveValue("Keep this edit made during analysis");
  await node.getByLabel("Outpainting prompt mode").selectOption("guided");
  await expect(node.getByLabel("Outpainting guidance")).toHaveValue("No new windows");
  expect(errors).toEqual([]);
});

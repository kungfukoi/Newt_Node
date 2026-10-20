import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("VACE drafts an editable guided prompt without generating video and preserves edits on failure", async ({ page }) => {
  await page.addInitScript(() => { if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return; sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [
      { id: "source", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/source.mp4", status: "complete" } },
      { id: "mask", type: "video", x: 20, y: 400, data: { resultUrl: "/outputs/e2e/mask.mp4", status: "complete" } },
      { id: "vace", type: "utility", x: 550, y: 20, data: { title: "Outpaint", utilityMode: "video", utilityVideoModel: "Wan VACE 14B Inpainting", settingsOpen: true, outpaintPromptMode: "guided", wanVaceAspectRatio: "9:16", prompt: "Existing prompt" } }
    ], edges: [
      { id: "s-v", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "vace", port: "referenceVideoIn" } },
      { id: "m-v", from: { nodeId: "mask", port: "videoOut" }, to: { nodeId: "vace", port: "maskVideoIn" } }
    ], groups: [], viewport: { x: 10, y: 10, scale: 0.8 }
  })); });
  const { errors, requests } = await openFixture(page, { count: 3 });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { videoOutpaintPrompt: true } } }));
  let submitted, fail = false, release;
  await page.route("**/api/node/video-outpaint-prompt", async route => {
    submitted = route.request().postDataJSON();
    if (release) await new Promise(resolve => { release = resolve; });
    await route.fulfill({ status: fail ? 502 : 200, json: fail ? { error: "Analysis unavailable" } : { text: "Continue the carpet with plausible arm proportions.", provider: "fal", model: "vision" } });
  });
  const node = page.locator('[data-node-card-id="vace"]');
  const prompt = node.locator(".node-row").filter({ has: page.locator(".node-row-label", { hasText: /^Prompt$/ }) }).locator("textarea");
  await node.getByLabel("Outpainting guidance").fill("No new windows");
  await node.getByRole("button", { name: "Analyze & draft prompt" }).click();
  await expect(prompt).toHaveValue("Continue the carpet with plausible arm proportions.");
  expect(submitted.guidance).toBe("No new windows");
  expect(submitted.sourceVideoUrl).toBe("/outputs/e2e/source.mp4");
  expect(submitted.maskVideoUrl).toBe("/outputs/e2e/mask.mp4");
  expect(submitted.aspectRatio).toBe("9:16");
  await prompt.fill("My edited prompt");
  fail = true;
  await node.getByRole("button", { name: "Analyze & draft prompt" }).click();
  await expect(node.getByRole("status")).toHaveText("Analysis unavailable");
  await expect(prompt).toHaveValue("My edited prompt");
  fail = false;
  release = true;
  await node.getByRole("button", { name: "Analyze & draft prompt" }).click();
  await expect.poll(() => typeof release).toBe("function");
  await prompt.fill("Keep this edit made during analysis");
  release();
  await expect(node.getByRole("status")).toContainText("Inputs or prompt changed");
  await expect(prompt).toHaveValue("Keep this edit made during analysis");
  await node.getByLabel("Outpainting prompt mode").selectOption("manual");
  await expect(node.getByRole("button", { name: "Analyze & draft prompt" })).toHaveCount(0);
  expect(requests.some(item => item.path === "/api/node/utility-video")).toBe(false);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes?.find(node => node.id === "vace")?.data?.outpaintPromptMode)).toBe("manual");
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(node.getByLabel("Outpainting prompt mode")).toHaveValue("manual");
  await expect(prompt).toHaveValue("Keep this edit made during analysis");
  await node.getByLabel("Outpainting prompt mode").selectOption("guided");
  await expect(node.getByLabel("Outpainting guidance")).toHaveValue("No new windows");
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { planVideoOutpaint } from "../src/videoOutpaint.js";

test("outpaint reference roles persist and color refinishing uses retained raw without a generation", async ({ page }) => {
  const settings = { model: "seedance-2.5", seedanceResolution: "480p", feather: 32 };
  const prepared = { sourceUrl: "/outputs/e2e/source.mp4", videoUrl: "/outputs/e2e/padded.mp4", generationVideoUrl: "/outputs/e2e/generation.mp4", maskImageUrl: "/outputs/e2e/mask.png", plan: planVideoOutpaint({ width: 640, height: 360, fps: 24, duration: 1 }, settings) };
  await page.addInitScript(({ settings, prepared }) => {
    if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return;
    sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [
      { id: "source", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/source.mp4", status: "complete" } },
      { id: "set", type: "image", x: 20, y: 450, data: { resultUrl: "/outputs/e2e/set.png", status: "complete" } },
      { id: "clothes", type: "image", x: 20, y: 850, data: { resultUrl: "/outputs/e2e/clothes.png", status: "complete" } },
      { id: "outpaint", type: "utility", x: 550, y: 20, data: { utilityMode: "video", utilityVideoModel: "Video Outpaint", settingsOpen: true, outpaintPromptMode: "manual", videoOutpaint: settings, prompt: "Continue the same floor.", resultUrl: "/outputs/e2e/old.mov", resultItems: [{ type: "video", url: "/outputs/e2e/old.mov", videoOutpaint: { rawVideoUrl: "/outputs/e2e/raw.mp4", prepared, matching: { finishVersion: 3 }, qc: { status: "off" } } }], selectedResultIndex: 0 } }
    ], edges: [
      { id: "video", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "outpaint", port: "referenceVideoIn" } },
      { id: "set-ref", from: { nodeId: "set", port: "imageOut" }, to: { nodeId: "outpaint", port: "referenceImageIn" } },
      { id: "clothes-ref", from: { nodeId: "clothes", port: "imageOut" }, to: { nodeId: "outpaint", port: "referenceImageIn" } }
    ], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } }));
  }, { settings, prepared });
  const { errors, requests } = await openFixture(page, { count: 4 });
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { videoOutpaintMatching: true, videoOutpaintConsistency: true } } }));
  const node = page.locator('[data-node-card-id="outpaint"]');
  await expect(node.getByText("Reuse the same reference image nodes", { exact: false })).toHaveCount(0);
  for (let i = 1; i <= 3; i++) await expect(node.getByLabel(`Outpaint image ${i} name`)).toBeVisible();
  await expect(node.locator('[data-port-id="referenceImageIn"]')).toHaveCount(1);
  await expect(node.locator('[data-port-id="outpaintImage2In"]')).toHaveCount(1);
  await expect(node.locator('[data-port-id="outpaintImage3In"]')).toHaveCount(1);
  await expect(node.getByLabel("Outpaint image 1 name")).toHaveValue("set.png");
  await expect(node.getByLabel("Outpaint image 2 name")).toHaveValue("clothes.png");
  await node.getByLabel("Outpaint image 1 role").selectOption("environment");
  await node.getByLabel("Outpaint image 2 role").selectOption("wardrobe");
  await expect(node.getByLabel("Restore original source footage")).not.toBeVisible();
  await node.locator("summary").filter({ hasText: /^Advanced$/ }).click();
  await expect(node.getByLabel("Restore original source footage")).toBeChecked();
  await expect(node.getByLabel("Match outpaint extension color")).toBeChecked();
  await expect(node.getByLabel("Prepared outpainting canvas")).toHaveAttribute("src", /generation\.mp4/);
  const saved = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(n => n.id === "outpaint").data);
  await expect.poll(async () => (await saved()).videoOutpaint.referenceRoles).toEqual(["environment", "wardrobe", "appearance"]);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(node.getByLabel("Outpaint image 1 name")).toHaveValue("set.png");
  await expect(node.getByLabel("Outpaint image 1 role")).toHaveValue("environment");
  await expect(node.getByLabel("Outpaint image 2 role")).toHaveValue("wardrobe");
  await node.locator("summary").filter({ hasText: /^Advanced$/ }).click();
  await expect(node.getByLabel("Match outpaint extension color")).toBeChecked();
  let finishing;
  await page.route("**/api/node/video-outpaint-finish", route => {
    finishing = route.request().postDataJSON();
    return route.fulfill({ json: { type: "video", url: "/outputs/e2e/matched.mov", videoOutpaint: { prepared, rawVideoUrl: "/outputs/e2e/raw.mp4", matching: { finishVersion: 3, applied: true, colorMatching: { applied: true } }, qc: { status: "off" } } } });
  });
  await node.getByRole("button", { name: "Refinish selected result" }).click();
  await expect.poll(async () => (await saved()).resultUrl).toBe("/outputs/e2e/matched.mov");
  expect(finishing.rawVideoUrl).toBe("/outputs/e2e/raw.mp4");
  expect(finishing.videoOutpaint.matchExtensionColor).toBe(true);
  expect(finishing.prepared.plan.outputFrames).toBe(24);
  expect(requests.some(r => r.path === "/api/node/generate-video" || r.path === "/api/node/utility-video")).toBe(false);
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

function openReframeFixture(page, utilityVideoModel) {
  return openFixture(page, { fixture: {
    nodes: [
      { id: "source", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/source.mp4", status: "complete" } },
      { id: "reframe", type: "utility", x: 550, y: 20, data: { utilityMode: "video", utilityVideoModel, settingsOpen: true, batchCount: "4" } },
    ],
    edges: [{ id: "source-wire", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "reframe", port: "referenceVideoIn" } }],
    groups: [],
    viewport: { x: 10, y: 10, scale: 0.8 },
  } });
}

test("LTX Reframe previews the source frame at the selected aspect ratio and anchor", async ({ page }) => {
  const { errors, requests } = await openReframeFixture(page, "LTX-2.5 Reframe");
  const node = page.locator('[data-node-card-id="reframe"]');
  const preview = node.getByRole("figure", { name: "Reframe placement preview" });
  const source = preview.locator("video");
  await expect(preview).toContainText("16:9 output");
  await expect.poll(() => source.evaluate(video => video.readyState)).toBeGreaterThanOrEqual(2);

  await node.getByRole("combobox", { name: "Aspect Ratio", exact: true }).selectOption("1:1");
  await expect(preview).toContainText("1:1 output");
  await expect.poll(() => source.evaluate(video => video.style.top)).toBe("21.875%");
  await node.getByRole("combobox", { name: "Source Placement", exact: true }).selectOption("bottom");
  await expect.poll(() => source.evaluate(video => video.style.top)).toBe("43.75%");
  await node.getByRole("combobox", { name: "Source Placement", exact: true }).selectOption("top");
  await expect.poll(() => source.evaluate(video => video.style.top)).toBe("0%");
  await expect.poll(() => source.evaluate(video => video.style.height)).toBe("56.25%");
  expect(requests.some(request => request.path === "/api/node/generate-video")).toBe(false);
  expect(errors).toEqual([]);
});

test("Video Outpaint runs Reframe directly with the selected ratio, resolution and placement", async ({ page }) => {
  const { errors, requests } = await openReframeFixture(page, "Video Outpaint");
  await page.route("**/api/health", route => route.fulfill({ json: { ok: true, routes: { ltxVfx: true } } }));
  const submissions = [];
  await page.route("**/api/node/utility-video", route => {
    submissions.push(route.request().postDataJSON());
    return route.fulfill({ json: {
      modelName: "LTX-2.5 Reframe",
      resultItems: [{ localUrl: "/outputs/e2e/reframe.mp4", type: "video", label: "Reframed video" }],
    } });
  });

  const node = page.locator('[data-node-card-id="reframe"]');
  const model = node.getByRole("combobox", { name: "Outpaint model" });
  await model.selectOption({ label: "LTX-2.5 Reframe" });
  await expect(node.getByRole("button", { name: "Prepare canvas & mask" })).toHaveCount(0);
  await node.getByRole("combobox", { name: "Aspect Ratio", exact: true }).selectOption("4:5");
  await node.getByRole("combobox", { name: "Resolution", exact: true }).selectOption("720p");
  await node.getByRole("combobox", { name: "Source Placement", exact: true }).selectOption("bottom");
  await expect(node.getByRole("figure", { name: "Reframe placement preview" })).toContainText("4:5 output");
  await node.getByRole("button", { name: "Run LTX-2.5 Reframe" }).click();
  await expect.poll(() => submissions.length).toBe(1);
  await expect.poll(() => node.locator('video[src*="reframe.mp4"]').count()).toBeGreaterThan(0);
  expect(submissions).toHaveLength(1);
  expect(submissions[0]).toMatchObject({
    model: "LTX-2.5 Reframe",
    referenceVideoUrls: ["/outputs/e2e/source.mp4"],
    canvasVideoUrl: "",
    ltxVfx: { aspect_ratio: "4:5", resolution: "720p", anchor: "bottom" },
  });
  expect(submissions[0]).not.toHaveProperty("videoOutpaintPrepared");
  expect(requests.some(request => request.path === "/api/node/video-outpaint-prepare")).toBe(false);

  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(model).toHaveValue("ltx-reframe");
  await expect(node.getByRole("combobox", { name: "Source Placement", exact: true })).toHaveValue("bottom");
  await model.selectOption("seedance-2.5");
  await expect(node.getByRole("button", { name: "Prepare canvas & mask" })).toBeVisible();
  expect(errors).toEqual([]);
});

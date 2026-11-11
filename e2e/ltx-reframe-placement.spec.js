import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("LTX Reframe previews the source frame at the selected aspect ratio and anchor", async ({ page }) => {
  const { errors, requests } = await openFixture(page, { fixture: {
    nodes: [
      { id: "source", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/source.mp4", status: "complete" } },
      { id: "reframe", type: "utility", x: 550, y: 20, data: { utilityMode: "video", utilityVideoModel: "LTX-2.5 Reframe", settingsOpen: true } },
    ],
    edges: [{ id: "source-wire", from: { nodeId: "source", port: "videoOut" }, to: { nodeId: "reframe", port: "referenceVideoIn" } }],
    groups: [],
    viewport: { x: 10, y: 10, scale: 0.8 },
  } });

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

import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Preview arrows navigate images from viewer and thumbnails without moving nodes", async ({page}) => {
  const images = [1, 2, 3].map(index => ({url: `/outputs/e2e/image-${index}.png`, type: "image", label: `Image ${index}`}));
  await page.addInitScript(images => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [
      {id: "source", type: "image", x: 10, y: 10, data: {title: "Images", resultItems: images, resultUrl: images[0].url, selectedResultIndex: 0}},
      {id: "viewer", type: "preview", x: 500, y: 10, data: {title: "Viewer"}}
    ], edges: [{id: "wire", from: {nodeId: "source", port: "imageOut"}, to: {nodeId: "viewer", port: "sourceIn"}}],
    groups: [], viewport: {x: 20, y: 20, scale: .8}
  })), images);
  const {errors} = await openFixture(page, {count: 2});
  const card = page.locator('[data-node-card-id="viewer"]');
  const viewer = card.getByRole("group", {name: "Preview image viewer", exact: true});
  const thumb = index => card.getByRole("button", {name: `Select preview ${index}`, exact: true});
  const position = () => page.locator('.react-flow__node[data-id="viewer"]').evaluate(element => element.style.transform);
  const before = await position();
  await viewer.click();
  await page.keyboard.press("ArrowRight");
  await expect(thumb(2)).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator("img")).toHaveAttribute("src", /image-2\.png/);
  await expect(viewer).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(thumb(1)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(thumb(3)).toHaveAttribute("aria-pressed", "true");
  await thumb(3).focus();
  await page.keyboard.press("ArrowRight");
  await expect(thumb(1)).toBeFocused();
  await expect(thumb(1)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(thumb(3)).toBeFocused();
  await expect(thumb(3)).toHaveAttribute("aria-pressed", "true");
  await expect(viewer.locator("img")).toHaveAttribute("src", /image-3\.png/);
  expect(await position()).toBe(before);
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "source").data.resultUrl)).toBe(images[2].url);
  expect(errors).toEqual([]);
});

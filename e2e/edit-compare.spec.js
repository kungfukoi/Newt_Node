import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

const node = (page, id) => page.locator('.react-flow__node[data-id="' + id + '"]');
const port = (page, key) => page.locator('[data-port-key="' + key + '"]');

async function dragBetween(page, from, to) {
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 12 });
  await page.mouse.up();
}

test("Edit compares two image or video inputs using the shared split viewer", async ({ page }) => {
  const source = (id, type, file, y) => ({
    id, type, x: 30, y, data: { title: id, resultUrl: "/outputs/e2e/" + file, status: "complete" }
  });
  const edit = (id, media, effect, x) => ({
    id, type: "edit", x, y: 30, data: { editSourceType: media, editEffect: effect, settingsOpen: true }
  });
  const edge = (sourceId, output, editId, input) => ({
    id: sourceId + "-" + input, from: { nodeId: sourceId, port: output }, to: { nodeId: editId, port: input }
  });
  const { errors } = await openFixture(page, {
    fixture: {
      nodes: [
        source("before-image", "image", "landscape.png", 30),
        source("after-image", "image", "edited.png", 350),
        edit("image-edit", "image", "imageCrop", 470),
        source("before-video", "video", "motion.mp4", 650),
        source("after-video", "video", "edited.mp4", 930),
        edit("video-edit", "video", "compare", 910)
      ],
      edges: [
        edge("before-image", "imageOut", "image-edit", "imageIn"),
        edge("before-video", "videoOut", "video-edit", "videoIn"),
        edge("after-video", "videoOut", "video-edit", "videoCompareIn")
      ],
      groups: [],
      viewport: { x: 25, y: 25, scale: 0.75 }
    }
  });

  const imageEdit = node(page, "image-edit");
  await imageEdit.getByRole("combobox").first().selectOption("compare");
  const image = imageEdit.getByRole("region", { name: "Image comparison" });
  await expect(image.getByRole("img", { name: "Original" })).toBeVisible();
  await expect(image.getByRole("button", { name: "Compare" })).toBeDisabled();
  const imageInput = port(page, "image-edit:imageCompareIn");
  await dragBetween(page, port(page, "before-video:videoOut"), imageInput);
  await expect(imageInput).not.toHaveClass(/connected/);
  await dragBetween(page, port(page, "after-image:imageOut"), imageInput);
  const divider = image.getByRole("slider", { name: "Compare divider" });
  await expect(divider).toHaveAttribute("aria-valuenow", "50");
  await expect(image.getByRole("img", { name: "Edit" })).toHaveAttribute("src", "/outputs/e2e/edited.png");
  await divider.press("Shift+ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "60");
  const viewport = image.locator(".edit-media-compare-viewport");
  const box = await viewport.boundingBox();
  const handle = await divider.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(divider).toHaveAttribute("aria-valuenow", "30");
  await image.getByRole("button", { name: "Original" }).click();
  await expect(divider).toHaveCount(0);
  await expect(image.locator('img[alt="Edit"]')).toBeHidden();
  await image.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(image.locator('img[alt="Original"]')).toBeHidden();
  await image.getByRole("button", { name: "Compare" }).click();
  await expect(divider).toHaveAttribute("aria-valuenow", "30");
  await expect(imageEdit.getByRole("button", { name: "Run Edit" })).toHaveCount(0);

  const video = node(page, "video-edit").getByRole("region", { name: "Video comparison" });
  const position = video.getByRole("slider", { name: "Comparison playback position" });
  const play = video.getByRole("button", { name: "Play" });
  await expect(play).toBeEnabled();
  await position.press("Home");
  await position.press("ArrowRight");
  await expect.poll(() => video.locator("video").evaluateAll(elements => elements.map(element => element.currentTime)))
    .toEqual([0.02, 0.02]);
  await play.click();
  await expect.poll(() => video.locator("video").evaluateAll(elements =>
    elements.every(element => !element.paused && element.currentTime > 0.1)
      && Math.abs(elements[0].currentTime - elements[1].currentTime) < 0.12
  )).toBe(true);
  await video.getByRole("button", { name: "Pause" }).click();
  await expect.poll(() => video.locator("video").evaluateAll(elements => elements.every(element => element.paused))).toBe(true);

  await imageEdit.getByRole("combobox").first().selectOption("imageCrop");
  await expect(imageInput).toHaveCount(0);
  await expect(port(page, "image-edit:imageIn")).toHaveClass(/connected/);
  expect(errors).toEqual([]);
});

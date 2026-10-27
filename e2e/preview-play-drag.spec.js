import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("native Preview play controls never attach the node to the mouse", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [
      { id: "video", type: "video", x: 20, y: 20, data: { resultUrl: "/outputs/e2e/motion.mp4", status: "complete" } },
      { id: "viewer", type: "preview", x: 550, y: 20, data: {} }
    ],
    edges: [{ id: "video-viewer", from: { nodeId: "video", port: "videoOut" }, to: { nodeId: "viewer", port: "sourceIn" } }],
    groups: [], viewport: { x: 20, y: 20, scale: 1 }
  })));
  const { errors } = await openFixture(page, { count: 2, scale: 1 });
  const card = page.locator('[data-node-card-id="viewer"]');
  const video = card.locator(".preview-stage video");
  await expect.poll(() => video.evaluate(v => v.readyState)).toBeGreaterThanOrEqual(2);
  const position = () => page.locator('.react-flow__node[data-id="viewer"]').evaluate(el => el.style.transform);
  const before = await position();
  // Model React replacing classes added by the interaction observer. This must
  // be repaired in capture phase, before the native drag listener sees down.
  await video.evaluate(v => {
    v.classList.remove("nodrag");
    v.parentElement.classList.remove("nodrag");
  });
  const box = await video.boundingBox();
  await page.mouse.move(box.x + 24, box.y + box.height - 48);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(() => video.evaluate(v => v.paused)).toBe(false);
  await page.mouse.move(box.x + 140, box.y + 40, { steps: 8 });
  expect(await position()).toBe(before);
  // Pause and play again after selection/render updates.
  await page.mouse.click(box.x + 24, box.y + box.height - 48);
  await expect.poll(() => video.evaluate(v => v.paused)).toBe(true);
  await page.mouse.click(box.x + 24, box.y + box.height - 48);
  await expect.poll(() => video.evaluate(v => v.paused)).toBe(false);
  await page.mouse.move(box.x + 200, box.y - 15, { steps: 8 });
  expect(await position()).toBe(before);
  const title = await card.locator(".node-title").boundingBox();
  await page.mouse.move(title.x + title.width / 2, title.y + title.height / 2);
  await page.mouse.down();
  await page.mouse.move(title.x + title.width / 2 + 60, title.y + 65, { steps: 8 });
  await page.mouse.up();
  await expect.poll(position).not.toBe(before);
  // Lose the native release after a real drag, as can happen over native media
  // controls. The next button-free movement must end D3 before it moves nodes.
  for (const recovery of ["move", "Escape", "blur"]) {
    const movedTitle = await card.locator(".node-title").boundingBox();
    await page.mouse.move(movedTitle.x + movedTitle.width / 2, movedTitle.y + 12);
    await page.mouse.down();
    await page.mouse.move(movedTitle.x + movedTitle.width / 2 + 30, movedTitle.y + 30, { steps: 5 });
    const atRelease = await position();
    await page.evaluate(() => {
      const consume = event => {
        if (!event.isTrusted) return;
        event.stopImmediatePropagation();
        window.removeEventListener(event.type, consume, true);
      };
      window.addEventListener("mouseup", consume, true);
      window.addEventListener("pointerup", consume, true);
    });
    await page.mouse.up();
    if (recovery === "Escape") await page.keyboard.press("Escape");
    if (recovery === "blur") await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.mouse.move(1200, 750, { steps: 8 });
    expect(await position()).toBe(atRelease);
    await expect(page.locator('.react-flow__node[data-id="viewer"]')).not.toHaveClass(/dragging/);
  }
  expect(errors).toEqual([]);
});

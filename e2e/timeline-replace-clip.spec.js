import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Ctrl/Command dropping bin media replaces one clip, preserves its slot, rejects invalid changes and supports undo/reopen", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return;
    sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({ nodes: [{ id: "timeline", type: "assembly", x: 20, y: 20, data: { title: "Timeline", assembly: {
      frameRate: 24, zoom: 72, outputWidth: 640, outputHeight: 360,
      media: [
        { id: "old", type: "video", url: "/outputs/e2e/old.mp4", label: "Original", duration: 5, hasAudioKnown: true },
        { id: "new", type: "video", url: "/outputs/e2e/new.mp4", label: "Replacement", duration: 4, hasAudioKnown: true },
        { id: "short", type: "video", url: "/outputs/e2e/short.mp4", label: "Too short", duration: 0.5, hasAudioKnown: true }
      ], tracks: [{ id: "v1", type: "video", name: "V1", clips: [
        { id: "slot", mediaId: "old", start: 0, duration: 2, sourceIn: 1, sourceDuration: 5, scale: 125 },
        { id: "other", mediaId: "old", start: 3, duration: 1, sourceIn: 0, sourceDuration: 5 }
      ] }]
    } } }], edges: [], groups: [], viewport: { x: 10, y: 10, scale: 0.8 } }));
  });
  const { errors } = await openFixture(page, { count: 1 });
  const card = page.locator('[data-node-card-id="timeline"]');
  const slot = card.locator('[data-clip-id="slot"]');
  async function drop(label, { ctrlKey = true, metaKey = false, drop = true } = {}) {
    await page.evaluate(({ label, ctrlKey, metaKey, drop }) => {
      const card = document.querySelector('[data-node-card-id="timeline"]');
      const source = [...card.querySelectorAll('.assembly-media-bin-item')].find(item => item.querySelector('strong')?.textContent === label);
      const target = card.querySelector('[data-clip-id="slot"] span');
      const transfer = new DataTransfer();
      source.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: transfer }));
      target.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer, ctrlKey, metaKey }));
      if (drop) {
        target.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer, ctrlKey, metaKey }));
        source.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: transfer }));
      }
    }, { label, ctrlKey, metaKey, drop });
  }
  await drop("Replacement", { drop: false });
  await expect(slot).toHaveClass(/is-replace-target/);
  await drop("Replacement");
  await expect(slot.locator("span")).toHaveText("Replacement");
  await expect(card.locator(".assembly-clip")).toHaveCount(2);
  await expect(card.locator('[data-clip-id="other"] span')).toHaveText("Original");
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes[0].data.assembly.tracks[0].clips.find(c => c.id === "slot"))).toMatchObject({ mediaId: "new", start: 0, duration: 2, scale: 125, sourceIn: 0 });
  await card.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(slot.locator("span")).toHaveText("Original");
  await card.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(slot.locator("span")).toHaveText("Replacement");
  await drop("Too short");
  await expect(card.getByRole("alert")).toContainText("Replacement needs at least");
  await expect(slot.locator("span")).toHaveText("Replacement");
  await card.getByRole("button", { name: "Lock track", exact: true }).click();
  await drop("Original");
  await expect(card.getByRole("alert")).toContainText("Unlock");
  await expect(slot.locator("span")).toHaveText("Replacement");
  await card.getByRole("button", { name: "Unlock track", exact: true }).click();
  await drop("Original", { ctrlKey: false, metaKey: true });
  await expect(slot.locator("span")).toHaveText("Original");
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(slot.locator("span")).toHaveText("Original");
  await expect(card.locator(".assembly-clip")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("timeline-replace-clip.png") });
  expect(errors).toEqual([]);
});

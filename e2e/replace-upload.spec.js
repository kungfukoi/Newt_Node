import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Replace upload opens picker, clears stale thumbnail, accepts same file again and preserves failed replacements", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "source", type: "image", x: 30, y: 30, data: { title: "Source", resultUrl: "/outputs/e2e/landscape.png", thumbnailUrl: "/outputs/e2e/old-thumbnail.png", fileName: "old.png", status: "ready" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 }
  })));
  const { errors } = await openFixture(page, { count: 1 });
  let uploads = 0;
  await page.route("**/api/node/upload-asset", async route => {
    uploads++;
    if (uploads === 3) return route.fulfill({ status: 400, json: { error: "Upload failed for test" } });
    await route.fulfill({ json: { asset: { localUrl: `/outputs/e2e/replacement-${uploads}.png`, mediaType: "image", mimeType: "image/png", fileName: "replacement.png" } } });
  });
  const card = page.locator('[data-node-card-id="source"]');
  const file = { name: "replacement.png", mimeType: "image/png", buffer: Buffer.from("fixture") };
  for (let i = 1; i <= 3; i++) {
    const chooser = page.waitForEvent("filechooser");
    await card.getByText("Replace upload", { exact: true }).click();
    await (await chooser).setFiles(file);
    await expect.poll(() => uploads).toBe(i);
    if (i < 3) await expect(card.locator(".media-preview img")).toHaveAttribute("src", /replacement-/);
    else await expect(card.getByText("Upload failed for test")).toBeVisible();
    await expect(card.locator('input[type="file"]')).toHaveValue("");
    await expect(card.locator(".media-preview img")).not.toHaveAttribute("src", /old-thumbnail/);
  }
  await expect(card.locator(".media-preview img")).toHaveAttribute("src", /replacement-2/);
  expect(errors.filter(message => !message.includes("400"))).toEqual([]);
});

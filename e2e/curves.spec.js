import { test, expect } from "@playwright/test";
import { openFixture, wireAttachmentErrors } from "./helpers.mjs";

test("switching a connected Edit node to Curves keeps the card and wire visible", async ({ page }) => {
  const edge = { id: "source-curves", from: { nodeId: "source", port: "imageOut" }, to: { nodeId: "curves", port: "imageIn" } };
  await page.addInitScript((edge) => {
    if (sessionStorage.getItem("seedance-node-editor-draft-v1")) return;
    sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [
      { id: "source", type: "image", x: 30, y: 30, data: { title: "Source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } },
      { id: "curves", type: "edit", x: 510, y: 30, data: { title: "Edit", editSourceType: "image", editEffect: "tone", settingsOpen: true } }
    ],
    edges: [edge], groups: [], viewport: { x: 20, y: 20, scale: 0.8 }
    }));
  }, edge);
  const renderErrors = [];
  page.on("console", (message) => { if (message.type() === "error") renderErrors.push(message.text()); });
  const { errors } = await openFixture(page, { count: 2 });
  const card = page.locator('[data-node-card-id="curves"]');
  const effect = card.locator("select").filter({ has: page.locator('option[value="curves"]') });
  await effect.selectOption("curves");
  await expect(card.locator(".edit-image-curves-graph")).toBeVisible();
  await expect(page.locator(".node-card-error")).toHaveCount(0);
  const graph = card.locator(".edit-image-curves-graph");
  await graph.click({ position: { x: 85, y: 45 } });
  await expect(graph.locator("circle")).toHaveCount(1);
  await expect.poll(() => card.locator(".edit-image-editor-stage img").getAttribute("src")).toMatch(/^blob:/);
  await expect.poll(async () => (await wireAttachmentErrors(page, [edge])).every((wire) => !wire.missing && wire.start < 2 && wire.end < 2)).toBeTruthy();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1"))?.nodes.find((node) => node.id === "curves")?.data.editSettings?.points?.length)).toBe(3);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(graph).toBeVisible();
  await expect(graph.locator("circle")).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(renderErrors).toEqual([]);
});

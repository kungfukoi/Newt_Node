import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Director and prompt tags share one original Character reference in Video", async ({ page }) => {
  const fixture = {
    projectId: "director-reference-regression", projectName: "Director references",
    viewport: { x: 0, y: 0, scale: 0.8 }, groups: [],
    nodes: [
      { id: "guy1", type: "character", x: 1600, y: 0, data: {
        title: "Character", characterName: "guy1", locked: true, activated: true,
        resultUrl: "/outputs/e2e/guy1.png", characterTab: "sheet"
      } },
      { id: "room", type: "image", x: 1600, y: 600, data: {
        title: "Room", resultUrl: "/outputs/e2e/room.png"
      } },
      { id: "director", type: "skillDirector", x: 2500, y: 0, data: {
        title: "Director", skillDirectorBuilt: true, resultText: "@guy1 enters @Room. @guy1 looks around.",
        lastRunReferenceTags: ["@guy1", "@Room"], skillVideoModel: "Seedance 2.5"
      } },
      { id: "video", type: "videoModel", x: 30, y: 30, data: {
        title: "Video", model: "Seedance 2.5", prompt: "@guy1 stands in @Room.",
        nodeReferenceBindings: { guy1: "guy1", room: "room" }
      } }
    ],
    edges: [
      { id: "character-director", from: { nodeId: "guy1", port: "characterOut" }, to: { nodeId: "director", port: "characterIn" } },
      { id: "room-director", from: { nodeId: "room", port: "imageOut" }, to: { nodeId: "director", port: "locationIn" } },
      { id: "director-video", from: { nodeId: "director", port: "directorOut" }, to: { nodeId: "video", port: "directorIn" } },
      { id: "character-video", from: { nodeId: "guy1", port: "characterOut" }, to: { nodeId: "video", port: "characterIn" } }
    ]
  };
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) {
      sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(value));
    }
  }, fixture);
  const { errors } = await openFixture(page, { count: 4 });
  const video = page.locator('[data-node-card-id="video"]');
  const chips = video.locator(".reference-tag-chip");
  await expect(chips.filter({ hasText: /^@guy1$/ })).toHaveCount(1);
  await expect(chips.filter({ hasText: /^@Room$/ })).toHaveCount(1);
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(chips.filter({ hasText: /^@guy1$/ })).toHaveCount(1);
  await expect(chips.filter({ hasText: /^@Room$/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("local-only Character sheets survive reload and supply the active reference to Storyboard", async ({ page }) => {
  const graph = { nodes: [
    { id: "alex", type: "character", x: 10, y: 10, data: {
      title: "Alex", characterName: "Alex", characterTab: "sheet", locked: true, activated: true,
      resultUrl: "/outputs/e2e/stale.png", activeCharacterSheetId: "generated:coat", characterSheetModel: "Nano Banana 2",
      stylizedCharacter: true, cinematicCharacterSheet: true, characterReferenceNotes: "Keep the original design",
      characterSheetVariants: [
        { wardrobeId: "__default-wardrobe__", isBase: true, generated: { localUrl: "/outputs/e2e/base.png" } },
        { wardrobeId: "coat", wardrobeFileName: "Coat", generated: { localUrl: "/outputs/e2e/coat.png" }, videoGenerated: { localUrl: "/outputs/e2e/cu-coat.png" } }
      ]
    } },
    { id: "board", type: "storyboard", x: 800, y: 10, data: {
      title: "Board", storyboardTab: "view", sceneDescription: "@Alex waits", storyboardPlanSceneDescription: "@Alex waits",
      useInternalStoryboardCharacters: false, storyboardAutoQc: false,
      storyboardFrames: [{ id: "panel", number: 1, prompt: "@Alex waits screen-left foreground", beat: "@Alex waits", shot: "MS", lens: "35mm", angle: "None", notes: "" }]
    } }
  ], edges: [{ id: "character-board", from: { nodeId: "alex", port: "characterOut" }, to: { nodeId: "board", port: "characterIn" } }], groups: [], viewport: { x: 0, y: 0, scale: 0.55 } };
  await page.addInitScript(graph => {
    if (!sessionStorage.getItem("seedance-node-editor-draft-v1")) sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(graph));
  }, graph);
  const { errors } = await openFixture(page, { count: 2, settings: { falKeyConfigured: true, modelProviderPreferences: { imageGeneration: "fal", llm: "fal" } } });
  const character = page.locator('[data-node-card-id="alex"]');
  const board = page.locator('[data-node-card-id="board"]');
  await character.getByRole("tab", { name: "Character Build", exact: true }).click();
  await expect(character.locator('[title="Use Base Identity"]')).toBeVisible();
  await expect(character.locator('[title="Use Coat"]')).toHaveClass(/active/);
  const saved = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")));
  await expect.poll(async () => (await saved()).nodes.find(node => node.id === "alex").data.resultUrl).toBe("/outputs/e2e/coat.png");
  let request;
  await page.route("**/api/node/generate-image", route => { request = route.request().postDataJSON(); return route.fulfill({ json: { images: [{ localUrl: "/outputs/e2e/panel.png", mimeType: "image/png" }] } }); });
  await page.route("**/api/node/storyboard-export-frame", route => route.fulfill({ json: { frame: { localUrl: "/outputs/e2e/panel.png", fileName: "panel.png" } } }));
  await board.getByRole("button", { name: "Generate Missing", exact: true }).click();
  await expect.poll(() => request?.imagePromptUrls || []).toContain("/outputs/e2e/coat.png");
  expect(request.imagePromptUrls).not.toContain("/outputs/e2e/base.png");
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await character.getByRole("tab", { name: "Character Build", exact: true }).click();
  await expect(character.locator('[title="Use Coat"]')).toHaveClass(/active/);
  const state = (await saved()).nodes.find(node => node.id === "alex").data;
  expect(state.characterSheetModel).toBe("Nano Banana 2");
  expect(state.stylizedCharacter).toBe(true);
  expect(state.characterReferenceNotes).toBe("Keep the original design");
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { characterBaseGenerationSignature, characterBaseVideoGenerationSignature, characterWardrobeEditVersion } from "../src/characterSheetWorkflow.js";

for (const source of ["upload", "output drop"]) {
test(`adding a wardrobe by ${source} unlocks a Character until both new sheets finish`, async ({ page }) => {
  const data = {
    title: "Alex", characterName: "Alex", characterTab: "build", locked: true, activated: true,
    status: "ready", cuVideoGeneration: true, characterSheetModel: "Nano Banana 2",
    characterPortrait: { localUrl: "/outputs/e2e/portrait.png" },
    characterBaseSheet: { localUrl: "/outputs/e2e/base.png" },
    characterBaseVideoSheet: { localUrl: "/outputs/e2e/cu-base.png" },
    characterWardrobes: [{ id: "coat", localUrl: "/outputs/e2e/coat-ref.png", fileName: "Coat" }],
    activeWardrobeId: "coat", activeCharacterSheetId: "generated:coat", resultUrl: "/outputs/e2e/coat.png"
  };
  data.characterBaseSignature = characterBaseGenerationSignature(data);
  data.characterBaseVideoSignature = characterBaseVideoGenerationSignature(data);
  data.characterSheetVariants = [{
    wardrobeId: "coat", wardrobeUrl: "/outputs/e2e/coat-ref.png", wardrobeFileName: "Coat",
    wardrobeEditVersion: characterWardrobeEditVersion, baseSignature: data.characterBaseSignature,
    baseVideoSignature: data.characterBaseVideoSignature,
    generated: { localUrl: "/outputs/e2e/coat.png" }, videoGenerated: { localUrl: "/outputs/e2e/cu-coat.png" }
  }];
  await page.addInitScript(data => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "alex", type: "character", x: 10, y: 10, data }], edges: [], groups: [], viewport: { x: 0, y: 0, scale: .8 }
  })), data);
  const { errors } = await openFixture(page, { count: 1 });
  await page.route("**/api/node/upload-asset", route => route.fulfill({ json: { asset: { localUrl: "/outputs/e2e/new-ref.png", fileName: "New outfit" } } }));
  const requests = [];
  let releaseCu;
  const cuGate = new Promise(resolve => { releaseCu = resolve; });
  await page.route("**/api/node/generate-image", async route => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 2) await cuGate;
    await route.fulfill({ json: { image: { localUrl: requests.length === 1 ? "/outputs/e2e/new.png" : "/outputs/e2e/new-cu.png" } } });
  });
  const character = page.locator('[data-node-card-id="alex"]');
  if (source === "upload") {
    await character.locator('[title="Upload wardrobe images"] input').setInputFiles({ name: "outfit.png", mimeType: "image/png", buffer: Buffer.from("fixture") });
  } else {
    await character.locator(".character-section.wardrobe").evaluate(element => {
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("application/x-newtnode-output", JSON.stringify({ type: "image", url: "/outputs/e2e/new-ref.png", fileName: "New outfit" }));
      element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer }));
    });
  }
  const state = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "alex").data);
  await expect.poll(() => requests.length).toBe(2);
  await expect(character.getByRole("button", { name: "Generating...", exact: true })).toBeDisabled();
  await expect.poll(async () => (await state()).locked).toBe(false);
  await expect.poll(async () => (await state()).characterSheetVariants.some(variant => variant.generated?.url === "/outputs/e2e/new.png")).toBe(true);
  expect(requests[0].imagePromptUrls[0]).toBe("/outputs/e2e/base.png");
  expect(requests[1].imagePromptUrls[0]).toBe("/outputs/e2e/cu-base.png");
  releaseCu();
  await expect.poll(async () => (await state()).locked).toBe(true);
  const completed = await state();
  expect(completed.characterSheetVariants.find(variant => variant.wardrobeId === "coat").generated.localUrl).toBe("/outputs/e2e/coat.png");
  expect(completed.characterSheetVariants.some(variant => variant.videoGenerated?.url === "/outputs/e2e/new-cu.png")).toBe(true);
  expect(requests).toHaveLength(2);
  expect(errors).toEqual([]);
});
}

test("completed image and CU wardrobe sheets remain viewable during character generation", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "alex", type: "character", x: 10, y: 10, data: {
      title: "Alex", characterName: "Alex", status: "compiling", characterTab: "build", cuVideoGeneration: true,
      characterBatchProgress: { completed: 3, total: 4 },
      characterSheetVariants: [{ wardrobeId: "coat", wardrobeFileName: "Coat", generated: { localUrl: "/outputs/e2e/coat.png" }, videoGenerated: { localUrl: "/outputs/e2e/cu-coat.png" } }]
    } }], edges: [], groups: [], viewport: { x: 0, y: 0, scale: .8 }
  })));
  const { errors } = await openFixture(page, { count: 1 });
  const character = page.locator('[data-node-card-id="alex"]');
  const cu = character.locator('[title="Use Coat · CU Video"]');
  await expect(cu).toBeEnabled();
  await expect(character.locator('[title="Use Coat"]')).toBeEnabled();
  await cu.click();
  await expect(character.getByRole("tab", { name: "CU Video Sheet", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(character.locator('.character-sheet-drag-source img')).toHaveAttribute("src", /cu-coat/);
  expect(errors).toEqual([]);
});

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

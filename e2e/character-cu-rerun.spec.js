import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

for (const fails of [false, true]) {
  test(`CU thumbnail rerun ${fails ? "preserves the previous CU on failure" : "replaces only the selected CU"}`, async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
      nodes: [{ id: "alex", type: "character", x: 10, y: 10, data: {
        title: "Alex", characterName: "Alex", characterTab: "build", locked: true, activated: true,
        status: "ready", cuVideoGeneration: true, characterSheetModel: "Nano Banana 2",
        characterPortrait: { localUrl: "/outputs/e2e/portrait.png" },
        characterBaseSheet: { localUrl: "/outputs/e2e/base.png" },
        characterBaseVideoSheet: { localUrl: "/outputs/e2e/cu-base.png" },
        characterWardrobes: [{ id: "coat", localUrl: "/outputs/e2e/coat-ref.png", fileName: "Coat" }],
        activeWardrobeId: "coat", activeCharacterSheetId: "generated:coat",
        characterSheetVariants: [{ wardrobeId: "coat", wardrobeFileName: "Coat",
          generated: { localUrl: "/outputs/e2e/coat.png" }, videoGenerated: { localUrl: "/outputs/e2e/cu-coat.png" } }]
      } }], edges: [], groups: [], viewport: { x: 0, y: 0, scale: .8 }
    })));
    const { errors } = await openFixture(page, { count: 1 });
    const requests = [];
    await page.route("**/api/node/generate-image", async route => {
      requests.push(route.request().postDataJSON());
      await route.fulfill(fails
        ? { status: 400, json: { error: "Mock CU failure" } }
        : { json: { image: { localUrl: "/outputs/e2e/new-cu.png" } } });
    });
    const character = page.locator('[data-node-card-id="alex"]');
    await character.getByRole("button", { name: "Regenerate Coat · CU Video", exact: true }).click();
    const state = () => page.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.find(node => node.id === "alex").data);
    await expect.poll(() => requests.length).toBe(1);
    if (!fails) await expect.poll(async () => (await state()).characterSheetVariants[0].videoGenerated.url).toBe("/outputs/e2e/new-cu.png");
    await expect.poll(async () => (await state()).status).toBe(fails ? "error" : "ready");
    const completed = await state();
    expect(completed.characterSheetVariants[0].generated.localUrl).toBe("/outputs/e2e/coat.png");
    const cu = completed.characterSheetVariants[0].videoGenerated;
    expect(cu.localUrl || cu.url).toBe(fails ? "/outputs/e2e/cu-coat.png" : "/outputs/e2e/new-cu.png");
    expect(completed.characterBaseVideoSheet.localUrl).toBe("/outputs/e2e/cu-base.png");
    expect(completed.locked).toBe(true);
    expect(requests[0].imagePromptUrls[0]).toBe("/outputs/e2e/cu-base.png");
    expect(requests[0].imagePromptUrls).toContain("/outputs/e2e/coat.png");
    expect(requests[0].imagePromptUrls).toEqual(["/outputs/e2e/cu-base.png", "/outputs/e2e/coat.png"]);
    expect(requests[0].prompt).toContain("sole source for identity and wardrobe");
    if (!fails) {
      expect(completed.characterSheetPreviewKind).toBe("video");
      await expect(character.locator('[title="Use Coat · CU Video"]')).toHaveClass(/active/);
    }
    expect(errors).toEqual([]);
  });
}

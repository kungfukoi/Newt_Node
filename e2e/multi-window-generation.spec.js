import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("two Newt windows keep separate drafts and can submit concurrent generations", async ({ page, context }) => {
  const second = await context.newPage();
  const requests = [], pending = [];
  async function windowFixture(window, id) {
    await window.addInitScript(({ id }) => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
      nodes: [{ id, type: "imageModel", x: 20, y: 20, data: { title: id, model: "OpenAI Image 2.5 Flare", prompt: `A ${id} image` } }],
      edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 }
    })), { id });
    const fixture = await openFixture(window, { count: 1, settings: { falKeyConfigured: true, modelProviderPreferences: { imageGeneration: "fal" } } });
    await window.route("**/api/node/generate-image", route => {
      requests.push(route.request().postDataJSON()); pending.push(route);
    });
    return fixture;
  }
  const a = await windowFixture(page, "shot6"), b = await windowFixture(second, "shot7");
  await Promise.all([page.getByRole("button", { name: /^Run Image/ }).click(), second.getByRole("button", { name: /^Run Image/ }).click()]);
  await expect.poll(() => requests.length).toBe(2);
  expect(requests.map(request => request.nodeId).sort()).toEqual(["shot6", "shot7"]);
  expect(new Set(requests.map(request => request.generationRunId)).size).toBe(2);
  for (const route of pending) await route.fulfill({ json: { images: [{ localUrl: `/outputs/e2e/${route.request().postDataJSON().nodeId}.png`, fileName: "generated.png", mimeType: "image/png" }] } });
  await expect(page.locator('[data-node-card-id="shot6"] img').first()).toHaveAttribute("src", /shot6.png/);
  await expect(second.locator('[data-node-card-id="shot7"] img').first()).toHaveAttribute("src", /shot7.png/);
  const draftIds = window => window.evaluate(() => JSON.parse(sessionStorage.getItem("seedance-node-editor-draft-v1")).nodes.map(node => node.id));
  expect(await draftIds(page)).toEqual(["shot6"]); expect(await draftIds(second)).toEqual(["shot7"]);
  expect(a.errors).toEqual([]); expect(b.errors).toEqual([]);
  await second.close();
});

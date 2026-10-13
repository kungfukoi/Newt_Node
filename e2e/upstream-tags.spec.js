import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

for (const type of ["videoModel", "imageModel", "text"]) {
  test(`${type} tags collect only upstream assets, including connected prompt text after reload`, async ({ page }) => {
    const targetPort = type === "videoModel" ? "referenceImageIn" : type === "imageModel" ? "imagePromptIn" : "imageIn";
    const fixture = { projectId: "upstream-tags", projectName: "Upstream tags", groups: [], viewport: { x: 0, y: 0, scale: 0.8 },
      nodes: [
        { id: "model", type, x: 30, y: 30, data: { title: "Consumer", model: type === "videoModel" ? "Seedance 2.5" : "OpenAI Image 2.5 Flare", prompt: "Use @Hero @Ghost @After", text: "Use @Hero @Ghost @After", nodeReferenceBindings: { hero: "hero", ghost: "ghost", after: "after" } } },
        { id: "prompt", type: "plainText", x: 2000, y: 0, data: { title: "Prompt", text: "Use @Hero @Ghost @After", nodeReferenceBindings: { hero: "hero", ghost: "ghost", after: "after" } } },
        { id: "hero", type: "image", x: 2000, y: 500, data: { title: "Hero", resultUrl: "/outputs/e2e/hero.png" } },
        { id: "relay", type: "imageModel", x: 3000, y: 500, data: { title: "Relay", model: "OpenAI Image 2.5 Flare", resultUrl: "/outputs/e2e/relay.png", status: "complete" } },
        { id: "ghost", type: "image", x: 2000, y: 1000, data: { title: "Ghost", resultUrl: "/outputs/e2e/ghost.png" } },
        { id: "after", type: "imageModel", x: 3000, y: 1000, data: { title: "After", model: "OpenAI Image 2.5 Flare", resultUrl: "/outputs/e2e/after.png" } }
      ], edges: [
        { id: "prompt-model", from: { nodeId: "prompt", port: "promptOut" }, to: { nodeId: "model", port: type === "text" ? "textIn" : "promptIn" } },
        { id: "hero-relay", from: { nodeId: "hero", port: "imageOut" }, to: { nodeId: "relay", port: "imagePromptIn" } },
        { id: "relay-model", from: { nodeId: "relay", port: "imageOut" }, to: { nodeId: "model", port: targetPort } },
        { id: "model-after", from: { nodeId: "model", port: type === "videoModel" ? "videoOut" : type === "text" ? "promptOut" : "imageOut" }, to: { nodeId: "after", port: type === "imageModel" ? "imagePromptIn" : "promptIn" } }
      ] };
    if (type !== "imageModel") fixture.edges.pop();
    await page.addInitScript(value => {
      const key = "seedance-node-editor-draft-v1";
      if (!sessionStorage.getItem(key)) sessionStorage.setItem(key, JSON.stringify(value));
      const connected = sessionStorage.getItem("upstream-tags-test-connection");
      if (connected !== null) {
        const graph = JSON.parse(sessionStorage.getItem(key));
        graph.edges = graph.edges.filter(edge => edge.id !== "hero-relay");
        if (connected === "true") graph.edges.push(value.edges.find(edge => edge.id === "hero-relay"));
        sessionStorage.setItem(key, JSON.stringify(graph));
      }
    }, fixture);
    const { errors } = await openFixture(page, { count: fixture.nodes.length, settings: { falKeyConfigured: true } });
    const card = page.locator('[data-node-card-id="model"]');
    const requests = [];
    const routePattern = type === "videoModel" ? "**/api/node/generate-video" : type === "imageModel" ? "**/api/node/generate-image" : "**/api/node/process-text";
    await page.route(routePattern, route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: type === "videoModel" ? { video: { localUrl: "/outputs/e2e/motion.mp4" } } : type === "imageModel" ? { images: [{ localUrl: "/outputs/e2e/generated.png" }] } : { text: "Done" } });
    });
    for (let run = 0; run < 4; run++) {
      if (run >= 2) {
        await page.evaluate(connected => sessionStorage.setItem("upstream-tags-test-connection", String(connected)), run === 3);
      }
      if (run) { await page.reload(); await page.getByRole("button", { name: "Nodes", exact: true }).click(); }
      await card.locator(".run-node-button").first().click();
      await expect.poll(() => requests.length).toBe(run + 1);
      const payload = JSON.stringify(requests[run]);
      const urls = type === "videoModel" ? requests[run].referenceImageUrls : type === "imageModel" ? requests[run].imagePromptUrls : requests[run].imageInputs.map(item => item.url);
      if (run === 2) {
        expect(urls).not.toContain("/outputs/e2e/hero.png");
        expect(payload).not.toContain("/outputs/e2e/hero.png");
      } else {
        expect(urls).toContain("/outputs/e2e/hero.png");
        expect(payload).toContain("/outputs/e2e/hero.png");
      }
      expect(payload).not.toContain("/outputs/e2e/ghost.png");
      expect(payload).not.toContain("/outputs/e2e/after.png");
      await expect(card.locator(".run-node-button").first()).toBeEnabled();
    }
    expect(errors).toEqual([]);
  });
}

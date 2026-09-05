import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { canvasFixture, fixtureProjectId } from "./fixtures.mjs";

export async function openFixture(page, options = {}) {
  const fixture = canvasFixture(options);
  const errors = [];
  const requests = [];
  let dismissed = false;
  let diagnosticsEnabled = false;
  page.on("pageerror", (error) => errors.push(error.message));
  const png = await readFile(new URL("./.generated/landscape.png", import.meta.url));
  const video = await readFile(new URL("./.generated/motion.mp4", import.meta.url));
  await page.addInitScript((fixture) => {
    if (!localStorage.getItem("seedance-node-editor-draft-v1")) localStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify(fixture));
  }, fixture);
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const json = (value) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(value) });
    if (path.startsWith("/outputs/") || path === "/api/media-thumbnail" || path === "/api/video-poster") {
      const isVideo = path.endsWith(".mp4");
      const headers = { "Access-Control-Allow-Origin": "*", "Accept-Ranges": "bytes" };
      const range = isVideo && request.headers().range?.match(/^bytes=(\d+)-(\d*)$/);
      if (range) {
        const start = Number(range[1]); const end = Math.min(video.length - 1, range[2] ? Number(range[2]) : video.length - 1);
        return route.fulfill({ status: 206, contentType: "video/mp4", headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${video.length}` }, body: video.subarray(start, end + 1) });
      }
      return route.fulfill({ status: 200, headers, contentType: isVideo ? "video/mp4" : "image/png", body: isVideo ? video : png });
    }
    if (path.startsWith("/api/")) {
      requests.push({ path, method: request.method() });
      if (path === "/api/health") return json({ ok: true, version: "e2e", routes: { settings: true, generationProgress: true, remoteVideoJobs: true, mediaThumbnail: true } });
      if (path === "/api/settings") return json({ version: "e2e", branch: "fixture", apiKeysFound: false, modelProviderPreferences: { seedance: "fal" } });
      if (path === "/api/generation-progress") return json({ entries: [] });
      if (path === "/api/node/generate-image") return json({ images: [{ localUrl: "/outputs/e2e/generated.png", fileName: "generated.png", mimeType: "image/png" }] });
      if (path === "/api/remote-video-jobs") return json({ jobs: options.attention ? [{ runId: "uncertain-fixture", nodeId: "model", groupId: "group", batchIndex: 1, state: dismissed ? "dismissed" : "uncertain", provider: "fal", scope: JSON.stringify([fixtureProjectId, "", ""]), createdAt: "2026-09-04T00:00:00Z", message: "Needs attention: acceptance unknown" }] : [], cursor: "fixture:0", reset: true, pollAfterMs: 15000 });
      if (path === "/api/remote-video-jobs/uncertain-fixture/recover") { dismissed = true; return json({ job: { state: "dismissed" } }); }
      if (path === "/api/system/performance-diagnostics") {
        if (request.method() === "POST") diagnosticsEnabled = Boolean(request.postDataJSON().enabled);
        return json({ enabled: diagnosticsEnabled, version: "e2e", commit: "fixture", uptimeSeconds: 30, supervisor: { enabled: true, restarts: 0 } });
      }
      if (path === "/api/project-outputs") {
        const start = Number(url.searchParams.get("cursor")) || 0;
        const items = Array.from({ length: Math.min(100, 1000 - start) }, (_, i) => ({ id: `output-${start + i}`, url: `/outputs/e2e/take-${start + i}.mp4`, type: "video", label: `Take ${start + i}`, createdAt: new Date(1700000000000 - (start + i) * 1000).toISOString() }));
        return json({ items: url.searchParams.get("projectId") === fixtureProjectId ? items : [], total: 1000, nextCursor: start + 100 < 1000 ? String(start + 100) : "" });
      }
      if (path === "/api/system/select-folder") return json({ path: "C:/fixtures/SavedAs", canceled: false });
      if (path === "/api/saved-workflows" && request.method() === "POST") {
        const data = request.postDataJSON();
        return json({ id: data.id || "fixture-clone", name: data.name, fileName: "Fixture.json", packagePath: "C:/fixtures/SavedAs/Fixture", graph: { nodes: data.nodes, edges: data.edges, groups: data.groups, viewport: data.viewport } });
      }
      if (path === "/api/node-projects" || path === "/api/saved-workflows" || path === "/api/history") return json([]);
      if (path.includes("output-path")) return json({ path: "C:/fixtures/outputs" });
      // All unimplemented APIs are local mocks, never forwarded to a user's API.
      return json({ ok: true, entries: [], items: [] });
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(fixture.nodes.length);
  await expect(page.getByText("Nodes failed to load.", { exact: false })).toHaveCount(0);
  return { fixture, errors, requests };
}

export async function wireGeometry(page) {
  return page.locator(".newt-flow-edge-visible").evaluateAll((paths) => paths.map((path) => {
    const length = path.getTotalLength();
    const start = path.getPointAtLength(0); const end = path.getPointAtLength(length);
    return { id: path.closest(".react-flow__edge")?.getAttribute("data-id"), length, start: { x: start.x, y: start.y }, end: { x: end.x, y: end.y } };
  }));
}

export async function wireAttachmentErrors(page, edges) {
  return page.evaluate((edges) => edges.map((edge) => {
    const line = document.querySelector(`[data-edge-id="${CSS.escape(edge.id)}"] .newt-flow-edge-visible`);
    const source = document.querySelector(`[data-port-key="${CSS.escape(`${edge.from.nodeId}:${edge.from.port}`)}"]`);
    const target = document.querySelector(`[data-port-key="${CSS.escape(`${edge.to.nodeId}:${edge.to.port}`)}"]`);
    if (!line || !source || !target) return { id: edge.id, missing: true };
    const matrix = line.getScreenCTM();
    const start = line.getPointAtLength(0).matrixTransform(matrix);
    const end = line.getPointAtLength(line.getTotalLength()).matrixTransform(matrix);
    const a = source.getBoundingClientRect(); const b = target.getBoundingClientRect();
    // React Flow joins the outward handle edge rather than its center.
    return { id: edge.id, start: Math.hypot(start.x - a.right, start.y - a.y - a.height / 2), end: Math.hypot(end.x - b.left, end.y - b.y - b.height / 2) };
  }), edges);
}

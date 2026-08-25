import assert from "node:assert/strict";
import test from "node:test";

import { nodeApi, systemApi, workflowApi } from "../src/api/newtApi.js";

function jsonResponse(body = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

test("canvas folder actions use the client proxy while generations stay on the API origin", async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const urls = [];
  globalThis.window = {
    location: { hostname: "127.0.0.1", port: "5176" }
  };
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return jsonResponse({ ok: true, path: "C:\\Project\\outputs" });
  };

  try {
    await systemApi.openProjectOutputFolder({ workflowPackageId: "project-1" });
    await nodeApi.generateImage({ prompt: "test" });

    assert.equal(urls[0], "/api/system/open-project-output-folder");
    assert.equal(urls[1], "http://127.0.0.1:3336/api/node/generate-image");
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

test("workflow save requests use the responsive control lane", async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const urls = [];
  globalThis.window = {
    location: { hostname: "127.0.0.1", port: "5176" }
  };
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return jsonResponse({ ok: true });
  };

  try {
    await systemApi.saveWorkflowFile({ filePath: "C:\\Project\\project.json", workflow: {} });
    await workflowApi.save({ id: "project-1", nodes: [] });
    await workflowApi.autosave({ workflow: { id: "project-1" } });
    assert.deepEqual(urls, [
      "/api/system/save-workflow-file",
      "/api/saved-workflows",
      "/api/saved-workflows/autosave"
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

test("workflow JSON saves retry directly when the client proxy stops responding", async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const urls = [];
  globalThis.window = {
    location: { hostname: "127.0.0.1", port: "5176" }
  };
  globalThis.fetch = (url, options = {}) => {
    urls.push(String(url));
    if (String(url) !== "/api/system/save-workflow-file") return Promise.resolve(jsonResponse({ ok: true }));
    return new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
    });
  };

  try {
    const { response } = await (await import("../src/api/newtApi.js")).fetchJsonApi(
      "/api/system/save-workflow-file",
      { method: "POST", body: "{}" },
      "Save workflow",
      { preferClientProxy: true, timeoutMs: 5 }
    );
    assert.equal(response.ok, true);
    assert.deepEqual(urls, [
      "/api/system/save-workflow-file",
      "http://127.0.0.1:3336/api/system/save-workflow-file"
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

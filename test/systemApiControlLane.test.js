import assert from "node:assert/strict";
import test from "node:test";

import { nodeApi, systemApi, workflowApi } from "../src/api/newtApi.js";

function jsonResponse(body = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

test("canvas folder actions use the control server while generations stay on the API origin", async () => {
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

    assert.deepEqual(urls.slice(0, 3), [
      "http://127.0.0.1:3337/api/system/control-health",
      "/api/system/control-health",
      "http://127.0.0.1:3337/api/system/open-project-output-folder"
    ]);
    assert.equal(urls[3], "http://127.0.0.1:3336/api/node/generate-image");
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
      "http://127.0.0.1:3337/api/system/save-workflow-file",
      "http://127.0.0.1:3337/api/saved-workflows",
      "http://127.0.0.1:3337/api/saved-workflows/autosave"
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

test("workflow file dialogs use the dedicated control server", async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const urls = [];
  globalThis.window = {
    location: { hostname: "127.0.0.1", port: "5176" },
    setTimeout,
    clearTimeout
  };
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return jsonResponse({ ok: true, graph: { nodes: [], edges: [] } });
  };

  try {
    await systemApi.openWorkflowFile({ title: "Open workflow" });
    assert.deepEqual(urls, [
      "http://127.0.0.1:3337/api/system/control-health",
      "/api/system/control-health",
      "http://127.0.0.1:3337/api/system/open-workflow-file"
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

test("workflow JSON saves retry through the client proxy when the control server stops responding", async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const urls = [];
  globalThis.window = {
    location: { hostname: "127.0.0.1", port: "5176" }
  };
  globalThis.fetch = (url, options = {}) => {
    urls.push(String(url));
    if (String(url) !== "http://127.0.0.1:3337/api/system/save-workflow-file") return Promise.resolve(jsonResponse({ ok: true }));
    return new Promise((_resolve, reject) => {
      options.signal?.addEventListener("abort", () => reject(new DOMException("Timed out", "AbortError")), { once: true });
    });
  };

  try {
    const { response } = await (await import("../src/api/newtApi.js")).fetchJsonApi(
      "/api/system/save-workflow-file",
      { method: "POST", body: "{}" },
      "Save workflow",
      { preferControlServer: true, timeoutMs: 5 }
    );
    assert.equal(response.ok, true);
    assert.deepEqual(urls, [
      "http://127.0.0.1:3337/api/system/save-workflow-file",
      "/api/system/save-workflow-file"
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

test("dialog requests use the control proxy when its health check wins", async () => {
  const previousFetch = globalThis.fetch;
  const previousWindow = globalThis.window;
  const urls = [];
  globalThis.window = {
    location: { hostname: "127.0.0.1", port: "5176" },
    setTimeout,
    clearTimeout
  };
  globalThis.fetch = (url) => {
    urls.push(String(url));
    if (String(url).startsWith("http://127.0.0.1:3337/")) return new Promise(() => {});
    return Promise.resolve(jsonResponse({ ok: true, path: "C:\\Project" }));
  };

  try {
    await systemApi.selectFolder({ title: "Choose folder" });
    assert.deepEqual(urls, [
      "http://127.0.0.1:3337/api/system/control-health",
      "/api/system/control-health",
      "/api/system/select-folder"
    ]);
  } finally {
    globalThis.fetch = previousFetch;
    globalThis.window = previousWindow;
  }
});

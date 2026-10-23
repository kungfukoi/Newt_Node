import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import http from "node:http";
import { createWindowLifecycle, registerWindowLifecycle } from "../server/window-lifecycle.js";
import { startWindowLifecycle } from "../src/windowLifecycle.js";
import { stopOwnedProcessTree, stopOwnedWslServices } from "../scripts/ownedProcessTree.mjs";

test("last-window grace permits reloads and never expires a connected background window", () => {
  const pending = new Set();
  let shutdowns = 0;
  const lifecycle = createWindowLifecycle({ onEmpty: () => shutdowns++, schedule: callback => { pending.add(callback); return callback; }, cancel: timer => pending.delete(timer) });
  const expire = () => { for (const callback of [...pending]) { pending.delete(callback); callback(); } };
  expire();
  assert.equal(shutdowns, 0, "headless startup is not automatically stopped");
  lifecycle.connect("first"); lifecycle.connect("second");
  lifecycle.disconnect("first"); expire();
  assert.equal(shutdowns, 0);
  lifecycle.disconnect("second");
  lifecycle.connect("reloaded"); expire();
  assert.equal(shutdowns, 0);
  lifecycle.disconnect("reloaded"); expire();
  assert.equal(shutdowns, 1);
  lifecycle.disconnect("reloaded"); expire();
  assert.equal(shutdowns, 1);
  assert.equal(lifecycle.connect("too-late"), false);
});

test("browser closes its connection on pagehide and reconnects on BFCache restore", () => {
  const browser = new EventTarget();
  let opened = 0, closed = 0;
  const dispose = startWindowLifecycle({ browser, connect: () => { opened++; return { close: () => closed++ }; } });
  browser.dispatchEvent(new Event("pageshow"));
  browser.dispatchEvent(new Event("visibilitychange"));
  assert.equal(opened, 1); assert.equal(closed, 0);
  browser.dispatchEvent(new Event("pagehide"));
  assert.equal(closed, 1);
  browser.dispatchEvent(new Event("pageshow"));
  assert.equal(opened, 2);
  dispose(); browser.dispatchEvent(new Event("pageshow"));
  assert.equal(opened, 2); assert.equal(closed, 2);
});

test("SSE tracks actual disconnects, rejects foreign origins, and leaves development sessions running", async t => {
  const app = express();
  let stopped = 0;
  const lifecycle = registerWindowLifecycle(app, { enabled: true, onEmpty: () => stopped++, graceMs: 30, clientPort: 5176 });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { lifecycle.dispose(); server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${server.address().port}/api/window-session`;
  assert.equal((await fetch(url, { headers: { Origin: "https://unrelated.example", Accept: "text/event-stream" } })).status, 403);
  assert.equal((await fetch(url)).status, 403);
  const request = http.get(url, { headers: { Origin: "http://127.0.0.1:5176", Accept: "text/event-stream" } });
  const [response] = await once(request, "response");
  assert.equal(response.statusCode, 200);
  await once(response, "data");
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(stopped, 0);
  request.destroy();
  await new Promise(resolve => setTimeout(resolve, 70));
  assert.equal(stopped, 1);
  const dev = express();
  registerWindowLifecycle(dev, { enabled: false });
  const devServer = dev.listen(0, "127.0.0.1");
  await once(devServer, "listening");
  t.after(() => { devServer.closeAllConnections(); devServer.close(); });
  assert.equal((await fetch(`http://127.0.0.1:${devServer.address().port}/api/window-session`)).status, 204);
});

test("owned process cleanup uses a Windows tree or an isolated POSIX process group", async () => {
  const commands = [];
  await stopOwnedProcessTree({ pid: 123, exitCode: null }, { platform: "win32", runCommand: async (...args) => commands.push(args) });
  assert.deepEqual(commands[0].slice(0, 2), ["taskkill.exe", ["/PID", "123", "/T", "/F"]]);
  assert.equal(commands[0][2].windowsHide, true);
  const signals = [];
  await stopOwnedProcessTree({ pid: 123, exitCode: null }, { platform: "darwin", signal: (...args) => signals.push(args) });
  assert.deepEqual(signals, [[-123, "SIGTERM"], [-123, "SIGKILL"]]);
  commands.length = 0;
  await stopOwnedWslServices(new Map([["owned", { distro: "Newt", user: "root", service: "minimax.service" }]]), { runCommand: async (...args) => commands.push(args) });
  assert.deepEqual(commands[0][1], ["-d", "Newt", "-u", "root", "--", "systemctl", "stop", "minimax.service"]);
});

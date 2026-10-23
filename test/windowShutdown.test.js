import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { stopOwnedProcessTree } from "../scripts/ownedProcessTree.mjs";

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 150; i++) { const result = await check(); if (result) return result; await wait(40); }
  throw new Error("Isolated window lifecycle did not reach the expected state.");
}
async function json(file) { try { return JSON.parse(await readFile(file, "utf8")); } catch { return null; } }
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }

test("last-window close shuts both supervisors and their descendants without killing unrelated processes", { timeout: 20000 }, async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "newt-window-shutdown-"));
  assert.ok(path.basename(root).startsWith("newt-window-shutdown-"));
  for (const dir of ["scripts", "server", "node_modules/vite/bin"]) await mkdir(path.join(root, dir), { recursive: true });
  for (const file of ["localServerSupervisor.mjs", "supervisorPolicy.mjs", "rotatingLog.mjs", "ownedProcessTree.mjs"]) {
    await copyFile(new URL(`../scripts/${file}`, import.meta.url), path.join(root, "scripts", file));
  }
  for (const file of ["file-write.js", "window-lifecycle.js"]) await copyFile(new URL(`../server/${file}`, import.meta.url), path.join(root, "server", file));
  await writeFile(path.join(root, "package.json"), '{"type":"module"}');
  await writeFile(path.join(root, "node_modules/vite/package.json"), '{"type":"module"}');
  await writeFile(path.join(root, "server/restart-marker.js"), "// fixture");
  await mkdir(path.join(root, ".newtnode_logs"));
  await writeFile(path.join(root, ".newtnode_logs/client-5399.stop"), "stale-owner-token");
  // Real supervisor and process tree; no user data, GPU work or provider requests.
  await writeFile(path.join(root, "server/index.js"), `
    import express from ${JSON.stringify(new URL("../node_modules/express/index.js", import.meta.url).href)};
    import { writeFileSync } from 'node:fs';
    import { spawn } from 'node:child_process';
    import { registerWindowLifecycle } from './window-lifecycle.js';
    const helper = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { windowsHide: true, stdio: 'ignore' });
    const app = express();
    app.get('/', (_req, res) => res.type('html').send(${JSON.stringify(`<script type="module">${await readFile(new URL("../src/windowLifecycle.js", import.meta.url), "utf8")}
      startWindowLifecycle({ connect: () => { const source = new EventSource('/api/window-session'); source.onopen = () => window.connected = true; return source; } });</script>`)}));
    const server = app.listen(0, '127.0.0.1', () => {
      registerWindowLifecycle(app, { graceMs: process.env.NEWTNODE_WINDOW_BROWSER_SMOKE === '1' ? 1500 : 250,
        clientPort: process.env.NEWTNODE_WINDOW_BROWSER_SMOKE === '1' ? server.address().port : process.env.VITE_CLIENT_PORT });
      writeFileSync('backend.json', JSON.stringify({ pid: process.pid, helper: helper.pid, port: server.address().port }));
    });
    process.on('message', message => { if (message.type === 'shutdown-session') process.send({ type: 'shutdown-ready' }); });
  `);
  await writeFile(path.join(root, "node_modules/vite/bin/vite.js"), `
    import { writeFileSync } from 'node:fs';
    writeFileSync('frontend.json', JSON.stringify({ pid: process.pid }));
    setInterval(() => {}, 1000);
  `);
  const supervisors = [];
  const unrelated = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { windowsHide: true, stdio: "ignore" });
  const streams = [];
  t.after(async () => {
    streams.forEach(stream => stream.destroy());
    for (const child of supervisors) {
      if (child.exitCode === null) await stopOwnedProcessTree(child).catch(() => {});
    }
    unrelated.kill();
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  });
  for (const args of [["--client"], []]) {
    supervisors.push(spawn(process.execPath, [path.join(root, "scripts/localServerSupervisor.mjs"), ...args], {
      cwd: root, windowsHide: true, detached: process.platform !== "win32", stdio: "ignore",
      env: { ...process.env, PORT: "5398", VITE_CLIENT_PORT: "5399" }
    }));
  }
  const backend = await until(() => json(path.join(root, "backend.json")));
  const frontend = await until(() => json(path.join(root, "frontend.json")));
  const connect = async () => {
    const request = http.get(`http://127.0.0.1:${backend.port}/api/window-session`, { headers: { Origin: "http://127.0.0.1:5399", Accept: "text/event-stream" } });
    streams.push(request);
    const [response] = await once(request, "response");
    assert.equal(response.statusCode, 200);
    await once(response, "data");
    return request;
  };
  if (process.env.NEWTNODE_WINDOW_BROWSER_SMOKE === "1") {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext();
    const first = await context.newPage(), second = await context.newPage();
    for (const page of [first, second]) {
      await page.goto(`http://127.0.0.1:${backend.port}/`);
      await page.waitForFunction(() => window.connected === true);
    }
    await first.close(); await wait(1700);
    assert.ok(alive(backend.pid), "another real browser tab keeps the backend alive");
    await second.reload();
    await second.waitForFunction(() => window.connected === true);
    await wait(1700);
    assert.ok(alive(backend.pid), "browser refresh cancels pending shutdown");
    await browser.close();
  } else {
    const first = await connect(), second = await connect();
    first.destroy(); await wait(400);
    assert.ok(alive(backend.pid), "another window keeps the backend alive");
    second.destroy();
    const reloaded = await connect(); await wait(400);
    assert.ok(alive(backend.pid), "refresh cancels pending shutdown");
    reloaded.destroy();
  }
  await until(() => supervisors.every(child => child.exitCode !== null));
  await until(() => !alive(backend.pid) && !alive(backend.helper) && !alive(frontend.pid));
  assert.ok(alive(unrelated.pid), "unrelated process must survive");
  assert.ok(supervisors.every(child => child.exitCode === 0));
  const log = await readFile(path.join(root, ".newtnode_logs/server-5398.log"), "utf8");
  assert.match(log, /shutting down owned services/);
  assert.doesNotMatch(log, /restart in/);
});

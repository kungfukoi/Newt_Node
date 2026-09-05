import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, readdir, rm, mkdir, copyFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { finished } from "node:stream/promises";
import { restartDelay, redactRuntimeLog } from "../scripts/supervisorPolicy.mjs";
import { createRotatingLog } from "../scripts/rotatingLog.mjs";

test("supervisor crash backoff is bounded and requested/stable restarts reset it", () => {
  let failures = 0;
  const delays = [];
  for (let index = 0; index < 8; index++) {
    const result = restartDelay({ failures, uptimeMs: 100 });
    failures = result.failures;
    delays.push(result.delayMs);
  }
  assert.deepEqual(delays, [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  assert.deepEqual(restartDelay({ failures, uptimeMs: 70000 }), { failures: 1, delayMs: 1000 });
  assert.deepEqual(restartDelay({ failures, uptimeMs: 10, requested: true }), { failures: 0, delayMs: 250 });
});

test("runtime logs rotate with bounded retention and mask common credential fields", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "newt-logs-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const log = createRotatingLog(path.join(directory, "server.log"), { maxBytes: 25, copies: 2 });
  for (let index = 0; index < 6; index++) log.write(`entry ${index}: apiKey=secret-token\n`);
  log.write("Authorization: Be");
  log.write("arer split-secret\n");
  log.end();
  await finished(log);
  const files = await readdir(directory);
  assert.equal(files.length, 3);
  for (const file of files) assert.doesNotMatch(await readFile(path.join(directory, file), "utf8"), /secret-token|split-secret/);
  assert.doesNotMatch(redactRuntimeLog('Bearer abc123 https://example.test/?token=private&foo=ok'), /abc123|private/);
});

test("production supervisor restarts a crashed child, rejects duplicate owners and observes explicit restart", { timeout: 20000 }, async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "newt-supervisor-"));
  const relative = path.relative(os.tmpdir(), root);
  assert.ok(relative.startsWith("newt-supervisor-") && !relative.includes(path.sep));
  await mkdir(path.join(root, "scripts"));
  await mkdir(path.join(root, "server"));
  for (const file of ["localServerSupervisor.mjs", "supervisorPolicy.mjs", "rotatingLog.mjs"]) {
    await copyFile(new URL(`../scripts/${file}`, import.meta.url), path.join(root, "scripts", file));
  }
  await copyFile(new URL("../server/file-write.js", import.meta.url), path.join(root, "server", "file-write.js"));
  await writeFile(path.join(root, "package.json"), JSON.stringify({ type: "module" }));
  await writeFile(path.join(root, "server", "restart-marker.js"), "// initial\n");
  await writeFile(path.join(root, "server", "index.js"), `
    import { existsSync, readFileSync, writeFileSync } from 'node:fs';
    const count = existsSync('starts.json') ? JSON.parse(readFileSync('starts.json')).count + 1 : 1;
    writeFileSync('starts.json', JSON.stringify({ count, pid: process.pid, supervised: process.env.NEWTNODE_SUPERVISED, restarts: process.env.NEWTNODE_SUPERVISOR_RESTARTS }));
    if (count < 3) process.exit(23);
    setInterval(() => { if (existsSync('stop')) { writeFileSync('stopped', 'yes'); process.exit(0); } }, 20);
  `);
  const children = [];
  const launch = () => {
    const child = spawn(process.execPath, [path.join(root, "scripts", "localServerSupervisor.mjs")], {
      cwd: root, env: { ...process.env, PORT: "5297" }, windowsHide: true, stdio: "ignore"
    });
    const closed = once(child, "close");
    children.push({ child, closed });
    return { child, closed };
  };
  const readStarts = async () => { try { return JSON.parse(await readFile(path.join(root, "starts.json"), "utf8")); } catch { return null; } };
  const until = async (check) => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) { const result = await check(); if (result) return result; await new Promise((resolve) => setTimeout(resolve, 40)); }
    throw new Error("Isolated supervisor did not reach expected state.");
  };
  t.after(async () => {
    await writeFile(path.join(root, "stop"), "stop");
    const started = await readStarts();
    if (started?.count >= 3) await until(async () => { try { return await readFile(path.join(root, "stopped"), "utf8"); } catch { return false; } });
    for (const { child } of children) if (child.exitCode === null) child.kill("SIGTERM");
    await Promise.allSettled(children.map(({ closed }) => closed));
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  launch();
  const started = await until(async () => { const value = await readStarts(); return value?.count === 3 ? value : null; });
  assert.equal(started.supervised, "1");
  assert.equal(started.restarts, "2");
  const duplicate = launch();
  assert.equal((await duplicate.closed)[0], 0);
  assert.equal((await readStarts()).count, 3);
  await writeFile(path.join(root, "server", "restart-marker.js"), `// requested ${Date.now()}\n`);
  assert.equal((await until(async () => { const value = await readStarts(); return value?.count === 4 ? value : null; })).restarts, "3");
  const log = await readFile(path.join(root, ".newtnode_logs", "server-5297.log"), "utf8");
  assert.match(log, /restart in 1000ms/);
  assert.match(log, /restart in 2000ms/);
  assert.match(log, /requested restart/);
  assert.match(log, /restart in 250ms/);
});

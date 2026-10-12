import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { acquireRuntimeOwner } from "../server/runtime-owner.js";

test("one backend owns each datastore and another can acquire it after shutdown", async t => {
  const directory = await mkdtemp(path.join(tmpdir(), "newt-runtime-owner-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const owner = await acquireRuntimeOwner(directory);
  await assert.rejects(acquireRuntimeOwner(directory), error => error.code === "NEWT_RUNTIME_OWNED" && error.exitCode === 73);
  await owner.close();
  const replacement = await acquireRuntimeOwner(directory);
  await replacement.close();
});

test("a second process cannot own the same datastore; forced termination releases ownership", async t => {
  const directory = await mkdtemp(path.join(tmpdir(), "newt-runtime-owner-"));
  const moduleUrl = new URL("../server/runtime-owner.js", import.meta.url).href;
  const child = spawn(process.execPath, ["--input-type=module", "-e", `import { acquireRuntimeOwner } from ${JSON.stringify(moduleUrl)}; await acquireRuntimeOwner(process.argv[1]); console.log('owned'); setInterval(() => {}, 1000);`, directory], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const closed = once(child, "close");
  t.after(async () => { if (child.exitCode === null) child.kill("SIGKILL"); await closed; await rm(directory, { recursive: true, force: true }); });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Ownership helper did not start")), 10000);
    child.stdout.once("data", () => { clearTimeout(timeout); resolve(); });
    child.once("error", error => { clearTimeout(timeout); reject(error); });
  });
  await assert.rejects(acquireRuntimeOwner(directory), error => error.code === "NEWT_RUNTIME_OWNED");
  child.kill("SIGKILL"); await closed;
  const fresh = await acquireRuntimeOwner(directory); await fresh.close();
});

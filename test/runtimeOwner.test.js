import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { acquireRuntimeOwner } from "../server/runtime-owner.js";

async function openFixtureLease(t) {
  // A random directory can hash to a reserved loopback port on hosted Windows.
  for (let attempt = 0; ; attempt++) {
    const directory = await mkdtemp(path.join(tmpdir(), "newt-runtime-owner-"));
    const relative = path.relative(tmpdir(), directory);
    assert.ok(relative.startsWith("newt-runtime-owner-") && !relative.includes(path.sep));
    t.after(() => rm(directory, { recursive: true, force: true }));
    try { return { directory, owner: await acquireRuntimeOwner(directory) }; }
    catch (error) { if (attempt === 7 || error.code !== "NEWT_RUNTIME_OWNED") throw error; }
  }
}

test("one backend owns each datastore and another can acquire it after shutdown", async t => {
  const { directory, owner } = await openFixtureLease(t);
  await assert.rejects(acquireRuntimeOwner(directory), error => error.code === "NEWT_RUNTIME_OWNED" && error.exitCode === 73);
  await owner.close();
  const replacement = await acquireRuntimeOwner(directory);
  await replacement.close();
});

test("a second process cannot own the same datastore; forced termination releases ownership", async t => {
  const { directory, owner } = await openFixtureLease(t);
  await owner.close();
  const moduleUrl = new URL("../server/runtime-owner.js", import.meta.url).href;
  const child = spawn(process.execPath, ["--input-type=module", "-e", `import { acquireRuntimeOwner } from ${JSON.stringify(moduleUrl)}; await acquireRuntimeOwner(process.argv[1]); console.log('owned'); setInterval(() => {}, 1000);`, directory], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const closed = once(child, "close");
  t.after(async () => { if (child.exitCode === null) child.kill("SIGKILL"); await closed; });
  let stderr = "";
  child.stderr.setEncoding("utf8").on("data", chunk => { stderr += chunk; });
  const [message] = await Promise.race([
    once(child.stdout, "data", { signal: AbortSignal.timeout(10000) }),
    closed.then(([code, signal]) => { throw new Error(`Ownership helper exited before startup (${signal || code}): ${stderr.trim()}`); })
  ]);
  assert.equal(String(message).trim(), "owned");
  await assert.rejects(acquireRuntimeOwner(directory), error => error.code === "NEWT_RUNTIME_OWNED");
  child.kill("SIGKILL"); await closed;
  const fresh = await acquireRuntimeOwner(directory); await fresh.close();
});

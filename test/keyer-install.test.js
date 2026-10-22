import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createKeyerInstaller, compatibleKeyerGpu, probeKeyerPython } from "../server/keyer-install.js";

test("GPU setup requires sufficient memory, bfloat16 hardware and a current driver", () => {
  assert.equal(compatibleKeyerGpu("8.9, 24564", "CUDA Version: 12.8"), true);
  assert.equal(compatibleKeyerGpu("8.9, 24564", "CUDA UMD Version: 13.3"), true);
  assert.equal(compatibleKeyerGpu("7.5, 8192", "CUDA Version: 13.0"), false);
  assert.equal(compatibleKeyerGpu("8.9, 2048", "CUDA Version: 13.0"), false);
  assert.equal(compatibleKeyerGpu("8.9, 24564", "CUDA Version: 12.7"), false);
});

test("Mac refuses the CUDA engine before any hardware probes or downloads", async () => {
  const installer = createKeyerInstaller({ baseDir: os.tmpdir(), platform: "darwin", arch: "arm64", hardware: () => assert.fail("hardware probe"), download: () => assert.fail("download") });
  assert.equal((await installer.status()).canInstall, false);
  await assert.rejects(installer.ensure(), /macOS/);
});

test("missing Windows components are installable but insufficient disk prevents downloads", async () => {
  const baseDir = await mkdtemp(path.join(os.tmpdir(), "keyer-setup-test-"));
  try {
    const installer = createKeyerInstaller({ baseDir, env: {}, platform: "win32", arch: "x64", hardware: async () => ({ supported: true }), freeBytes: async () => 0, download: () => assert.fail("download") });
    assert.deepEqual({ ready: (await installer.status()).ready, canInstall: (await installer.status()).canInstall }, { ready: false, canInstall: true });
    await assert.rejects(installer.ensure(), /20 GB/);
  } finally { await rm(baseDir, { recursive: true, force: true }); }
});

test("Python preflight reads structured results and rejects missing output", async () => {
  assert.equal((await probeKeyerPython("python", async () => ({ stdout: 'noise\nNEWT_KEYER_PROBE={"ok":true}\n' }))).ok, true);
  assert.equal((await probeKeyerPython("python", async () => ({ stdout: "" }))).ok, false);
});

import test from "node:test";
import assert from "node:assert/strict";
import { statsApi } from "../src/api/newtApi.js";
test("Global rejects pasted secrets before building a URL or making a network request", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected network request"); };
  try {
    for (const field of ["key", "model"]) for (const value of ["sk-fixture-secret", "apikey-fixture-secret", `AIza${"x".repeat(30)}`, `${"a".repeat(32)}:${"b".repeat(32)}`, "00000000-0000-0000-0000-000000000000:11111111-1111-1111-1111-111111111111", "Bearer fixture-secret"]) {
      await assert.rejects(statsApi.accounts({ provider: "fal", [field]: value }), /public provider key ID/);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

import test from "node:test";
import assert from "node:assert/strict";
import { statsApi } from "../src/api/newtApi.js";
test("Global rejects pasted secrets before building a URL or making a network request", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Unexpected network request"); };
  try {
    for (const key of ["sk-fixture-secret", "apikey-fixture-secret", `${"a".repeat(32)}:${"b".repeat(32)}`, "Bearer fixture-secret"]) {
      await assert.rejects(statsApi.accounts({ provider: "fal", key }), /public provider key ID/);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});

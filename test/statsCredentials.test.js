import test from "node:test";
import assert from "node:assert/strict";
import { statsCredentialIdentities } from "../server/stats-credentials.js";
import { providerKeyFingerprint } from "../server/seedance-job-provider.js";
import { buildAnalytics, defaultFilters } from "../src/statsAnalytics.js";

test("Settings names map to provider-scoped hashes without exposing keys", () => {
  const key = "fixture-private-credential";
  const identities = statsCredentialIdentities({ krea: [{ id: "studio", label: "Studio", key }, { id: "alias", label: "Backup", key }], openAi: [{ id: "text", label: "Writing", key }] });
  assert.equal(identities.length, 2);
  assert.equal(identities.find(row => row.provider === "krea").name, "Krea–Studio / Krea–Backup");
  assert.equal(identities.find(row => row.provider === "openai").name, "OpenAI–Writing");
  assert.equal(identities[0].fingerprint, providerKeyFingerprint(key));
  assert.ok(!JSON.stringify(identities).includes(key));
  assert.deepEqual(Object.keys(identities[0]).sort(), ["fingerprint", "name", "provider"]);
});

test("named choices include unused Settings credentials and preserve recorded identity", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const fingerprint = "a".repeat(64), unused = "b".repeat(64);
  const history = [{ id: "run", provider: "krea", createdAt: now.toISOString(), keyIdentity: { fingerprint }, cost: { amountUsd: 1 } }, { id: "legacy", provider: "krea", createdAt: now.toISOString() }];
  const identities = [{ provider: "krea", fingerprint, name: "Krea–Studio" }, { provider: "fal", fingerprint: unused, name: "Fal–Spare" }];
  const result = buildAnalytics(history, defaultFilters(), now, identities);
  assert.equal(result.rows.find(row => row.id === "run").keyLabel, "Krea–Studio");
  assert.equal(result.breakdowns.key.find(row => row.id === `krea:${fingerprint}`).name, "Krea–Studio");
  assert.ok(result.options.key.some(row => row.name === "Fal–Spare" && row.count === 0));
  assert.equal(result.rows.find(row => row.id === "legacy").keyId, "unknown");
  assert.equal(buildAnalytics(history, { ...defaultFilters(), key: `fal:${unused}` }, now, identities).rows.length, 0);
  const renamed = buildAnalytics(history, defaultFilters(), now, [{ ...identities[0], name: "Krea–Renamed" }]);
  assert.equal(renamed.rows.find(row => row.id === "run").keyLabel, "Krea–Renamed");
  assert.equal(renamed.rows.find(row => row.id === "run").keyId, `krea:${fingerprint}`);
});

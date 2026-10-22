import test from "node:test";
import assert from "node:assert/strict";
import { dependencyFingerprint } from "../scripts/dependencyFingerprint.mjs";

test("launcher fingerprint ignores release metadata but detects dependency and runtime changes", () => {
  const manifest = { version: "1.0.0", dependencies: { a: "^1" } };
  const lock = { version: "1.0.0", lockfileVersion: 3, packages: { "": manifest, "node_modules/a": { version: "1.2.0", integrity: "abc" } } };
  const hash = dependencyFingerprint(manifest, lock);
  assert.equal(dependencyFingerprint({ ...manifest, version: "1.0.1" }, { ...lock, version: "1.0.1", packages: { ...lock.packages, "": { ...manifest, version: "1.0.1" } } }), hash);
  assert.notEqual(dependencyFingerprint({ ...manifest, dependencies: { a: "^2" } }, lock), hash);
  assert.notEqual(dependencyFingerprint(manifest, { ...lock, packages: { ...lock.packages, "node_modules/a": { version: "1.3.0", integrity: "def" } } }), hash);
  assert.notEqual(dependencyFingerprint(manifest, lock, { platform: "different", arch: "different", abi: "different" }), hash);
  assert.equal(dependencyFingerprint({ dependencies: { a: "^1" }, version: "1.0.0" }, lock), hash);
});

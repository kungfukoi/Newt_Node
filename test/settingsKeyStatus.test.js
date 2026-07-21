import assert from "node:assert/strict";
import test from "node:test";
import { keyDetail, providerMetricTone, providerMetricValue } from "../src/settingsKeyStatus.js";

test("valid env keys stay green when the local override is disabled", () => {
  const validation = { status: "valid" };
  assert.equal(providerMetricValue(true, validation), "Valid");
  assert.equal(providerMetricTone(true, validation), "good");
  assert.equal(keyDetail("env", "ready", false, validation), "Verified / .env");
});

test("configured keys are not green until validation succeeds", () => {
  assert.equal(providerMetricValue(true, null, true), "Checking");
  assert.equal(providerMetricTone(true, null), "");
  assert.equal(providerMetricTone(true, { status: "invalid" }), "bad");
  assert.equal(providerMetricTone(true, { status: "unverified" }), "warn");
});

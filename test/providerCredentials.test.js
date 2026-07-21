import assert from "node:assert/strict";
import test from "node:test";
import { selectProviderCredential } from "../server/provider-credentials.js";

test("disabled local override selects the env credential", () => {
  assert.deepEqual(selectProviderCredential({
    settingsValue: "settings-key",
    envValue: "env-key",
    useSettingsOverride: false
  }), {
    value: "env-key",
    source: "env"
  });
});

test("enabled local override selects only the Settings credential", () => {
  assert.deepEqual(selectProviderCredential({
    settingsValue: "settings-key",
    envValue: "env-key",
    useSettingsOverride: true
  }), {
    value: "settings-key",
    source: "settings"
  });
  assert.deepEqual(selectProviderCredential({
    settingsValue: "",
    envValue: "env-key",
    useSettingsOverride: true
  }), {
    value: "",
    source: ""
  });
});

test("env selection may fall back to a startup runtime credential", () => {
  assert.deepEqual(selectProviderCredential({
    envValue: "",
    runtimeValue: "runtime-key",
    useSettingsOverride: false
  }), {
    value: "runtime-key",
    source: "runtime"
  });
});

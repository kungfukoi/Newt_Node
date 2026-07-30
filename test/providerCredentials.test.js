import assert from "node:assert/strict";
import test from "node:test";
import {
  activeProviderCredentials,
  legacyProviderCredentialStore,
  normalizeActiveCredentialIds,
  normalizeProviderCredentialStore,
  selectProviderCredential
} from "../server/provider-credentials.js";

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

test("multi-key credentials keep only one active key per provider", () => {
  const credentials = normalizeProviderCredentialStore({
    fal: [
      { id: "personal", label: "Personal", key: "fal-one" },
      { id: "production", label: "Production", key: "fal-two" }
    ]
  });
  const activeIds = normalizeActiveCredentialIds({ fal: "production" }, credentials);
  assert.equal(activeProviderCredentials(credentials, activeIds).fal.key, "fal-two");
  assert.equal(activeIds.google, "");
});

test("provider credentials reject non-byte characters before becoming headers", () => {
  const credentials = normalizeProviderCredentialStore({
    google: [
      { id: "bad", label: "Bad paste", key: `not-a-key${String.fromCodePoint(0x2019)}` },
      { id: "good", label: "Good", key: "ASCII-key_123" }
    ]
  });

  assert.deepEqual(credentials.google.map((credential) => credential.id), ["good"]);
  const activeIds = normalizeActiveCredentialIds({ google: "bad" }, credentials);
  assert.equal(activeIds.google, "");
});

test("legacy Settings and env keys migrate without duplicates and preserve the selected source", () => {
  const migrated = legacyProviderCredentialStore({
    settings: { falKey: "settings-fal", providerPreferences: { fal: false } },
    env: { FAL_KEY: "env-fal" },
    runtime: { FAL_KEY: "env-fal" }
  });
  assert.equal(migrated.credentials.fal.length, 2);
  assert.equal(activeProviderCredentials(migrated.credentials, migrated.activeCredentialIds).fal.key, "env-fal");
});

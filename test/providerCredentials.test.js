import assert from "node:assert/strict";
import test from "node:test";
import {
  activeProviderCredentials,
  legacyProviderCredentialStore,
  mergeProviderCredentialsWithEnv,
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

test("saved credential profiles recover missing keys from .env", () => {
  const recovered = mergeProviderCredentialsWithEnv({
    credentials: { fal: [] },
    activeCredentialIds: { fal: "" },
    env: { FAL_KEY: "env-fal" }
  });

  assert.equal(recovered.credentials.fal.length, 1);
  assert.equal(recovered.credentials.fal[0].label, "Imported from .env");
  assert.equal(activeProviderCredentials(recovered.credentials, recovered.activeCredentialIds).fal.key, "env-fal");
});

test("an .env key reuses and activates its existing saved profile", () => {
  const recovered = mergeProviderCredentialsWithEnv({
    credentials: {
      google: [
        { id: "old", label: "Old", key: "old-google" },
        { id: "current", label: "Current", key: "env-google" }
      ]
    },
    activeCredentialIds: { google: "old" },
    env: { GOOGLE_API_KEY: "env-google" }
  });

  assert.equal(recovered.credentials.google.length, 2);
  assert.equal(recovered.activeCredentialIds.google, "current");
});

test("a commented .env key remains saved but disabled", () => {
  const recovered = mergeProviderCredentialsWithEnv({
    credentials: {},
    activeCredentialIds: {},
    disabledEnv: { KREA_API_KEY: "disabled-krea" }
  });

  assert.equal(recovered.credentials.krea.length, 1);
  assert.equal(recovered.credentials.krea[0].key, "disabled-krea");
  assert.equal(recovered.activeCredentialIds.krea, "");
});

test("an active .env key takes precedence over a commented value", () => {
  const recovered = mergeProviderCredentialsWithEnv({
    credentials: {},
    activeCredentialIds: {},
    env: { OPENAI_API_KEY: "active-openai" },
    disabledEnv: { OPENAI_API_KEY: "old-openai" }
  });

  assert.equal(recovered.credentials.openAi.length, 1);
  assert.equal(recovered.credentials.openAi[0].key, "active-openai");
  assert.equal(activeProviderCredentials(recovered.credentials, recovered.activeCredentialIds).openAi.key, "active-openai");
});

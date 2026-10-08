import { normalizeProviderCredentialStore } from "./provider-credentials.js";
import { providerKeyFingerprint } from "./seedance-job-provider.js";
import { canonicalProvider, providerLabels, safeLabel } from "../src/statsAnalytics.js";

// Browser allowlist: hash the secret on the server; expose only Settings names.
export function statsCredentialIdentities(credentials) {
  const identities = new Map();
  for (const [providerName, entries] of Object.entries(normalizeProviderCredentialStore(credentials))) {
    const provider = canonicalProvider(providerName);
    for (const { label, key } of entries) {
      if (!key) continue;
      const fingerprint = providerKeyFingerprint(key);
      const id = `${provider}:${fingerprint}`;
      const name = `${providerLabels[provider]}–${safeLabel(label)}`;
      const existing = identities.get(id);
      if (existing) { if (!existing.names.includes(name)) existing.names.push(name); }
      else identities.set(id, { provider, fingerprint, names: [name] });
    }
  }
  return [...identities.values()].map(({ provider, fingerprint, names }) => ({ provider, fingerprint, name: names.join(" / ") }));
}

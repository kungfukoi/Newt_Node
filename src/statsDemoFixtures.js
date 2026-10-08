// Test-only in-memory data. No fetch, storage, credentials or ledger integration.
export function createStatsDemoApi({ now = () => new Date(), delayMs = 350 } = {}) {
  let offline = false;
  const wait = async () => { await new Promise(resolve => setTimeout(resolve, delayMs)); if (offline) throw new Error("Synthetic demo outage; restore demo connection and retry."); };
  const stamp = days => { const date = now(); date.setDate(date.getDate() - days); date.setHours(9, 0, 0, 0); return new Date(Math.min(date.getTime(), now().getTime() - 60000)).toISOString(); };
  const row = (id, days, provider, modelName, amountUsd, projectId = "demo-film", extra = {}) => ({ id: `demo-${id}`, generationRunId: `demo-job-${id}`, createdAt: stamp(days), provider, modelName, mediaType: "video", project: { id: projectId, name: projectId === "demo-film" ? "Demo film (renamed)" : "Demo duplicate", fileName: "Demo.json" }, keyIdentity: { fingerprint: (provider === "fal" ? "b" : "a").repeat(64) }, cost: { amountUsd, currency: "USD", estimated: true, pricingBasis: "Fabricated demonstration amount" }, ...extra });
  const history = () => {
    const records = [row("a", 0, "atlas", "Seedance 2.5", 3), row("b", 1, "fal", "Nano Banana 2", 2, "demo-film", { mediaType: "image", cost: { amountUsd: 2, currency: "USD", estimated: false, pricingBasis: "Synthetic reported-charge fixture" } }), row("c", 4, "krea", "MiniMax H3", null), row("d", 5, "atlas", "Seedance 2.5", .75, "demo-duplicate"), row("e", 15, "openai", "Text model", .000005, "demo-film", { mediaType: "text" }), row("f", 29, "local", "Local processing", 0), row("g", 31, "fal", "Nano Banana 2", 1.5, "demo-duplicate", { mediaType: "image" }), row("h", 0, "atlas", "Seedance 2.5", null, "demo-duplicate", { keyIdentity: null, status: "failed" })];
    return [...records, records[0]];
  };
  const capabilities = [{ provider: "atlas", scope: "account / self", note: "DEMO: fabricated spend and account balance; no billing API called." }, { provider: "fal", scope: "workspace", note: "DEMO: simulated missing Admin billing permission." }, { provider: "krea", scope: "workspace API", note: "DEMO: unsupported public balance capability." }];
  return {
    setOffline(value) { offline = Boolean(value); },
    async local() { await wait(); return { history: history(), fetchedAt: now().toISOString(), capabilities, coverage: { trackingStartedAt: now().toISOString(), note: "SYNTHETIC DEMO ONLY. Fabricated records stay in memory, never enter Local accounting, and are never added to provider account totals." } }; },
    async accounts(query) {
      await wait();
      const date = now().toISOString().slice(0, 10);
      const rows = date >= query.start && date < query.end && (!query.model || query.model === "demo/model") && (!query.key || query.key === "demo-public-key") ? [{ date, amount: 10, currency: "USD", model: "demo/model", key: "demo-public-key", partial: true, coveredUntil: now().toISOString() }] : [];
      const providers = capabilities.filter(capability => !query.provider || query.provider === capability.provider).map(capability => ({ ...capability, fetchedAt: now().toISOString(), spend: capability.provider === "atlas" ? { status: "ready", amount: rows.reduce((sum, row) => sum + row.amount, 0), rows, scope: query.key ? "DEMO public key filter" : `DEMO ${query.atlasScope} scope`, partial: true, message: "Fabricated provider buckets; not a real account." } : { status: capability.provider === "fal" ? "permission-required" : "unsupported", amount: null, rows: [], message: capability.note }, balance: capability.provider === "atlas" ? { status: "ready", amount: 80, unit: "USD", scope: "DEMO account balance", message: "Fabricated balance, independent of date/model/key filters." } : { status: capability.provider === "fal" ? "permission-required" : "unsupported", amount: null, message: capability.note } }));
      return { query, providers, fetchedAt: now().toISOString() };
    },
    export() { return Promise.reject(new Error("Demo export disabled.")); },
    previewImport() { return Promise.reject(new Error("Demo import disabled.")); }
  };
}

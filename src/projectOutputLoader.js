export function createProjectOutputLoader({ list, onChange }) {
  let state = { items: [], nextCursor: "", total: 0, loading: false, error: "" };
  let pending;
  let refreshAgain = false;
  let disposed = false;
  const publish = (patch) => {
    state = { ...state, ...patch };
    if (!disposed) onChange(state);
  };
  function load(more = false) {
    if (disposed || (more && !state.nextCursor)) return Promise.resolve();
    if (pending) { if (!more) refreshAgain = true; return pending; }
    const cursor = more ? state.nextCursor : "";
    publish({ loading: true, error: "" });
    pending = Promise.resolve().then(async () => {
      const known = new Set(state.items.map((item) => item.url));
      let page = await list({ cursor });
      const collected = [...page.items];
      while (!more && known.size && page.nextCursor && !page.items.some((item) => known.has(item.url)) && !disposed) {
        page = await list({ cursor: page.nextCursor });
        collected.push(...page.items);
      }
      return { ...page, items: collected };
    }).then((page) => {
      if (disposed) return;
      const items = new Map(state.items.map((item) => [item.url, item]));
      for (const item of page.items) items.set(item.url, item);
      // Refresh the newest page without throwing away older pages already loaded.
      publish({ items: [...items.values()], total: page.total, nextCursor: more || !state.items.length ? page.nextCursor : state.nextCursor });
    }).catch((error) => publish({ error: error.message || "Project outputs could not be loaded." })).finally(() => {
      pending = null;
      publish({ loading: false });
      if (refreshAgain && !disposed) { refreshAgain = false; load(); }
    });
    return pending;
  }
  return { refresh: () => load(), loadMore: () => load(true), activate: () => { disposed = false; }, dispose: () => { disposed = true; } };
}

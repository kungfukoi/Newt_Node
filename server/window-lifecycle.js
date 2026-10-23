// A live connection represents a window, including minimized/background windows.
// Only launcher-owned sessions opt into automatic shutdown.
export function createWindowLifecycle({ onEmpty, graceMs = 15000, schedule = setTimeout, cancel = clearTimeout }) {
  const windows = new Set();
  let timer;
  let stopping = false;
  return {
    connect(connection) {
      if (stopping) return false;
      cancel(timer);
      windows.add(connection);
      return true;
    },
    disconnect(connection) {
      if (!windows.delete(connection) || windows.size || stopping) return;
      timer = schedule(() => {
        if (windows.size || stopping) return;
        stopping = true;
        onEmpty();
      }, graceMs);
      timer.unref?.();
    },
    dispose() { stopping = true; cancel(timer); }
  };
}

export function registerWindowLifecycle(app, {
  enabled = process.env.NEWTNODE_SUPERVISED === "1" && Boolean(process.send),
  onEmpty = () => process.send?.({ type: "windows-closed" }),
  clientPort = process.env.VITE_CLIENT_PORT || "5176",
  graceMs = 15000
} = {}) {
  const lifecycle = createWindowLifecycle({ onEmpty, graceMs });
  app.get("/api/window-session", (req, res) => {
    if (!enabled) return res.sendStatus(204);
    // Do not let unrelated websites enroll themselves in the local session.
    let origin;
    try { origin = new URL(req.headers.origin || req.headers.referer); } catch { return res.sendStatus(403); }
    if (origin.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(origin.hostname)
      || origin.port !== String(clientPort) || !req.headers.accept?.includes("text/event-stream")) return res.sendStatus(403);
    if (!lifecycle.connect(res)) return res.sendStatus(503);
    res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Accel-Buffering": "no" });
    res.flushHeaders();
    res.write("retry: 1000\ndata: connected\n\n");
    const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 10000);
    keepAlive.unref?.();
    res.once("close", () => { clearInterval(keepAlive); lifecycle.disconnect(res); });
  });
  return lifecycle;
}

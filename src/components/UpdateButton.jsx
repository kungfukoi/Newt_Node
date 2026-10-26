import React from "react";
import "./updateButton.css";
import { saveNow, subscribeUiSave, uiSaveStatus } from "../uiState.js";

const bundleOf = html => String(html).match(/\/assets\/index-[^"']+\.js/)?.[0] || "";

// Small bottom-right button: reloads the window, and lights up when the server is serving a newer build
// (for example after "Refresh tools" in the Newt Launcher rebuilt the interface).
export function UpdateButton() {
  const [ready, setReady] = React.useState(false);
  const warning = React.useSyncExternalStore(subscribeUiSave, uiSaveStatus);
  React.useEffect(() => {
    const current = Array.from(document.scripts).map(script => bundleOf(script.src)).find(Boolean);
    if (!current) return undefined; // dev server or unhashed build: nothing to compare
    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch("/", { cache: "no-store" });
        const latest = bundleOf(await response.text());
        if (!stopped && latest && latest !== current) setReady(true);
      } catch { /* server restarting; try again next time */ }
    };
    const timer = setInterval(check, 8000);
    return () => { stopped = true; clearInterval(timer); };
  }, []);
  return <>{warning && <div className="workspace-recovery-warning" role="status">{warning} <button onClick={() => saveNow()}>Retry recovery save</button></div>}<button type="button" className={`update-button${ready ? " is-ready" : ""}`} onClick={async () => { window.dispatchEvent(new Event("pagehide")); await saveNow(); window.location.reload(); }}
    title={ready ? "A newer version is ready. Click to reload this window." : "Reload this window to pick up the latest changes."}
    aria-label={ready ? "Update ready, reload" : "Reload"}>
    <span aria-hidden="true">↻</span>{ready && <span> Update ready — reload</span>}
  </button></>;
}

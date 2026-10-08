import React from "react";
import { createRoot } from "react-dom/client";
import StatsDashboard from "./StatsDashboard.jsx";
import { createStatsDemoApi } from "./statsDemoFixtures.js";
import "./styles.css";

function Demo() {
  const [api] = React.useState(() => createStatsDemoApi());
  const [offline, setOffline] = React.useState(false);
  return <main style={{ padding: "24px", maxWidth: "1600px", margin: "auto" }}>
    <aside className="analytics-alert" aria-label="Synthetic demo notice" style={{ marginBottom: "24px" }}>
      <div><strong>SYNTHETIC DEMO — every amount below is fabricated</strong><p>No credentials, local ledger or provider APIs are read. Nothing is persisted. Export and import are disabled.</p><p>Try combined filters, last 5 days, reset, run Details, and Global. Public fixture IDs: demo/model and demo-public-key.</p></div>
      <button onClick={() => { api.setOffline(!offline); setOffline(!offline); }}>{offline ? "Restore demo connection" : "Simulate demo outage"}</button>
      <a href="/">Open real isolated app</a>
    </aside>
    <StatsDashboard api={api} demo/>
  </main>;
}
createRoot(document.getElementById("root")).render(<Demo/>);

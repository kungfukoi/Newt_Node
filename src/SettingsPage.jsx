import React from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  FolderOpen,
  GitPullRequest,
  KeyRound,
  RefreshCcw,
  RotateCcw,
  Save
} from "lucide-react";
import { settingsApi, systemApi } from "./api/newtApi.js";
import {
  defaultModelPreferences,
  imageModelOptions,
  normalizeModelPreferences,
  utilityImageModelOptions,
  utilityVideoModelOptions,
  videoModelOptions
} from "./modelOptions.js";

export default function SettingsPage() {
  const [settings, setSettings] = React.useState(null);
  const [falKey, setFalKey] = React.useState("");
  const [falKeyVisible, setFalKeyVisible] = React.useState(false);
  const [googleApiKey, setGoogleApiKey] = React.useState("");
  const [googleApiKeyVisible, setGoogleApiKeyVisible] = React.useState(false);
  const [repository, setRepository] = React.useState("");
  const [comfyWanRootPath, setComfyWanRootPath] = React.useState("");
  const [comfyWanStatus, setComfyWanStatus] = React.useState(null);
  const [comfyWanBusy, setComfyWanBusy] = React.useState(false);
  const [modelPreferences, setModelPreferences] = React.useState(defaultModelPreferences);
  const [modelsOpen, setModelsOpen] = React.useState(false);
  const [comfyOpen, setComfyOpen] = React.useState(false);
  const [status, setStatus] = React.useState("loading");
  const [busy, setBusy] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [updateLog, setUpdateLog] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState(null);
  const initialSecretsRef = React.useRef({ falKey: "", googleApiKey: "" });
  const actionsDisabled = status === "loading" || Boolean(busy);

  React.useEffect(() => {
    refreshSettings();
  }, []);

  async function refreshSettings() {
    try {
      setStatus((current) => (current === "loading" ? "loading" : "refreshing"));
      const data = await settingsApi.load();
      applyLoadedSettings(data);
      setStatus("ready");
      setMessage(data.apiKeysFound ? "" : "No API keys found.");
      setLastUpdated(new Date());
      refreshComfyWanStatus(data.comfyWanRootPath || "", { quiet: true });
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Could not load settings.");
    }
  }

  async function saveSettings() {
    setBusy("save");
    setMessage("");
      setUpdateLog("");
      try {
        const initialSecrets = initialSecretsRef.current;
        const nextModelPreferences = normalizeModelPreferences(modelPreferences);
        const payload = { repository, comfyWanRootPath, modelPreferences: nextModelPreferences };
        if (falKey !== initialSecrets.falKey) payload.falKey = falKey;
      if (googleApiKey !== initialSecrets.googleApiKey) payload.googleApiKey = googleApiKey;

      const savedData = await settingsApi.save(payload);
      const loadedData = await settingsApi.load();
      const savedModelPreferences = hasModelPreferences(loadedData)
        ? normalizeModelPreferences(loadedData.modelPreferences)
        : hasModelPreferences(savedData)
          ? normalizeModelPreferences(savedData.modelPreferences)
          : nextModelPreferences;
      const data = {
        ...(loadedData || {}),
        modelPreferences: savedModelPreferences
      };
      applyLoadedSettings(data);
      dispatchModelPreferences(savedModelPreferences);
      setMessage(data.apiKeysFound ? "Settings saved." : "No API keys found.");
      setLastUpdated(new Date());
      refreshComfyWanStatus(data.comfyWanRootPath || comfyWanRootPath, { quiet: true });
    } catch (error) {
      setMessage(error.message || "Could not save settings.");
    } finally {
      setBusy("");
    }
  }

  async function updateFromRepository() {
    setBusy("update");
    setMessage("");
    setUpdateLog("");
    try {
      const data = await settingsApi.update({ repository });
      const output = [data.stdout, data.stderr].filter(Boolean).join("\n").trim()
        || (data.relaunching ? "Replacement update staged. NewtNode will relaunch." : "Already up to date.");
      setSettings((current) => ({
        ...(current || {}),
        repository: data.repository || repository,
        branch: data.branch || current?.branch || "",
        branchStatus: data.branchStatus || current?.branchStatus,
        updateInProgress: false,
        restartRequested: Boolean(data.restartRequested) || current?.restartRequested
      }));
      setRepository(data.repository || repository);
      setUpdateLog(output);
      setMessage(data.message || data.branchStatus?.label || `Updated ${data.branch || "current branch"}.`);
      setLastUpdated(new Date());
      if (data.relaunching) {
        await waitForServerAndReload({
          waitForDisconnect: true,
          initialDelayMs: Number(data.delayMs || 0),
          timeoutMs: 120000
        });
      }
    } catch (error) {
      setMessage(error.message || "Update failed.");
    } finally {
      setBusy("");
    }
  }

  async function restartServer() {
    setBusy("restart");
    setMessage("Restarting server...");
    setUpdateLog("");
    try {
      await settingsApi.restart();
    } catch (error) {
      setMessage(`${error.message || "Restart request did not return."} Waiting for the server...`);
    }
    await waitForServerAndReload();
  }

  function applyLoadedSettings(data) {
    const secrets = {
      falKey: data.secrets?.falKey || "",
      googleApiKey: data.secrets?.googleApiKey || ""
    };
    initialSecretsRef.current = secrets;
    setSettings(data);
    setFalKey(secrets.falKey);
    setGoogleApiKey(secrets.googleApiKey);
    setRepository(data.repository || "");
    setComfyWanRootPath(data.comfyWanRootPath || "");
    setModelPreferences(normalizeModelPreferences(data.modelPreferences));
  }

  async function chooseComfyWanRoot() {
    setComfyWanBusy(true);
    setMessage("");
    try {
      const { response, data } = await systemApi.selectFolder({
        title: "Choose ComfyUI root",
        defaultPath: comfyWanRootPath
      });
      if (!response.ok || !data?.path) return;
      setComfyWanRootPath(data.path);
      await refreshComfyWanStatus(data.path, { quiet: true });
    } catch (error) {
      if (!String(error.message || "").toLowerCase().includes("cancel")) {
        setMessage(error.message || "Could not choose ComfyUI folder.");
      }
    } finally {
      setComfyWanBusy(false);
    }
  }

  async function refreshComfyWanStatus(rootPath = comfyWanRootPath, { quiet = false } = {}) {
    setComfyWanBusy(true);
    if (!quiet) setMessage("");
    try {
      const data = await systemApi.comfyWanStatus({ workflow: "WanWarp", rootPath });
      setComfyWanStatus(data);
      if (!quiet) setMessage(data.available ? "ComfyUI is ready." : data.message || "ComfyUI setup needs attention.");
    } catch (error) {
      setComfyWanStatus({ available: false, message: error.message || "Could not check ComfyUI." });
      if (!quiet) setMessage(error.message || "Could not check ComfyUI.");
    } finally {
      setComfyWanBusy(false);
    }
  }

  function updateModelPreference(kind, model, enabled) {
    setModelPreferences((current) =>
      normalizeModelPreferences({
        ...current,
        [kind]: {
          ...(current?.[kind] || {}),
          [model]: enabled
        }
      })
    );
  }

  return (
    <section className="stats-page settings-page">
      <header className="stats-hero settings-hero">
        <div>
          <span className="stats-kicker">Runtime</span>
          <h1>Settings</h1>
        </div>
        <button onClick={refreshSettings} disabled={status === "loading" || status === "refreshing" || Boolean(busy)} title="Refresh settings">
          <RefreshCcw className={status === "refreshing" ? "spin" : ""} size={17} />
          <span>{lastUpdated ? `Updated ${timeLabel(lastUpdated)}` : "Syncing"}</span>
        </button>
      </header>

      <div className="stats-metrics settings-metrics">
        <SettingsMetric icon={<KeyRound size={20} />} label="Fal Key" value={settings?.falKeyConfigured ? "Configured" : "Not set"} detail={keyDetail(settings?.keySources?.fal, status)} tone={settings?.falKeyConfigured ? "good" : ""} />
        <SettingsMetric icon={<KeyRound size={20} />} label="Google API" value={settings?.googleApiKeyConfigured ? "Configured" : "Not set"} detail={keyDetail(settings?.keySources?.google, status)} tone={settings?.googleApiKeyConfigured ? "good" : ""} />
        <SettingsMetric icon={<GitPullRequest size={20} />} label="Branch" value={branchMetricValue(settings)} detail={branchMetricDetail(settings)} tone={branchMetricTone(settings?.branchStatus?.state)} />
        <SettingsMetric icon={<RotateCcw size={20} />} label="Server" value={settings?.restartRequested ? "Restarting" : "Running"} detail="Local app" tone={settings?.restartRequested ? "warn" : "good"} />
      </div>

      <div className="settings-grid">
        <section className="stats-panel settings-panel wide">
          <SettingsPanelTitle title="API Keys" aside="Stored locally" />
          <div className="settings-form-grid">
            <label className="settings-field">
              <span>Fal Key</span>
              <div className="settings-input-row secret">
                <KeyRound size={15} />
                <input
                  type={falKeyVisible ? "text" : "password"}
                  value={falKey}
                  onChange={(event) => setFalKey(event.target.value)}
                  placeholder={secretPlaceholder(settings?.keySources?.fal, "Fal")}
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="settings-secret-toggle"
                  onClick={() => setFalKeyVisible((value) => !value)}
                  disabled={!falKey}
                  title={falKeyVisible ? "Hide Fal key" : "Show Fal key"}
                  aria-label={falKeyVisible ? "Hide Fal key" : "Show Fal key"}
                >
                  {falKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            <label className="settings-field">
              <span>Google API</span>
              <div className="settings-input-row secret">
                <KeyRound size={15} />
                <input
                  type={googleApiKeyVisible ? "text" : "password"}
                  value={googleApiKey}
                  onChange={(event) => setGoogleApiKey(event.target.value)}
                  placeholder={secretPlaceholder(settings?.keySources?.google, "Google API")}
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  className="settings-secret-toggle"
                  onClick={() => setGoogleApiKeyVisible((value) => !value)}
                  disabled={!googleApiKey}
                  title={googleApiKeyVisible ? "Hide Google API key" : "Show Google API key"}
                  aria-label={googleApiKeyVisible ? "Hide Google API key" : "Show Google API key"}
                >
                  {googleApiKeyVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>
          </div>
          <div className="settings-actions">
            <button type="button" onClick={saveSettings} disabled={actionsDisabled}>
              <Save size={15} />
              <span>{busy === "save" ? "Saving" : "Save"}</span>
            </button>
          </div>
        </section>

        <section className={`stats-panel settings-panel wide settings-collapsible-panel settings-model-panel ${modelsOpen ? "open" : ""}`}>
          <button
            type="button"
            className="settings-panel-toggle"
            onClick={() => setModelsOpen((value) => !value)}
            aria-expanded={modelsOpen}
          >
            <span className="panel-title settings-toggle-title">Enabled Models</span>
            <ChevronDown size={16} />
          </button>
          {modelsOpen && (
            <>
              <div className="settings-model-grid">
                <ModelToggleGroup
                  title="Image Models"
                  kind="image"
                  options={imageModelOptions}
                  values={modelPreferences.image}
                  onToggle={updateModelPreference}
                />
                <ModelToggleGroup
                  title="Video Models"
                  kind="video"
                  options={videoModelOptions}
                  values={modelPreferences.video}
                  onToggle={updateModelPreference}
                />
                <ModelToggleGroup
                  title="Utility Image Models"
                  kind="utilityImage"
                  options={utilityImageModelOptions}
                  values={modelPreferences.utilityImage}
                  onToggle={updateModelPreference}
                />
                <ModelToggleGroup
                  title="Utility Video Models"
                  kind="utilityVideo"
                  options={utilityVideoModelOptions}
                  values={modelPreferences.utilityVideo}
                  onToggle={updateModelPreference}
                  columns={2}
                  wide
                />
              </div>
              <div className="settings-actions">
                <button type="button" onClick={saveSettings} disabled={actionsDisabled}>
                  <Save size={15} />
                  <span>{busy === "save" ? "Saving" : "Save Models"}</span>
                </button>
              </div>
            </>
          )}
        </section>

        <section className="stats-panel settings-panel">
          <SettingsPanelTitle title="Repository" aside={settings?.branch || "Current branch"} />
          <label className="settings-field">
            <span>Repository Field</span>
            <input
              className="settings-repository-input"
              type="text"
              value={repository}
              onChange={(event) => setRepository(event.target.value)}
              placeholder="https://github.com/kungfukoi/Newt_Node"
            />
          </label>
          <div className="settings-actions">
            <button type="button" onClick={updateFromRepository} disabled={actionsDisabled || !repository.trim()}>
              <RefreshCcw className={busy === "update" ? "spin" : ""} size={15} />
              <span>{busy === "update" ? "Updating" : "Update"}</span>
            </button>
          </div>
        </section>

        <section className="stats-panel settings-panel">
          <SettingsPanelTitle title="Restart" aside={settings?.restartRequested ? "Queued" : "Ready"} />
          <div className="settings-restart-panel">
            <RotateCcw size={28} />
            <strong>{busy === "restart" ? "Restarting" : "Server restart"}</strong>
          </div>
          <div className="settings-actions">
            <button type="button" onClick={restartServer} disabled={actionsDisabled}>
              <RotateCcw className={busy === "restart" ? "spin" : ""} size={15} />
              <span>{busy === "restart" ? "Restarting" : "Restart"}</span>
            </button>
          </div>
        </section>

        {(message || updateLog) && (
          <section className="stats-panel settings-panel wide">
            <SettingsPanelTitle title="Status" aside={busy || status} />
            {message && <p className="settings-message">{message}</p>}
            {updateLog && <pre className="settings-log">{updateLog}</pre>}
          </section>
        )}

        <section className={`stats-panel settings-panel wide settings-collapsible-panel settings-comfy-panel ${comfyOpen ? "open" : ""}`}>
          <button
            type="button"
            className="settings-panel-toggle"
            onClick={() => setComfyOpen((value) => !value)}
            aria-expanded={comfyOpen}
          >
            <span className="panel-title settings-toggle-title">
              <span>Comfy Engine</span>
              <small>{comfyWanAside(comfyWanStatus, comfyWanBusy)}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          {comfyOpen && (
            <>
              <label className="settings-field">
                <span>ComfyUI Root</span>
                <div className="settings-input-row path">
                  <FolderOpen size={15} />
                  <input
                    type="text"
                    value={comfyWanRootPath}
                    onChange={(event) => setComfyWanRootPath(event.target.value)}
                    placeholder="Folder with custom_nodes and models"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button
                    type="button"
                    className="settings-secret-toggle"
                    onClick={chooseComfyWanRoot}
                    disabled={actionsDisabled || comfyWanBusy}
                    title="Choose ComfyUI folder"
                    aria-label="Choose ComfyUI folder"
                  >
                    <FolderOpen size={15} />
                  </button>
                </div>
              </label>
              <ComfyWanStatusCard status={comfyWanStatus} busy={comfyWanBusy} />
              <div className="settings-actions">
                <button type="button" onClick={() => refreshComfyWanStatus()} disabled={actionsDisabled || comfyWanBusy}>
                  <RefreshCcw className={comfyWanBusy ? "spin" : ""} size={15} />
                  <span>{comfyWanBusy ? "Checking" : "Rescan"}</span>
                </button>
                <button type="button" onClick={saveSettings} disabled={actionsDisabled}>
                  <Save size={15} />
                  <span>{busy === "save" ? "Saving" : "Save ComfyUI"}</span>
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function ComfyWanStatusCard({ status, busy }) {
  const install = status?.install || {};
  const missingCustomNodes = Array.isArray(status?.missingCustomNodes) ? status.missingCustomNodes : [];
  const missingModels = Array.isArray(status?.missingModels) ? status.missingModels : [];
  const missingItems = [...missingCustomNodes, ...missingModels];
  const tone = busy ? "checking" : status?.available ? "ready" : status ? "missing" : "";
  const message = busy
    ? "Checking ComfyUI..."
    : status?.message || "No ComfyUI check has run yet.";

  return (
    <div className={`settings-comfy-status ${tone}`}>
      <div>
        <strong>{status?.available ? "Ready" : busy ? "Checking" : status ? "Setup needed" : "Not checked"}</strong>
        <span>{message}</span>
      </div>
      {install.rootPath && <small>{install.rootPath}</small>}
      {missingItems.length > 0 && (
        <ul>
          {missingItems.slice(0, 6).map((item) => (
            <li key={`${item.type || "item"}-${item.id || item.target}`}>
              <em>{item.type === "customNode" ? "Node" : "Model"}</em>
              <span>{item.target || item.id}</span>
            </li>
          ))}
          {missingItems.length > 6 && <li><em>More</em><span>{missingItems.length - 6} additional requirements</span></li>}
        </ul>
      )}
    </div>
  );
}

function comfyWanAside(status, busy) {
  if (busy) return "Checking";
  if (status?.available) return "Ready";
  if (status?.errorCode === "COMFYUI_ROOT_NOT_CONFIGURED") return "Not configured";
  if (status) return "Setup needed";
  return "Local workflow";
}

function ModelToggleGroup({ title, kind, options, values = {}, onToggle, columns = 1, wide = false }) {
  return (
    <div className={`settings-model-group ${wide ? "wide" : ""}`}>
      <h2>{title}</h2>
      <div className={`settings-model-list ${columns === 2 ? "two-columns" : ""}`}>
        {options.map((model) => {
          const enabled = Boolean(values?.[model]);
          return (
            <label key={model} className={`settings-model-toggle ${enabled ? "enabled" : ""}`}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => onToggle(kind, model, event.target.checked)}
              />
              <span className="node-toggle compact">
                <span />
              </span>
              <em>{model}</em>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function dispatchModelPreferences(preferences) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("newtnode:model-settings-updated", {
    detail: normalizeModelPreferences(preferences)
  }));
}

function hasModelPreferences(data) {
  return data?.modelPreferences && typeof data.modelPreferences === "object";
}

function SettingsMetric({ icon, label, value, detail, tone = "" }) {
  return (
    <article className={`metric-card settings-metric ${tone ? `tone-${tone}` : ""}`}>
      <span className="metric-icon">{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </article>
  );
}

function keyDetail(source, status) {
  if (source === "env") return ".env";
  if (source === "settings") return "Settings";
  return statusLabel(status);
}

function secretPlaceholder(source, label) {
  if (source === "env") return "Using .env key";
  if (source === "settings") return "Settings override";
  return `Paste ${label} key`;
}

function branchMetricValue(settings) {
  if (!settings?.branchStatus) return settings?.branch || "Unknown";
  return settings.branchStatus.label || settings.branch || "Unknown";
}

function branchMetricTone(state) {
  if (state === "up-to-date") return "good";
  if (["update-available", "local-changes", "local-ahead", "different-history"].includes(state)) return "warn";
  return "";
}

function branchMetricDetail(settings) {
  const branchDetail = settings?.branchStatus
    ? settings.branchStatus.detail || settings.branch || "Ready"
    : settings?.updateInProgress ? "Updating" : "Ready";
  const version = versionLabel(settings?.version);
  return version ? `${branchDetail} / ${version}` : branchDetail;
}

function versionLabel(version) {
  const value = String(version || "").trim();
  if (!value) return "";
  return value.startsWith("v") ? value : `v${value}`;
}

function SettingsPanelTitle({ title, aside }) {
  return (
    <div className="panel-title">
      <span>{title}</span>
      {aside && <small>{aside}</small>}
    </div>
  );
}

function statusLabel(status) {
  if (status === "loading") return "Loading";
  if (status === "error") return "Check server";
  return "Ready";
}

function timeLabel(date) {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

async function waitForServerAndReload({ waitForDisconnect = false, initialDelayMs = 0, timeoutMs = 45000 } = {}) {
  const healthUrl = localServerHealthUrl();
  const startedAt = Date.now();
  let serverCycled = !waitForDisconnect;
  if (initialDelayMs > 0) {
    await delay(initialDelayMs);
  }

  while (Date.now() - startedAt < timeoutMs) {
    await delay(900);
    try {
      const response = await fetch(`${healthUrl}?restart=${Date.now()}`, { cache: "no-store" });
      if (response.ok && serverCycled && Date.now() - startedAt > 1600) {
        window.location.reload();
        return;
      }
      if (!response.ok) serverCycled = true;
    } catch {
      // Keep polling while the server process is between shutdown and startup.
      serverCycled = true;
    }
  }
  window.location.reload();
}

function localServerHealthUrl() {
  if (typeof window === "undefined") return "/api/health";
  const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
  const apiPort = import.meta.env.VITE_API_PORT || "3336";
  if (localHosts.has(window.location.hostname)) return `http://127.0.0.1:${apiPort}/api/health`;
  return "/api/health";
}

function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

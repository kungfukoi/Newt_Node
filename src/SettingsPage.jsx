import React from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  FolderOpen,
  GitPullRequest,
  KeyRound,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Trash2
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
import { defaultModelProviderPreferences, normalizeModelProviderPreferences, providerPreferenceLabel } from "./modelProviderRouting.js";
import { keyDetail, providerMetricTone, providerMetricValue, unverifiedKeyValidation } from "./settingsKeyStatus.js";
import { readSettingsOpenSections, writeSettingsOpenSections } from "./settingsSectionState.js";

const providerDefinitions = Object.freeze([
  Object.freeze({ id: "fal", label: "Fal" }),
  Object.freeze({ id: "google", label: "Google" }),
  Object.freeze({ id: "krea", label: "Krea" }),
  Object.freeze({ id: "openAi", label: "OpenAI" })
]);

const emptyCredentialState = Object.freeze({ fal: [], google: [], krea: [], openAi: [] });
const emptyActiveCredentialIds = Object.freeze({ fal: "", google: "", krea: "", openAi: "" });

export default function SettingsPage() {
  const [settings, setSettings] = React.useState(null);
  const [credentials, setCredentials] = React.useState(emptyCredentialState);
  const [activeCredentialIds, setActiveCredentialIds] = React.useState(emptyActiveCredentialIds);
  const [visibleCredentialIds, setVisibleCredentialIds] = React.useState({});
  const [modelProviderPreferences, setModelProviderPreferences] = React.useState(defaultModelProviderPreferences);
  const [repository, setRepository] = React.useState("");
  const [comfyWanRootPath, setComfyWanRootPath] = React.useState("");
  const [comfyWanStatus, setComfyWanStatus] = React.useState(null);
  const [comfyWanBusy, setComfyWanBusy] = React.useState(false);
  const [minimaxH3LocalStatus, setMinimaxH3LocalStatus] = React.useState(null);
  const [minimaxH3LocalBusy, setMinimaxH3LocalBusy] = React.useState(false);
  const [modelPreferences, setModelPreferences] = React.useState(defaultModelPreferences);
  const [openSections, setOpenSections] = React.useState(readSettingsOpenSections);
  const [status, setStatus] = React.useState("loading");
  const [keyValidationBusy, setKeyValidationBusy] = React.useState(false);
  const [busy, setBusy] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [updateLog, setUpdateLog] = React.useState("");
  const [lastUpdated, setLastUpdated] = React.useState(null);
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
      await refreshKeyValidation();
      refreshComfyWanStatus(data.comfyWanRootPath || "", { quiet: true });
      refreshMinimaxH3LocalStatus({ quiet: true });
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
      const nextModelPreferences = normalizeModelPreferences(modelPreferences);
      const credentialPayload = normalizedCredentialPayload(credentials, activeCredentialIds);
      const payload = {
        repository,
        comfyWanRootPath,
        modelPreferences: nextModelPreferences,
        credentials: credentialPayload.credentials,
        activeCredentialIds: credentialPayload.activeCredentialIds,
        modelProviderPreferences: normalizeModelProviderPreferences(modelProviderPreferences)
      };

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
      dispatchModelProviderPreferences(data.modelProviderPreferences);
      setMessage(data.apiKeysFound ? "Settings saved." : "No API keys found.");
      setLastUpdated(new Date());
      await refreshKeyValidation();
      refreshComfyWanStatus(data.comfyWanRootPath || comfyWanRootPath, { quiet: true });
      refreshMinimaxH3LocalStatus({ quiet: true });
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
    setSettings(data);
    setCredentials(normalizeCredentialsForUi(data.secrets?.credentials));
    setActiveCredentialIds(normalizeActiveCredentialIdsForUi(data.activeCredentialIds));
    setVisibleCredentialIds({});
    setModelProviderPreferences(normalizeModelProviderPreferences(data.modelProviderPreferences));
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

  async function refreshMinimaxH3LocalStatus({ quiet = false } = {}) {
    setMinimaxH3LocalBusy(true);
    if (!quiet) setMessage("");
    try {
      const data = await systemApi.minimaxH3LocalStatus();
      setMinimaxH3LocalStatus(data);
      if (!quiet) setMessage(data.available ? "Local MiniMax H3 is ready." : data.message || "Local MiniMax H3 needs attention.");
    } catch (error) {
      const status = { available: false, message: error.message || "Could not check Local MiniMax H3." };
      setMinimaxH3LocalStatus(status);
      if (!quiet) setMessage(status.message);
    } finally {
      setMinimaxH3LocalBusy(false);
    }
  }

  async function refreshKeyValidation() {
    setKeyValidationBusy(true);
    try {
      const validation = await settingsApi.validateKeys();
      setSettings((current) => ({
        ...(current || {}),
        keyValidation: validation?.providers || {},
        keyValidationByCredential: validation?.credentials || {},
        keyValidationCheckedAt: validation?.checkedAt || ""
      }));
    } catch {
      setSettings((current) => ({
        ...(current || {}),
        keyValidation: unverifiedKeyValidation(current)
      }));
    } finally {
      setKeyValidationBusy(false);
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

  function addCredential(provider) {
    const id = newCredentialId(provider);
    setCredentials((current) => ({
      ...current,
      [provider]: [...(current[provider] || []), {
        id,
        label: `${providerDefinitions.find((item) => item.id === provider)?.label || "API"} key ${(current[provider] || []).length + 1}`,
        key: ""
      }]
    }));
    setActiveCredentialIds((current) => ({ ...current, [provider]: current[provider] || id }));
  }

  function updateCredential(provider, id, patch) {
    setCredentials((current) => ({
      ...current,
      [provider]: (current[provider] || []).map((credential) => credential.id === id ? { ...credential, ...patch } : credential)
    }));
    setSettings((current) => ({
      ...(current || {}),
      keyValidationByCredential: {
        ...(current?.keyValidationByCredential || {}),
        [provider]: {
          ...(current?.keyValidationByCredential?.[provider] || {}),
          [id]: undefined
        }
      }
    }));
  }

  function removeCredential(provider, id) {
    setCredentials((current) => ({
      ...current,
      [provider]: (current[provider] || []).filter((credential) => credential.id !== id)
    }));
    setActiveCredentialIds((current) => ({
      ...current,
      [provider]: current[provider] === id ? "" : current[provider]
    }));
  }

  function toggleCredentialVisibility(provider, id) {
    const key = `${provider}:${id}`;
    setVisibleCredentialIds((current) => ({ ...current, [key]: !current[key] }));
  }

  function toggleSection(section) {
    setOpenSections((current) => writeSettingsOpenSections({ ...current, [section]: !current[section] }));
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
        {providerDefinitions.map((provider) => {
          const configured = Boolean(settings?.[providerConfiguredField(provider.id)]);
          const validation = settings?.keyValidation?.[provider.id];
          return (
            <SettingsMetric
              key={provider.id}
              icon={<KeyRound size={20} />}
              label={`${provider.label} API`}
              value={providerMetricValue(configured, validation, keyValidationBusy)}
              detail={keyDetail(settings?.activeCredentialLabels?.[provider.id], status, validation)}
              tone={providerMetricTone(configured, validation)}
            />
          );
        })}
        <SettingsMetric icon={<GitPullRequest size={20} />} label="Branch" value={branchMetricValue(settings)} detail={branchMetricDetail(settings)} tone={branchMetricTone(settings?.branchStatus?.state)} />
        <SettingsMetric icon={<RotateCcw size={20} />} label="Server" value={settings?.restartRequested ? "Restarting" : "Running"} detail="Local app" tone={settings?.restartRequested ? "warn" : "good"} />
      </div>

      <div className="settings-grid">
        <CollapsibleSettingsSection
          title="API Credentials"
          aside="One active key per service"
          open={openSections.credentials}
          onToggle={() => toggleSection("credentials")}
          wide
        >
          <div className="settings-credential-grid">
            {providerDefinitions.map((provider) => (
              <CredentialProviderCard
                key={provider.id}
                provider={provider}
                credentials={credentials[provider.id] || []}
                activeId={activeCredentialIds[provider.id] || ""}
                validation={settings?.keyValidationByCredential?.[provider.id] || {}}
                visibleCredentialIds={visibleCredentialIds}
                onAdd={() => addCredential(provider.id)}
                onActivate={(id) => setActiveCredentialIds((current) => ({ ...current, [provider.id]: id }))}
                onChange={(id, next) => updateCredential(provider.id, id, next)}
                onRemove={(id) => removeCredential(provider.id, id)}
                onToggleVisibility={(id) => toggleCredentialVisibility(provider.id, id)}
              />
            ))}
          </div>
          <div className="settings-actions">
            <button type="button" onClick={saveSettings} disabled={actionsDisabled}>
              <Save size={15} />
              <span>{busy === "save" ? "Saving" : "Save & Validate"}</span>
            </button>
          </div>
        </CollapsibleSettingsSection>

        <CollapsibleSettingsSection
          title="Model Providers"
          aside="Explicit runtime routing"
          open={openSections.providers}
          onToggle={() => toggleSection("providers")}
          wide
        >
          <div className="settings-provider-routing">
            <label className="settings-field">
              <span>MiniMax H3</span>
              <select
                value={modelProviderPreferences.minimaxH3}
                onChange={(event) => {
                  const provider = event.target.value;
                  setModelProviderPreferences((current) => ({ ...current, minimaxH3: provider }));
                  if (provider === "local") refreshMinimaxH3LocalStatus({ quiet: true });
                }}
              >
                <option value="fal">Fal</option>
                <option value="local">Local</option>
              </select>
              <small>{modelProviderDetail(modelProviderPreferences.minimaxH3, activeCredentialIds, "MiniMax H3", minimaxH3LocalStatus, minimaxH3LocalBusy)}</small>
            </label>
            <label className="settings-field">
              <span>Seedance 2.0 / 2.5</span>
              <select
                value={modelProviderPreferences.seedance}
                onChange={(event) => setModelProviderPreferences((current) => ({ ...current, seedance: event.target.value }))}
              >
                <option value="fal">Fal</option>
                <option value="krea">Krea</option>
              </select>
              <small>{modelProviderDetail(modelProviderPreferences.seedance, activeCredentialIds, "Seedance")}</small>
            </label>
            <label className="settings-field">
              <span>Veo / Google Video</span>
              <select
                value={modelProviderPreferences.veo}
                onChange={(event) => setModelProviderPreferences((current) => ({ ...current, veo: event.target.value }))}
              >
                <option value="google">Google</option>
                <option value="fal">Fal</option>
              </select>
              <small>{modelProviderDetail(modelProviderPreferences.veo, activeCredentialIds, "Google video")}</small>
            </label>
            <label className="settings-field">
              <span>Image Generation</span>
              <select
                value={modelProviderPreferences.imageGeneration}
                onChange={(event) => setModelProviderPreferences((current) => ({ ...current, imageGeneration: event.target.value }))}
              >
                <option value="google">Google</option>
                <option value="fal">Fal</option>
              </select>
              <small>{modelProviderDetail(modelProviderPreferences.imageGeneration, activeCredentialIds, "Nano Banana Pro")}</small>
            </label>
          </div>
          <div className="settings-actions">
            <button type="button" onClick={saveSettings} disabled={actionsDisabled}>
              <Save size={15} />
              <span>{busy === "save" ? "Saving" : "Save Routing"}</span>
            </button>
          </div>
        </CollapsibleSettingsSection>

        <CollapsibleSettingsSection
          title="Enabled Models"
          open={openSections.models}
          onToggle={() => toggleSection("models")}
          wide
        >
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
        </CollapsibleSettingsSection>

        <CollapsibleSettingsSection
          title="Repository"
          aside={settings?.branch || "Current branch"}
          open={openSections.repository}
          onToggle={() => toggleSection("repository")}
        >
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
        </CollapsibleSettingsSection>

        <CollapsibleSettingsSection
          title="Restart"
          aside={settings?.restartRequested ? "Queued" : "Ready"}
          open={openSections.restart}
          onToggle={() => toggleSection("restart")}
        >
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
        </CollapsibleSettingsSection>

        {(message || updateLog) && (
          <CollapsibleSettingsSection
            title="Status"
            aside={busy || status}
            open={openSections.status}
            onToggle={() => toggleSection("status")}
            wide
          >
            {message && <p className="settings-message">{message}</p>}
            {updateLog && <pre className="settings-log">{updateLog}</pre>}
          </CollapsibleSettingsSection>
        )}

        <CollapsibleSettingsSection
          title="Comfy Engine"
          aside={comfyWanAside(comfyWanStatus, comfyWanBusy)}
          open={openSections.comfy}
          onToggle={() => toggleSection("comfy")}
          wide
          className="settings-comfy-panel"
        >
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
        </CollapsibleSettingsSection>
      </div>
    </section>
  );
}

function CredentialProviderCard({
  provider,
  credentials,
  activeId,
  validation,
  visibleCredentialIds,
  onAdd,
  onActivate,
  onChange,
  onRemove,
  onToggleVisibility
}) {
  return (
    <section className="settings-credential-provider">
      <header>
        <div>
          <strong>{provider.label}</strong>
          <small>{credentials.length ? `${credentials.length} saved` : "No credentials"}</small>
        </div>
        <button type="button" onClick={onAdd} title={`Add ${provider.label} key`}>
          <Plus size={14} />
          <span>Add key</span>
        </button>
      </header>
      <label className={`settings-credential-off ${activeId ? "" : "active"}`}>
        <input type="radio" name={`${provider.id}-active-key`} checked={!activeId} onChange={() => onActivate("")} />
        <span>None</span>
        <small>Service disabled</small>
      </label>
      <div className="settings-credential-list">
        {credentials.map((credential) => {
          const visibleKey = `${provider.id}:${credential.id}`;
          const visible = Boolean(visibleCredentialIds[visibleKey]);
          const result = validation?.[credential.id];
          return (
            <article key={credential.id} className={`settings-credential-row ${activeId === credential.id ? "active" : ""}`}>
              <label className="settings-credential-radio" title={`Use ${credential.label || provider.label}`}>
                <input
                  type="radio"
                  name={`${provider.id}-active-key`}
                  checked={activeId === credential.id}
                  onChange={() => onActivate(credential.id)}
                />
              </label>
              <div className="settings-credential-fields">
                <input
                  className="settings-credential-name"
                  type="text"
                  value={credential.label}
                  onChange={(event) => onChange(credential.id, { label: event.target.value })}
                  placeholder={`${provider.label} key name`}
                  aria-label={`${provider.label} credential name`}
                />
                <div className="settings-input-row secret">
                  <KeyRound size={15} />
                  <input
                    type={visible ? "text" : "password"}
                    value={credential.key}
                    onChange={(event) => onChange(credential.id, { key: event.target.value })}
                    placeholder={`Paste ${provider.label} key`}
                    autoComplete="off"
                    spellCheck="false"
                    aria-label={`${provider.label} API key`}
                  />
                  <button
                    type="button"
                    className="settings-secret-toggle"
                    onClick={() => onToggleVisibility(credential.id)}
                    disabled={!credential.key}
                    title={visible ? "Hide key" : "Show key"}
                    aria-label={visible ? "Hide key" : "Show key"}
                  >
                    {visible ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <CredentialValidationBadge validation={result} hasKey={Boolean(credential.key.trim())} />
              <button
                type="button"
                className="settings-credential-delete"
                onClick={() => onRemove(credential.id)}
                title={`Delete ${credential.label || provider.label}`}
                aria-label={`Delete ${credential.label || provider.label}`}
              >
                <Trash2 size={15} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CredentialValidationBadge({ validation, hasKey }) {
  const status = hasKey ? validation?.status || "pending" : "missing";
  const label = status === "valid"
    ? "Valid"
    : status === "invalid"
      ? "Invalid"
      : status === "unverified"
        ? "Unverified"
        : status === "missing"
          ? "Key needed"
          : "Save to check";
  return <span className={`settings-credential-status ${status}`}>{label}</span>;
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

function dispatchModelProviderPreferences(preferences) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("newtnode:model-provider-settings-updated", {
    detail: normalizeModelProviderPreferences(preferences)
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

function normalizeCredentialsForUi(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  return Object.fromEntries(providerDefinitions.map((provider) => [
    provider.id,
    Array.isArray(incoming[provider.id])
      ? incoming[provider.id].map((credential, index) => ({
          id: String(credential?.id || `${provider.id}-${index + 1}`),
          label: String(credential?.label || `${provider.label} key ${index + 1}`),
          key: String(credential?.key || "")
        }))
      : []
  ]));
}

function CollapsibleSettingsSection({ title, aside, open, onToggle, wide = false, className = "", children }) {
  const panelClassName = [
    "stats-panel",
    "settings-panel",
    "settings-collapsible-panel",
    wide ? "wide" : "",
    open ? "open" : "",
    className
  ].filter(Boolean).join(" ");

  return (
    <section className={panelClassName}>
      <button type="button" className="settings-panel-toggle" onClick={onToggle} aria-expanded={open}>
        <span className="panel-title settings-toggle-title">
          <span>{title}</span>
          {aside && <small>{aside}</small>}
        </span>
        <ChevronDown size={16} />
      </button>
      {open && children}
    </section>
  );
}

function normalizeActiveCredentialIdsForUi(value = {}) {
  const incoming = value && typeof value === "object" ? value : {};
  return Object.fromEntries(providerDefinitions.map((provider) => [provider.id, String(incoming[provider.id] || "")]));
}

function normalizedCredentialPayload(credentials = {}, activeCredentialIds = {}) {
  const normalized = Object.fromEntries(providerDefinitions.map((provider) => [
    provider.id,
    (credentials[provider.id] || [])
      .map((credential, index) => ({
        id: String(credential.id || `${provider.id}-${index + 1}`),
        label: String(credential.label || "").trim() || `${provider.label} key ${index + 1}`,
        key: String(credential.key || "").trim()
      }))
      .filter((credential) => credential.key)
  ]));
  const active = Object.fromEntries(providerDefinitions.map((provider) => {
    const requested = String(activeCredentialIds[provider.id] || "");
    const exists = normalized[provider.id].some((credential) => credential.id === requested);
    return [provider.id, exists ? requested : ""];
  }));
  return { credentials: normalized, activeCredentialIds: active };
}

function newCredentialId(provider) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${provider}-${suffix}`;
}

function providerConfiguredField(provider) {
  if (provider === "fal") return "falKeyConfigured";
  if (provider === "google") return "googleApiKeyConfigured";
  if (provider === "krea") return "kreaApiKeyConfigured";
  return "openAiApiKeyConfigured";
}

function modelProviderDetail(provider, activeCredentialIds, modelLabel, localStatus = null, localBusy = false) {
  const providerLabel = providerPreferenceLabel(provider);
  if (provider === "local") {
    if (localBusy) return "Checking the local SGLang service";
    if (localStatus?.available) return `SGLang is ready at ${localStatus.url}`;
    return localStatus?.message || "Start the local SGLang MiniMax H3 service, then render at 576P";
  }
  return activeCredentialIds?.[provider]
    ? `${providerLabel} will render ${modelLabel}`
    : `Select an active ${providerLabel} key above`;
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

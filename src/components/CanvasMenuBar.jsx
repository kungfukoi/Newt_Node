import React from "react";
import { Check, ChevronDown, ChevronRight, Download, Folder, FolderOpen, History, Layers, MoreHorizontal, PanelLeftOpen, PanelRightOpen, Play, Plus, Save, Trash2 } from "lucide-react";
import { NewtPresetLibrary } from "./NewtPresetDialog.jsx";
import "./CanvasMenuBar.css";

export default function CanvasMenuBar({ projectName, onRename, projectPath, projects, fileMenuOpen, setFileMenuOpen, projectMenuOpen, setProjectMenuOpen,
  onNew, onOpen, onSave, onSaveAs, onImport, onLoad, onDelete, toolbarCollapsed, onToggleToolbar, outputsCollapsed, onToggleOutputs, onRunAll, canRun, presets, selectedCount = 0 }) {
  const root = React.useRef(null), renameInput = React.useRef(null), originalName = React.useRef("");
  const [moreOpen, setMoreOpen] = React.useState(false), [renaming, setRenaming] = React.useState(false);
  const [presetsOpen, setPresetsOpen] = React.useState(false);
  const openMenu = fileMenuOpen ? "file" : projectMenuOpen ? "recent" : moreOpen ? "more" : presetsOpen && presets ? "presets" : "";
  const command = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl+";
  const pathParts = String(projectPath || "").replace(/\\/g, "/").split("/").filter(Boolean);
  const folderName = pathParts.at(-1) || "Local workspace";
  function open(name) { setFileMenuOpen(name === "file"); setProjectMenuOpen(name === "recent"); setMoreOpen(name === "more"); setPresetsOpen(name === "presets"); }
  function close(restoreFocus = false) {
    if (restoreFocus) root.current?.querySelector(`[data-menu-trigger="${openMenu}"]`)?.focus();
    open("");
  }
  function action(callback) { close(); callback(); }
  React.useEffect(() => {
    const dismiss = event => { if (!root.current?.contains(event.target)) open(""); };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, []);
  React.useEffect(() => {
    if (!openMenu) return;
    const panel = root.current?.querySelector(`[data-menu="${openMenu}"]`);
    const target = openMenu === "presets" ? panel?.querySelector("select:not(:disabled)") || panel?.querySelector("button:not(:disabled)") : panel?.querySelector("[role^='menuitem']");
    target?.focus();
  }, [openMenu]);
  React.useEffect(() => {
    if (!openMenu) return;
    const escape = event => { if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); close(true); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [openMenu]);
  React.useLayoutEffect(() => {
    if (!openMenu) return;
    const panel = root.current?.querySelector(`[data-menu="${openMenu}"]`);
    function fit() {
      if (!panel) return;
      panel.style.transform = "";
      const rect = panel.getBoundingClientRect();
      const offset = rect.left < 16 ? 16 - rect.left : rect.right > window.innerWidth - 16 ? window.innerWidth - 16 - rect.right : 0;
      if (offset) panel.style.transform = `translateX(${offset}px)`;
    }
    fit(); window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [openMenu]);
  React.useEffect(() => { if (renaming) { renameInput.current?.focus(); renameInput.current?.select(); } }, [renaming]);
  function menuKeys(event) {
    if (!event.target.closest("[data-menu]")) return;
    if (openMenu === "presets") {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); }
      else if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") event.stopPropagation();
      return;
    }
    if (event.key === "Tab") { close(); return; }
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const names = [...root.current.querySelectorAll("[data-menu-trigger]")].map(button => button.dataset.menuTrigger), index = names.indexOf(openMenu);
      open(names[(index + (event.key === "ArrowRight" ? 1 : -1) + names.length) % names.length]);
      return;
    }
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const items = [...event.target.closest("[role='menu']").querySelectorAll("[role^='menuitem']:not(:disabled)")];
    const index = items.indexOf(document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  }
  const trigger = (name, label, children, className = "") => <button type="button" className={`canvas-menu-trigger ${className}`} data-menu-trigger={name}
    aria-label={label} aria-haspopup={name === "presets" ? "dialog" : "menu"} aria-expanded={openMenu === name} aria-controls={`canvas-${name}-menu`} title={label === "File" ? projectName : label}
    onClick={() => open(openMenu === name ? "" : name)} onKeyDown={event => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); open(name); }
      if (event.key === "Escape") { event.preventDefault(); close(true); }
      if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
        event.preventDefault();
        const buttons = [...root.current.querySelectorAll("[data-menu-trigger]")], i = buttons.indexOf(event.currentTarget);
        buttons[(i + (event.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
      }
    }}>{children}</button>;
  const item = (label, Icon, callback, shortcut) => <button type="button" role="menuitem" onClick={() => action(callback)}><Icon size={15} /><span>{label}</span>{shortcut && <kbd>{shortcut}</kbd>}</button>;
  return <header className="canvas-menu-bar" ref={root} role="toolbar" aria-label="Canvas menu bar" onKeyDown={menuKeys}
    onBlurCapture={event => { if (openMenu === "presets" && event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close(); }}>
    <div className="canvas-document-menu">
      {renaming ? <input ref={renameInput} aria-label="Project name" className="canvas-document-name" value={projectName} onChange={event => onRename(event.target.value)}
        onBlur={() => setRenaming(false)} onKeyDown={event => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") return;
          event.stopPropagation();
          if (event.key === "Escape") onRename(originalName.current);
          if (["Enter", "Escape"].includes(event.key)) setRenaming(false);
        }} />
        : trigger("file", "File", <><span>{projectName || "Untitled canvas"}</span><ChevronDown size={14} /></>, "canvas-document-trigger")}
      {fileMenuOpen && <div className="canvas-menu-dropdown" role="menu" aria-label="File" id="canvas-file-menu" data-menu="file">
        {item("New canvas", Plus, onNew)}
        {item("Open…", FolderOpen, onOpen)}
        <div role="separator" />
        {item("Save", Save, onSave, `${command}S`)}
        {item("Save As…", Save, onSaveAs, `${command}Shift+S`)}
        {item("Rename…", Folder, () => { originalName.current = projectName; setRenaming(true); })}
        <div role="separator" />
        {item("Import workflow…", Download, onImport)}
      </div>}
    </div>
    <span className="canvas-menu-divider" />
    <button className="canvas-menu-icon canvas-quick-new" title="New canvas" aria-label="New canvas" onClick={onNew}><Plus size={18} /></button>
    <button className="canvas-menu-icon" title={`Save project (${command}S)`} aria-label="Save project" onClick={onSave}><Save size={17} /></button>
    <div className="canvas-more-menu">
      {trigger("more", "Canvas options", <MoreHorizontal size={19} />)}
      {moreOpen && <div className="canvas-menu-dropdown" role="menu" aria-label="Canvas options" id="canvas-more-menu" data-menu="more">
        <span className="canvas-menu-section">View</span>
        <button role="menuitemcheckbox" aria-checked={!toolbarCollapsed} onClick={() => action(onToggleToolbar)}><PanelLeftOpen size={15} /><span>Node palette</span>{!toolbarCollapsed && <Check size={14} />}</button>
        <button role="menuitemcheckbox" aria-checked={!outputsCollapsed} onClick={() => action(onToggleOutputs)}><PanelRightOpen size={15} /><span>Project outputs</span>{!outputsCollapsed && <Check size={14} />}</button>
      </div>}
    </div>
    {presets && <div className="canvas-presets-menu">
      {trigger("presets", "Presets", <><Layers size={16} /><span>Presets</span><ChevronDown size={12} /></>)}
      {openMenu === "presets" && <div className="canvas-menu-dropdown canvas-presets-dropdown" role="dialog" aria-label="Workflow presets" id="canvas-presets-menu" data-menu="presets">
        <NewtPresetLibrary controller={presets} canSaveSelection={selectedCount > 0} onSaveSelection={() => { close(true); presets.beginSave(); }} />
      </div>}
    </div>}
    <span className="canvas-menu-divider canvas-path-divider" />
    <div className="canvas-project-location" title={projectPath || "Save As to choose a portable workflow folder"}><Folder size={17} /><span>{folderName}</span><ChevronRight size={13} /><small>Canvas</small></div>
    <div className="canvas-menu-spacer" />
    {toolbarCollapsed && <button className="canvas-menu-icon canvas-panel-toggle" title="Show node palette" aria-label="Show node palette" onClick={onToggleToolbar}><PanelLeftOpen size={17} /></button>}
    {outputsCollapsed && <button className="canvas-menu-icon canvas-panel-toggle" title="Show project outputs" aria-label="Show project outputs" onClick={onToggleOutputs}><PanelRightOpen size={17} /></button>}
    <div className="canvas-recent-menu">
      {trigger("recent", "Recent Projects", <History size={19} />)}
      {projectMenuOpen && <div className="canvas-menu-dropdown canvas-recent-dropdown" role="menu" aria-label="Recent Projects" id="canvas-recent-menu" data-menu="recent">
        <span className="canvas-menu-section">Recent projects</span>
        {projects.length ? projects.map(project => <div className="canvas-recent-row" key={project.id}>
          <button role="menuitem" title={project.fileName || project.name} onClick={() => action(() => onLoad(project.id))}><Folder size={15} /><span>{project.name}</span></button>
          <button className="canvas-recent-remove" role="menuitem" aria-label={`Remove ${project.name} from recent projects`} onClick={() => onDelete(project)}><Trash2 size={14} /></button>
        </div>) : <small className="canvas-menu-empty">No recent projects</small>}
        <div role="separator" />
        {item("Open project…", FolderOpen, onOpen)}
      </div>}
    </div>
    <button className="canvas-run-all" onClick={onRunAll} disabled={!canRun}><Play size={17} fill="currentColor" /><span>Run all</span></button>
  </header>;
}

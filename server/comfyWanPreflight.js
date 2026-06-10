import path from "node:path";
import { readFile, stat } from "node:fs/promises";

export const comfyWanRequirementsPath = "docs/comfyWan-requirements.yaml";

export function normalizeComfyWanWorkflowName(value) {
  const text = String(value || "").toLowerCase();
  if (text.includes("blend")) return "WanBlend";
  if (text.includes("segment")) return "WanSegment";
  return "WanWarp";
}

export function normalizeComfyRootPath(value) {
  return String(value || "").trim().replace(/^["']|["']$/g, "");
}

export async function readComfyWanInstallStatus({
  projectRoot,
  requirementsPath = comfyWanRequirementsPath,
  comfyRootPath = "",
  workflow = ""
} = {}) {
  const normalizedWorkflow = normalizeComfyWanWorkflowName(workflow);
  const rootPath = normalizeComfyRootPath(comfyRootPath);
  const manifestPath = path.isAbsolute(requirementsPath) ? requirementsPath : path.join(projectRoot, requirementsPath);
  const manifestText = await readFile(manifestPath, "utf8");
  const manifest = parseComfyWanRequirements(manifestText);
  const requiredCustomNodes = manifest.customNodes.filter((item) => item.required !== false && item.target);
  const requiredModels = manifest.models.filter((item) => item.required !== false && item.target && requirementMatchesWorkflow(item, normalizedWorkflow));

  if (!rootPath) {
    return {
      configured: false,
      rootPath: "",
      rootExists: false,
      rootLooksValid: false,
      ready: false,
      workflow: normalizedWorkflow,
      checkedAt: new Date().toISOString(),
      errorCode: "COMFYUI_ROOT_NOT_CONFIGURED",
      message: "Set the ComfyUI root folder in Settings.",
      requirementsPath,
      customNodeCount: requiredCustomNodes.length,
      modelCount: requiredModels.length,
      missingCustomNodes: [],
      missingModels: []
    };
  }

  const rootExists = await pathExists(rootPath);
  const rootLooksValid = rootExists && (await pathExists(path.join(rootPath, "custom_nodes"))) && (await pathExists(path.join(rootPath, "models")));
  const [missingCustomNodes, missingModels] = await Promise.all([
    missingRequirementPaths(rootPath, requiredCustomNodes, "customNode"),
    missingRequirementPaths(rootPath, requiredModels, "model")
  ]);
  const ready = rootExists && rootLooksValid && missingCustomNodes.length === 0 && missingModels.length === 0;
  const missingCount = missingCustomNodes.length + missingModels.length;
  const message = !rootExists
    ? "The configured ComfyUI root folder does not exist."
    : !rootLooksValid
      ? "The configured folder does not look like a ComfyUI root. It should contain custom_nodes and models folders."
      : missingCount
        ? `${missingCount} ComfyUI requirement${missingCount === 1 ? "" : "s"} missing for ${normalizedWorkflow}.`
        : `${normalizedWorkflow} ComfyUI requirements are installed.`;

  return {
    configured: true,
    rootPath,
    rootExists,
    rootLooksValid,
    ready,
    workflow: normalizedWorkflow,
    checkedAt: new Date().toISOString(),
    errorCode: ready ? "" : "COMFYUI_SETUP_REQUIRED",
    message,
    requirementsPath,
    customNodeCount: requiredCustomNodes.length,
    modelCount: requiredModels.length,
    missingCustomNodes,
    missingModels
  };
}

export function parseComfyWanRequirements(text) {
  const customNodes = [];
  const models = [];
  let section = "";
  let modelGroup = "";
  let current = null;

  for (const line of String(text || "").split(/\r?\n/)) {
    const topLevel = line.match(/^([A-Za-z0-9_]+):\s*$/);
    if (topLevel) {
      section = topLevel[1];
      modelGroup = "";
      current = null;
      continue;
    }

    if (section === "custom_nodes") {
      const itemStart = line.match(/^  -\s+(.+)$/);
      if (itemStart) {
        current = {};
        customNodes.push(current);
        assignInlineYamlProperty(current, itemStart[1]);
        continue;
      }
      const property = line.match(/^    ([A-Za-z0-9_]+):\s*(.*)$/);
      if (current && property) current[property[1]] = parseYamlScalar(property[2]);
      continue;
    }

    if (section === "models") {
      const groupStart = line.match(/^  ([A-Za-z0-9_]+):\s*$/);
      if (groupStart) {
        modelGroup = groupStart[1];
        current = null;
        continue;
      }
      const itemStart = line.match(/^    -\s+(.+)$/);
      if (itemStart) {
        current = { group: modelGroup };
        models.push(current);
        assignInlineYamlProperty(current, itemStart[1]);
        continue;
      }
      const property = line.match(/^      ([A-Za-z0-9_]+):\s*(.*)$/);
      if (current && property) current[property[1]] = parseYamlScalar(property[2]);
    }
  }

  return { customNodes, models };
}

function requirementMatchesWorkflow(item, workflow) {
  const itemWorkflow = normalizeComfyWanWorkflowName(item.workflow || "");
  const targetWorkflow = workflow === "WanSegment" ? "WanWarp" : workflow;
  return itemWorkflow === targetWorkflow;
}

async function missingRequirementPaths(rootPath, items, type) {
  const checks = await Promise.all(items.map(async (item) => {
    const relativeTarget = normalizeRequirementTarget(item.target);
    const absolutePath = path.resolve(rootPath, relativeTarget);
    const exists = await pathExists(absolutePath);
    return exists ? null : {
      id: String(item.id || relativeTarget),
      type,
      workflow: String(item.workflow || ""),
      target: relativeTarget.split(path.sep).join("/"),
      path: absolutePath,
      sourceUrl: String(item.source_url || ""),
      requiredBy: String(item.required_by || item.node_reference || "")
    };
  }));
  return checks.filter(Boolean);
}

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeRequirementTarget(value) {
  return String(value || "").replace(/\\/g, "/").split("/").filter(Boolean).join(path.sep);
}

function assignInlineYamlProperty(target, text) {
  const match = String(text || "").match(/^([A-Za-z0-9_]+):\s*(.*)$/);
  if (match) target[match[1]] = parseYamlScalar(match[2]);
}

function parseYamlScalar(value) {
  const text = String(value || "").trim();
  if (text === "true") return true;
  if (text === "false") return false;
  if ((text.startsWith("\"") && text.endsWith("\"")) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
}

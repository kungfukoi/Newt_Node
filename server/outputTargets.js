import path from "node:path";
import { mkdir, open as openFile, stat } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const defaultExternalOutputsPrefix = "/external-outputs";

export async function createOutputTargetAsset(body = {}, kind = "output", extension = "", preferredBaseNameOrOptions = "", maybeOptions = {}) {
  return resolveOutputTargetAsset(body, kind, extension, preferredBaseNameOrOptions, maybeOptions, true);
}

export async function previewOutputTargetAsset(body = {}, kind = "output", extension = "", preferredBaseNameOrOptions = "", maybeOptions = {}) {
  return resolveOutputTargetAsset(body, kind, extension, preferredBaseNameOrOptions, maybeOptions, false);
}

async function resolveOutputTargetAsset(body = {}, kind = "output", extension = "", preferredBaseNameOrOptions = "", maybeOptions = {}, reserveFile = true) {
  const options = typeof preferredBaseNameOrOptions === "object" && preferredBaseNameOrOptions !== null
    ? preferredBaseNameOrOptions
    : maybeOptions;
  const rootDir = options.rootDir || process.cwd();
  const outputPrefix = options.outputPrefix || defaultExternalOutputsPrefix;
  const rawDirectory = String(body.outputTargetPath || body.outputDirectory || "").trim();
  if (!rawDirectory) return null;

  const now = options.now || new Date();
  const extensionWithDot = normalizedOutputExtension(extension || path.extname(String(kind || "")) || ".bin");
  const fileNameTemplate = String(body.outputTargetFileName || body.outputFileName || "").trim() || "$node_name_$date_$time";
  const hasIndexToken = outputTemplateHasIndexToken(rawDirectory) || outputTemplateHasIndexToken(fileNameTemplate);

  if (hasIndexToken) {
    return reserveIndexedOutputTarget({
      body,
      rawDirectory,
      fileNameTemplate,
      extension: extensionWithDot,
      rootDir,
      outputPrefix,
      now,
      reserveFile
    });
  }

  const tokenContext = outputTokenContext(body, now, 1);
  const directory = resolveOutputDirectory(expandOutputTokens(rawDirectory, tokenContext), rootDir);
  const fileName = outputTargetFileName(fileNameTemplate, extensionWithDot, tokenContext);
  if (reserveFile) await mkdir(directory, { recursive: true });
  const finalFileName = await reserveUniqueOutputTargetFileName(directory, fileName, { reserveFile });
  return outputTargetAssetFromPath(path.join(directory, finalFileName), outputPrefix);
}

export function externalOutputPublicPath(filePath, outputPrefix = defaultExternalOutputsPrefix) {
  const absolutePath = path.resolve(filePath);
  const encodedPath = Buffer.from(absolutePath, "utf8").toString("base64url");
  return `${outputPrefix}/${encodedPath}/${encodeURIComponent(path.basename(absolutePath))}`;
}

export function externalOutputFilePathFromPublicPath(publicPath, outputPrefix = defaultExternalOutputsPrefix) {
  const escapedPrefix = escapeRegExp(outputPrefix);
  const match = String(publicPath || "").match(new RegExp(`^${escapedPrefix}/([^/]+)/(.+)$`));
  if (!match) throw new Error("Invalid external output URL.");
  const filePath = path.resolve(Buffer.from(match[1], "base64url").toString("utf8"));
  const requestedName = decodeURIComponent(match[2] || "");
  if (!path.isAbsolute(filePath) || path.basename(filePath) !== requestedName) {
    throw new Error("Invalid external output file.");
  }
  return filePath;
}

async function reserveIndexedOutputTarget({ body, rawDirectory, fileNameTemplate, extension, rootDir, outputPrefix, now, reserveFile }) {
  for (let outputIndex = 1; outputIndex < 10000; outputIndex += 1) {
    const tokenContext = outputTokenContext(body, now, outputIndex);
    const directory = resolveOutputDirectory(expandOutputTokens(rawDirectory, tokenContext), rootDir);
    const fileName = outputTargetFileName(fileNameTemplate, extension, tokenContext);
    const filePath = path.join(directory, fileName);
    try {
      await resolveOutputFileCandidate(filePath, reserveFile);
      return outputTargetAssetFromPath(filePath, outputPrefix);
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      throw error;
    }
  }

  const tokenContext = outputTokenContext(body, now, 1);
  const directory = resolveOutputDirectory(expandOutputTokens(rawDirectory, tokenContext), rootDir);
  if (reserveFile) await mkdir(directory, { recursive: true });
  const fallbackName = outputTargetFileName(`${fileNameTemplate}-${randomUUID().slice(0, 8)}`, extension, tokenContext);
  const filePath = path.join(directory, fallbackName);
  await resolveOutputFileCandidate(filePath, reserveFile);
  return outputTargetAssetFromPath(filePath, outputPrefix);
}

function outputTargetAssetFromPath(filePath, outputPrefix) {
  return {
    fileName: path.basename(filePath),
    relativePath: "",
    filePath,
    publicPath: externalOutputPublicPath(filePath, outputPrefix),
    externalPath: filePath,
    outputTarget: true
  };
}

function outputTokenContext(body = {}, now = new Date(), outputIndex = 1) {
  const outputNodeName = safeOutputTokenValue(body.outputTargetNodeTitle || body.nodeTitle || "Output");
  const sourceNodeName = safeOutputTokenValue(body.outputTargetSourceNodeTitle || body.sourceTitle || "source");
  return {
    node_name: outputNodeName,
    source_node_name: sourceNodeName,
    date: formatOutputDate(now),
    time: formatOutputTime(now),
    index: String(Math.max(1, Number(outputIndex) || 1)).padStart(2, "0"),
    workflow_name: safeOutputTokenValue(body.workflowName || body.projectName || "workflow"),
    output_node_name: outputNodeName
  };
}

function expandOutputTokens(value, tokenContext = {}) {
  return String(value || "").replace(
    /\$(source_node_name|output_node_name|workflow_name|node_name|date|time|index)(?=$|[^A-Za-z0-9])/g,
    (_match, token) => tokenContext[token] || ""
  );
}

function formatOutputDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatOutputTime(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}-${minutes}-${seconds}`;
}

function safeOutputTokenValue(value) {
  return String(value || "")
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 96) || "output";
}

function resolveOutputDirectory(value, rootDir) {
  const expanded = String(value || "").trim();
  if (!expanded) throw outputHttpError(400, "Set an Output path before running.");
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(rootDir, expanded);
}

function outputTargetFileName(template, extension, tokenContext = {}) {
  const expanded = expandOutputTokens(template || "$node_name_$date_$time", tokenContext);
  const cleanBaseName = path.basename(expanded).replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_").replace(/[. ]+$/g, "").trim() || "output";
  const parsed = path.parse(cleanBaseName);
  const explicitExtension = parsed.ext ? normalizedOutputExtension(parsed.ext) : "";
  const safeBase = (parsed.name || cleanBaseName)
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "_")
    .replace(/[. ]+$/g, "")
    .slice(0, 160) || "output";
  return `${safeBase}${explicitExtension || extension}`;
}

function normalizedOutputExtension(extension) {
  const clean = String(extension || "").trim().replace(/[^A-Za-z0-9.]/g, "").slice(0, 16);
  if (!clean) return ".bin";
  return clean.startsWith(".") ? clean : `.${clean}`;
}

function outputTemplateHasIndexToken(template) {
  return /\$index\b/.test(String(template || ""));
}

async function reserveUniqueOutputTargetFileName(directory, fileName, { reserveFile = true } = {}) {
  const parsed = path.parse(fileName || "output.bin");
  const base = parsed.name || "output";
  const extension = parsed.ext || ".bin";
  for (let index = 0; index < 500; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidate = `${base}${suffix}${extension}`;
    const filePath = path.join(directory, candidate);
    try {
      await resolveOutputFileCandidate(filePath, reserveFile);
      return candidate;
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      throw error;
    }
  }
  const fallback = `${base}-${randomUUID().slice(0, 8)}${extension}`;
  await resolveOutputFileCandidate(path.join(directory, fallback), reserveFile);
  return fallback;
}

async function resolveOutputFileCandidate(filePath, reserveFile = true) {
  if (reserveFile) {
    await reserveOutputFile(filePath);
    return;
  }

  try {
    await stat(filePath);
    const error = new Error("Output file already exists.");
    error.code = "EEXIST";
    throw error;
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

async function reserveOutputFile(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const handle = await openFile(filePath, "wx");
  await handle.close();
}

function outputHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

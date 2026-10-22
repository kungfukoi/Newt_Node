import { existsSync, readFileSync, statSync, writeFileSync, renameSync } from "node:fs";
import { dependencyFingerprint } from "./dependencyFingerprint.mjs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJsonPath = path.join(rootDir, "package.json");
const packageLockPath = path.join(rootDir, "package-lock.json");
const hiddenLockPath = path.join(rootDir, "node_modules", ".package-lock.json");
const npmCachePath = path.join(rootDir, "server", "data", "npm-cache");
const stampPath = path.join(rootDir, "node_modules", ".newtnode-dependencies.json");

const packageJson = readJson(packageJsonPath);
const packageLock = existsSync(packageLockPath) ? readJson(packageLockPath) : null;
const dependencies = Object.keys(packageJson.dependencies || {});
const reasons = [];
const fingerprint = dependencyFingerprint(packageJson, packageLock);
let previous;
try { previous = readJson(stampPath).fingerprint; } catch { /* First upgraded launch or invalid stamp. */ }

if (!existsSync(hiddenLockPath)) {
  reasons.push("node_modules is not initialized");
} else if (previous ? previous !== fingerprint : manifestMtime() > statSync(hiddenLockPath).mtimeMs) {
  reasons.push(previous ? "dependency requirements changed" : "dependency state needs verification");
}

for (const dependency of dependencies) {
  const installedPath = path.join(rootDir, "node_modules", ...dependency.split("/"), "package.json");
  if (!existsSync(installedPath)) {
    reasons.push(`missing ${dependency}`);
    continue;
  }

  const lockedVersion = packageLock?.packages?.[`node_modules/${dependency}`]?.version;
  const installedVersion = readJson(installedPath).version;
  if (lockedVersion && installedVersion !== lockedVersion) {
    reasons.push(`${dependency} is ${installedVersion || "unknown"}; lockfile requires ${lockedVersion}`);
  }
}

if (!reasons.length) {
  saveFingerprint(fingerprint);
  console.log("NewtNode dependencies are current.");
  process.exit(0);
}

console.log(`Installing NewtNode dependencies (${[...new Set(reasons)].join("; ")})...`);
const installCommand = process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "npm";
const installArgs = process.platform === "win32"
  ? ["/d", "/s", "/c", "npm.cmd install --no-audit --no-fund"]
  : ["install", "--no-audit", "--no-fund"];
const install = spawnSync(installCommand, installArgs, {
  cwd: rootDir,
  env: {
    ...process.env,
    npm_config_cache: npmCachePath,
    npm_config_update_notifier: "false"
  },
  stdio: "inherit",
  windowsHide: true
});

if (install.error) throw install.error;
if (install.status !== 0) process.exit(install.status || 1);

const stillMissing = dependencies.filter((dependency) => {
  return !existsSync(path.join(rootDir, "node_modules", ...dependency.split("/"), "package.json"));
});

if (stillMissing.length) {
  throw new Error(`Dependency installation completed but these packages are still missing: ${stillMissing.join(", ")}`);
}

console.log("NewtNode dependencies installed.");
// npm may rewrite the lockfile. Record its resulting content, not pre-install state.
saveFingerprint(dependencyFingerprint(readJson(packageJsonPath), existsSync(packageLockPath) ? readJson(packageLockPath) : null));

function saveFingerprint(value) {
  if (previous === value) return;
  const temporary = `${stampPath}.${process.pid}.tmp`;
  writeFileSync(temporary, JSON.stringify({ fingerprint: value }) + "\n");
  renameSync(temporary, stampPath);
}

function manifestMtime() {
  return Math.max(
    statSync(packageJsonPath).mtimeMs,
    existsSync(packageLockPath) ? statSync(packageLockPath).mtimeMs : 0
  );
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

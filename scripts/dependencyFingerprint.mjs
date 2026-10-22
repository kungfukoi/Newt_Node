import { createHash } from "node:crypto";

const fields = ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "peerDependenciesMeta", "overrides", "engines", "os", "cpu", "workspaces", "packageManager"];
function manifestDependencies(value = {}) {
  return Object.fromEntries(fields.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
export function dependencyFingerprint(manifest, lock, runtime = { platform: process.platform, arch: process.arch, abi: process.versions.modules }) {
  const packages = lock?.packages ? { ...lock.packages, "": manifestDependencies(lock.packages[""]) } : undefined;
  return createHash("sha256").update(JSON.stringify(canonical({ manifest: manifestDependencies(manifest), lock: lock ? { lockfileVersion: lock.lockfileVersion, packages, dependencies: lock.dependencies } : null, runtime }))).digest("hex");
}

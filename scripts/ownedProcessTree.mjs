import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

// Called only with a child spawned by this supervisor, never a PID found by port.
export async function stopOwnedProcessTree(child, { platform = process.platform, runCommand = run, signal = process.kill } = {}) {
  if (!child?.pid) return;
  if (platform === "win32") {
    if (child.exitCode !== null) return;
    await runCommand("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, timeout: 10000 });
    return;
  }
  // Supervised POSIX children lead their own process group, inherited by helpers.
  try { signal(-child.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  await new Promise(resolve => setTimeout(resolve, 500));
  try { signal(-child.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
}

export async function stopOwnedWslServices(services, { runCommand = run } = {}) {
  const results = await Promise.allSettled([...services.values()].map(({ distro, user, service }) =>
    runCommand("wsl.exe", ["-d", distro, "-u", user, "--", "systemctl", "stop", service], { windowsHide: true, timeout: 12000 })
  ));
  for (const result of results) if (result.status === "rejected") console.error("NewtNode could not stop an owned WSL service:", result.reason.message);
}

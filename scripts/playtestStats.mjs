import { spawn } from "node:child_process";
import net from "node:net";
import { fileURLToPath } from "node:url";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const ports = [5296, 3346, 3347];
for (const port of ports) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", () => reject(new Error(`Port ${port} is occupied. Existing work was left running.`)));
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}
const env = { ...process.env, PORT: "3346", NEWTNODE_CONTROL_PORT: "3347", VITE_API_PORT: "3346", VITE_CONTROL_API_PORT: "3347", VITE_CLIENT_PORT: "5296" };
const children = [
  spawn(process.execPath, ["server/index.js"], { cwd, env, stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5296", "--strictPort"], { cwd, env, stdio: "inherit" })
];
let stopping = false;
const stop = () => { if (stopping) return; stopping = true; children.forEach(child => child.kill()); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
children.forEach(child => { child.on("error", error => { console.error(error.message); process.exitCode = 1; stop(); }); child.on("exit", code => { if (!stopping) { process.exitCode = code || 0; stop(); } }); });
console.log("Stats playtest: http://127.0.0.1:5296 — independent checkout data/settings; Ctrl+C stops only this launcher.");

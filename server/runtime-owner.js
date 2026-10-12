import { createHash } from "node:crypto";
import { createSocket } from "node:dgram";
import { mkdir, realpath } from "node:fs/promises";

// A loopback-only OS lease prevents two backend processes from writing the
// same job/history store. The OS releases it on exit, including forced kills.
export async function acquireRuntimeOwner(directory) {
  await mkdir(directory, { recursive: true });
  let identity = await realpath(directory);
  if (process.platform === "win32") identity = identity.toLowerCase();
  const port = 40000 + createHash("sha256").update(identity).digest().readUInt32BE(0) % 20000;
  const socket = createSocket({ type: "udp4", reuseAddr: false });
  try {
    await new Promise((resolve, reject) => {
      socket.once("error", reject); socket.once("listening", resolve);
      socket.bind({ address: "127.0.0.1", port, exclusive: true });
    });
  } catch (error) {
    socket.close();
    const message = error.code === "EADDRINUSE"
      ? "Newt Node's shared data is already owned by another backend, or its local ownership port is unavailable. Open another window through the normal launcher; do not start a second backend for this checkout."
      : `Could not protect Newt Node's shared data: ${error.code || "socket error"}.`;
    throw Object.assign(new Error(message), { code: "NEWT_RUNTIME_OWNED", exitCode: 73 });
  }
  socket.removeAllListeners("error");
  socket.on("error", error => { console.error(`Newt Node data ownership failed: ${error.code || "socket error"}`); process.exit(73); });
  socket.unref();
  return { port, close: () => new Promise(resolve => socket.close(resolve)) };
}

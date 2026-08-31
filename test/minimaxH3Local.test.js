import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import {
  buildMinimaxH3LocalRequest,
  ensureMinimaxH3LocalVariant,
  ensureMinimaxH3WslKeepAlive,
  minimaxH3LocalConfigFromEnv,
  minimaxH3LocalFileUri,
  normalizeMinimaxH3LocalUrl,
  readMinimaxH3LocalStatus,
  runMinimaxH3LocalJob
} from "../server/minimaxH3Local/engine.js";

test("local config enables validated WSL variant switching", () => {
  const config = minimaxH3LocalConfigFromEnv({
    MINIMAX_H3_LOCAL_WSL_DISTRO: "Newt-MiniMax-H3",
    MINIMAX_H3_LOCAL_WSL_REF2VA_SERVICE: "minimax-h3-ref2va.service"
  });
  assert.equal(config.wslDistro, "Newt-MiniMax-H3");
  assert.equal(config.ref2vaService, "minimax-h3-ref2va.service");
  assert.throws(() => minimaxH3LocalConfigFromEnv({
    MINIMAX_H3_LOCAL_WSL_DISTRO: "unsafe distro; command"
  }), /unsupported characters/i);
});

test("local URL only accepts loopback HTTP services", () => {
  assert.equal(normalizeMinimaxH3LocalUrl("http://localhost:30010/"), "http://localhost:30010");
  assert.throws(() => normalizeMinimaxH3LocalUrl("https://example.com"), /loopback/i);
  assert.throws(() => normalizeMinimaxH3LocalUrl("file:///tmp/server"), /loopback/i);
});

test("local file URIs support native and shared-root mappings", () => {
  assert.match(minimaxH3LocalFileUri("C:\\media\\shot one.png", {
    hostMediaRoot: "",
    engineMediaRoot: ""
  }), /^file:\/\/\/C:.*shot%20one\.png$/i);
  assert.equal(minimaxH3LocalFileUri("C:\\Newt\\outputs\\shot one.png", {
    hostMediaRoot: "C:\\Newt\\outputs",
    engineMediaRoot: "/mnt/newt/outputs"
  }), "file:///mnt/newt/outputs/shot%20one.png");
  assert.throws(() => minimaxH3LocalFileUri("D:\\elsewhere\\shot.png", {
    hostMediaRoot: "C:\\Newt\\outputs",
    engineMediaRoot: "/mnt/newt/outputs"
  }), /outside/i);
});

test("local requests map Newt routes to SGLang H3 tasks", () => {
  const text = buildMinimaxH3LocalRequest({
    route: "text-to-video",
    prompt: "A storm",
    duration: 5,
    resolution: "576P",
    aspectRatio: "16:9"
  });
  assert.equal(text.task, "t2va");
  assert.equal(text.target.short_edge, 576);
  assert.equal(text.num_inference_steps, 20);
  assert.deepEqual(text.conditions, []);

  const frames = buildMinimaxH3LocalRequest({
    route: "image-to-video",
    prompt: "She turns",
    duration: 10,
    resolution: "576P",
    firstFrameUri: "file:///start.png",
    lastFrameUri: "file:///end.png"
  });
  assert.equal(frames.task, "fl2va");
  assert.deepEqual(frames.conditions.map(({ frame_index }) => frame_index), [0, -1]);

  const references = buildMinimaxH3LocalRequest({
    route: "reference-to-video",
    prompt: "<Picture 1> speaks",
    duration: 8,
    resolution: "576P",
    aspectRatio: "9:16",
    referenceImageUris: ["file:///person.png"],
    referenceAudioUris: ["file:///voice.wav"]
  });
  assert.equal(references.task, "ref2va");
  assert.deepEqual(references.conditions.map(({ type }) => type), ["image", "audio"]);
  assert.throws(() => buildMinimaxH3LocalRequest({
    route: "text-to-video",
    prompt: "A storm",
    duration: 5,
    resolution: "768P"
  }), /576P/);
});

test("local status reports SGLang health without throwing", async () => {
  const healthy = await readMinimaxH3LocalStatus({
    env: { MINIMAX_H3_LOCAL_URL: "http://127.0.0.1:30010" },
    fetchImpl: async () => new Response("ok")
  });
  assert.equal(healthy.available, true);

  const unavailable = await readMinimaxH3LocalStatus({
    env: { MINIMAX_H3_LOCAL_URL: "http://127.0.0.1:30010" },
    fetchImpl: async () => { throw new Error("refused"); }
  });
  assert.equal(unavailable.available, false);
  assert.match(unavailable.message, /refused/);
});

test("local jobs submit, poll, and expose the content endpoint", async () => {
  const calls = [];
  const responses = [
    new Response(JSON.stringify({ id: "job-7", status: "queued" }), { headers: { "Content-Type": "application/json" } }),
    new Response(JSON.stringify({ id: "job-7", status: "completed", progress: 1 }), { headers: { "Content-Type": "application/json" } })
  ];
  const progress = [];
  const result = await runMinimaxH3LocalJob({
    input: { task: "fl2va", prompt: "Move" },
    env: {
      MINIMAX_H3_LOCAL_URL: "http://127.0.0.1:30010",
      MINIMAX_H3_LOCAL_POLL_INTERVAL_MS: "1"
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, method: options?.method || "GET" });
      return responses.shift();
    },
    onProgress: (entry) => progress.push(entry)
  });
  assert.deepEqual(calls, [
    { url: "http://127.0.0.1:30010/v1/videos", method: "POST" },
    { url: "http://127.0.0.1:30010/v1/videos/job-7", method: "GET" }
  ]);
  assert.equal(result.contentUrl, "http://127.0.0.1:30010/v1/videos/job-7/content");
  assert.equal(progress.at(-1).percent, 100);
});

test("WSL switching starts the requested variant and waits for health", async () => {
  const commands = [];
  const keepAlive = new EventEmitter();
  keepAlive.exitCode = null;
  keepAlive.killed = false;
  keepAlive.kill = () => { keepAlive.killed = true; };
  let healthChecks = 0;
  const config = minimaxH3LocalConfigFromEnv({
    MINIMAX_H3_LOCAL_WSL_DISTRO: "Newt-MiniMax-H3",
    MINIMAX_H3_LOCAL_STARTUP_POLL_INTERVAL_MS: "1"
  });
  await ensureMinimaxH3LocalVariant({
    task: "ref2va",
    baseUrl: "http://127.0.0.1:30010",
    config,
    spawnImpl: (command, args, options) => {
      commands.push({ command, args, options });
      return keepAlive;
    },
    execFileImpl: async (command, args) => commands.push({ command, args }),
    fetchImpl: async () => {
      healthChecks += 1;
      return new Response("ok", { status: healthChecks === 1 ? 503 : 200 });
    }
  });
  assert.deepEqual(commands.map(({ command, args }) => ({ command, args })), [
    {
      command: "wsl.exe",
      args: ["-d", "Newt-MiniMax-H3", "-u", "root", "--", "sh", "-lc", "trap 'exit 0' TERM INT HUP; while :; do sleep 3600; done"]
    },
    {
      command: "wsl.exe",
      args: ["-d", "Newt-MiniMax-H3", "-u", "root", "--", "systemctl", "start", "minimax-h3-ref2va.service"]
    }
  ]);
  assert.equal(healthChecks, 2);
});

test("WSL keepalive is reused for the same distro", () => {
  const children = [];
  const config = minimaxH3LocalConfigFromEnv({
    MINIMAX_H3_LOCAL_WSL_DISTRO: "Newt-MiniMax-H3-Reused"
  });
  const spawnImpl = () => {
    const child = new EventEmitter();
    child.exitCode = null;
    child.killed = false;
    child.kill = () => { child.killed = true; };
    children.push(child);
    return child;
  };
  const first = ensureMinimaxH3WslKeepAlive({ config, spawnImpl });
  const second = ensureMinimaxH3WslKeepAlive({ config, spawnImpl });
  assert.equal(first, second);
  assert.equal(children.length, 1);
});

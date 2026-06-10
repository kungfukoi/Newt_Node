import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  parseComfyWanRequirements,
  readComfyWanInstallStatus
} from "../server/comfyWanPreflight.js";

const manifest = `schema_version: 1
custom_nodes:
  - id: node-a
    required: true
    target: "custom_nodes/NodeA"
  - id: optional-node
    required: false
    target: "custom_nodes/Optional"
models:
  wanwarp:
    - id: warp-model
      workflow: "WanWarp"
      required: true
      target: "models/diffusion_models/warp.safetensors"
  wanblend:
    - id: blend-model
      workflow: "WanBlend"
      required: true
      target: "models/checkpoints/blend.safetensors"
`;

test("parseComfyWanRequirements reads required custom nodes and workflow models", () => {
  const parsed = parseComfyWanRequirements(manifest);

  assert.equal(parsed.customNodes.length, 2);
  assert.equal(parsed.customNodes[0].id, "node-a");
  assert.equal(parsed.customNodes[0].target, "custom_nodes/NodeA");
  assert.equal(parsed.customNodes[1].required, false);
  assert.equal(parsed.models.length, 2);
  assert.equal(parsed.models[0].group, "wanwarp");
  assert.equal(parsed.models[0].workflow, "WanWarp");
});

test("readComfyWanInstallStatus reports an unconfigured root", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "newt-comfy-preflight-"));
  try {
    await writeFile(path.join(tempDir, "wan.yaml"), manifest, "utf8");

    const status = await readComfyWanInstallStatus({
      projectRoot: tempDir,
      requirementsPath: "wan.yaml",
      workflow: "WanSegment"
    });

    assert.equal(status.ready, false);
    assert.equal(status.workflow, "WanSegment");
    assert.equal(status.errorCode, "COMFYUI_ROOT_NOT_CONFIGURED");
    assert.equal(status.customNodeCount, 1);
    assert.equal(status.modelCount, 1);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("readComfyWanInstallStatus checks required paths under the ComfyUI root", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "newt-comfy-preflight-"));
  try {
    const requirementsPath = path.join(tempDir, "wan.yaml");
    const comfyRoot = path.join(tempDir, "ComfyUI");
    await writeFile(requirementsPath, manifest, "utf8");
    await mkdir(path.join(comfyRoot, "custom_nodes", "NodeA"), { recursive: true });
    await mkdir(path.join(comfyRoot, "models", "diffusion_models"), { recursive: true });

    let status = await readComfyWanInstallStatus({
      projectRoot: tempDir,
      requirementsPath,
      comfyRootPath: comfyRoot,
      workflow: "WanWarp"
    });

    assert.equal(status.ready, false);
    assert.equal(status.errorCode, "COMFYUI_SETUP_REQUIRED");
    assert.deepEqual(status.missingCustomNodes, []);
    assert.equal(status.missingModels.length, 1);
    assert.equal(status.missingModels[0].target, "models/diffusion_models/warp.safetensors");

    await writeFile(path.join(comfyRoot, "models", "diffusion_models", "warp.safetensors"), "stub", "utf8");
    status = await readComfyWanInstallStatus({
      projectRoot: tempDir,
      requirementsPath,
      comfyRootPath: comfyRoot,
      workflow: "WanWarp"
    });

    assert.equal(status.ready, true);
    assert.equal(status.errorCode, "");
    assert.equal(status.missingModels.length, 0);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

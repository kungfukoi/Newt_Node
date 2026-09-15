import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("video timer advances beyond 2:59 with unchanged provider status and freezes on completion", async ({ page }) => {
  const start = new Date("2026-09-15T12:00:00Z");
  let completed = false;
  let visible = false;
  await openFixture(page, { count: 1, scale: 1, videoProgress: true, progressEntries: (scope) => visible ? [{
    runId: "atlas-run", groupId: "atlas-group", nodeId: "model", scope, kind: "video", label: "Seedance 2.5",
    status: completed ? "completed" : "running", phase: completed ? "complete" : "generating",
    provider: "atlas", providerStatus: completed ? "completed" : "processing",
    startedAt: start.toISOString(), updatedAt: new Date(start.getTime() + (completed ? 600000 : 1000)).toISOString()
  }] : [] });
  await page.clock.install({ time: new Date(start.getTime() + 176000) });
  await page.clock.pauseAt(new Date(start.getTime() + 176000));
  visible = true;
  await page.clock.fastForward(3000);
  const labels = page.locator('[data-node-card-id="model"] .generation-progress-labels');
  await expect(labels).toContainText("2:59");
  await page.clock.fastForward(2000);
  await expect(labels).toContainText("3:01");
  await page.clock.fastForward(419000);
  await expect(labels).toContainText("10:00");
  completed = true;
  await page.clock.fastForward(1000);
  await expect(labels).toContainText("Complete");
  await page.clock.fastForward(60000);
  await expect(labels).toContainText("10:00");
});

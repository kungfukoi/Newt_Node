import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { openFixture } from "./helpers.mjs";

// Supply a local, sanitized workflow snapshot to reproduce a particular graph.
// All APIs/media are still intercepted by openFixture; no provider is contacted.
test("navigation style work stays independent of node contents", async ({ page }, testInfo) => {
  if (process.env.NEWTNODE_BENCHMARK_SHADOWS) await page.addInitScript(value => localStorage.setItem("newt.canvasShadows", value), process.env.NEWTNODE_BENCHMARK_SHADOWS);
  const fixture = process.env.NEWTNODE_BENCHMARK_GRAPH
    ? JSON.parse(await readFile(process.env.NEWTNODE_BENCHMARK_GRAPH, "utf8")) : undefined;
  const { errors } = await openFixture(page, { fixture, count: 271, scale: 0.3 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Performance.enable");
  await page.waitForTimeout(1500);
  const measure = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map(({ name, value }) => [name, value]));
  const before = await measure();
  const sample = await page.evaluate(async () => {
    const canvas = document.querySelector(".node-canvas");
    const rect = canvas.getBoundingClientRect();
    const target = document.querySelector(".react-flow__pane");
    const viewport = document.querySelector(".react-flow__viewport");
    const initialTransform = viewport.style.transform;
    const intervals = [];
    let previous;
    for (let i = 0; i < 120; i++) {
      const now = await new Promise(requestAnimationFrame);
      if (previous !== undefined) intervals.push(now - previous);
      previous = now;
      target.dispatchEvent(new WheelEvent("wheel", { bubbles: true, cancelable: true,
        clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2,
        deltaX: i < 60 ? 8 : 0, deltaY: i < 60 ? 3 : (Math.floor(i / 10) % 2 ? -35 : 35), ctrlKey: i >= 60 }));
    }
    intervals.sort((a, b) => a - b);
    return { frames: intervals.length, medianMs: intervals[Math.floor(intervals.length / 2)], p95Ms: intervals[Math.floor(intervals.length * 0.95)], moved: viewport.style.transform !== initialTransform };
  });
  const after = await measure();
  const metrics = Object.fromEntries(["RecalcStyleDuration", "LayoutDuration", "TaskDuration", "ScriptDuration", "RecalcStyleCount"].map(name => [name, after[name] - before[name]]));
  const report = { nodes: await page.locator(".react-flow__node").count(), shadows: await page.locator(".node-canvas").evaluate(canvas => !canvas.classList.contains("canvas-shadows-off")), cpuThrottle: 4, ...sample, ...metrics };
  console.log("Navigation benchmark:", JSON.stringify(report));
  await testInfo.attach("navigation-metrics", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  expect(sample.moved).toBe(true);
  // A timing-independent regression: grid navigation must not inherit per-frame
  // custom properties through every node and its complete UI subtree.
  if (!process.env.NEWTNODE_BENCHMARK_BASELINE) {
    await expect(page.locator(".node-canvas")).not.toHaveAttribute("style", /--(?:grid-|viewport-transform)/);
    await expect(page.locator(".canvas-grid")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => {
      const transform = new DOMMatrix(getComputedStyle(document.querySelector(".react-flow__viewport")).transform);
      const grid = getComputedStyle(document.querySelector(".canvas-grid"));
      const size = transform.a * 28;
      const modulo = value => ((value % size) + size) % size;
      return Math.abs(parseFloat(grid.backgroundSize) - size) < 0.01
        && Math.abs(parseFloat(grid.backgroundPositionX) - modulo(transform.e)) < 0.01
        && Math.abs(parseFloat(grid.backgroundPositionY) - modulo(transform.f)) < 0.01;
    })).toBe(true);
  }
  expect(errors).toEqual([]);
});

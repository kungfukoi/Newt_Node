import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";
import { catalogNodeTypeDefinitions } from "../src/nodeRegistry.js";

for (const viewport of [{ width: 2040, height: 1200 }, { width: 1700, height: 1000 }, { width: 1536, height: 864 }, { width: 1366, height: 700 }, { width: 1280, height: 600 }]) {
  test(`all palette nodes fit at ${viewport.width} × ${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const { errors } = await openFixture(page, { count: 1 });
    await page.getByTitle("Show node palette", { exact: true }).click();
    const toolbar = page.locator(".node-toolbar");
    await expect(toolbar).toBeVisible();
    await expect(toolbar.locator(".node-catalog > button")).toHaveCount(catalogNodeTypeDefinitions.length);
    const bounds = await toolbar.evaluate(el => {
      const panel = el.getBoundingClientRect();
      const buttons = [...el.querySelectorAll('.node-catalog > button')].map(button => button.getBoundingClientRect());
      return { overflow: el.scrollHeight - el.clientHeight, panelBottom: panel.bottom, buttonsFit: buttons.every(rect => rect.top >= panel.top && rect.bottom <= panel.bottom + 1 && rect.height >= 18), pageOverflow: document.documentElement.scrollHeight - innerHeight };
    });
    expect(bounds.overflow).toBeLessThanOrEqual(1);
    expect(bounds.panelBottom).toBeLessThanOrEqual(viewport.height);
    expect(bounds.buttonsFit).toBe(true);
    expect(bounds.pageOverflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath("palette-fit.png") });
    await toolbar.getByTitle("Add Utility", { exact: true }).click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2);
    expect(errors).toEqual([]);
  });
}

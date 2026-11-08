import { expect, test } from "@playwright/test";
import { chooseLookbookSource, openFixture } from "./helpers.mjs";

test("Lookbook shuttle varies speed, stays the same size through paging, and stops on release", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 1 });
  const pageSize = 14;
  const looks = Array.from({ length: pageSize * 2 }, (_, index) => ({
    id: `shuttle-look-${index}`, name: `Look ${index + 1}`, examples: [],
  }));
  let releasePage;
  const nextPage = new Promise(resolve => { releasePage = resolve; });
  await page.route("**/api/style-library", route => route.fulfill({ json: { revision: 0, collections: [] } }));
  await page.route("**/api/style-library/catalog?**", async route => {
    const params = new URL(route.request().url()).searchParams;
    const offset = Number(params.get("offset"));
    if (offset) await nextPage;
    const matching = params.get("q") ? looks.slice(0, 1) : looks;
    await route.fulfill({ json: { ready: true, total: matching.length, styles: matching.slice(offset, offset + pageSize) } });
  });

  await page.getByRole("button", { name: "Looks", exact: true }).click();
  await chooseLookbookSource(page, "Commercial");
  const strip = page.getByLabel("Style previews", { exact: true });
  const shuttle = page.getByRole("button", { name: "Preview scroll shuttle" });
  await expect(shuttle).toBeEnabled();
  await shuttle.scrollIntoViewIfNeeded();
  const box = await shuttle.boundingBox();
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const scrollLeft = () => strip.evaluate(element => element.scrollLeft);
  const sampleMovement = () => strip.evaluate(element => new Promise(resolve => {
    const start = performance.now();
    const left = element.scrollLeft;
    function sample(time) {
      if (time - start < 180) requestAnimationFrame(sample);
      else resolve(element.scrollLeft - left);
    }
    requestAnimationFrame(sample);
  }));
  const pull = async distance => {
    await page.mouse.move(center.x, center.y);
    await page.mouse.down();
    await page.mouse.move(center.x + distance, center.y);
  };

  try {
    await pull(22);
    const slow = await sampleMovement();
    expect(slow).toBeGreaterThan(10);
    await page.mouse.move(center.x + 130, center.y);
    expect(await sampleMovement()).toBeGreaterThan(slow * 3);

    // Hold through a delayed response to cover reaching the old end before the next page arrives.
    const firstEnd = await strip.evaluate(element => element.scrollWidth - element.clientWidth);
    await expect.poll(scrollLeft).toBe(firstEnd);
    await expect(page.getByRole("status").filter({ hasText: "Loading looks" })).toBeVisible();
    releasePage();
    await expect(strip.locator(".stylebuilder-tile")).toHaveCount(looks.length);
    await expect.poll(scrollLeft).toBeGreaterThan(firstEnd);
    expect((await shuttle.boundingBox()).width).toBe(box.width);

    await page.mouse.up();
    await expect.poll(async () => (await shuttle.boundingBox()).x).toBe(box.x);
    expect(await sampleMovement()).toBe(0);

    await pull(-65);
    expect(await sampleMovement()).toBeLessThan(-10);
    await page.mouse.up();
    const beforeKey = await scrollLeft();
    await shuttle.press("ArrowLeft");
    expect(await scrollLeft()).toBeLessThan(beforeKey);

    await strip.hover();
    const beforeWheel = await scrollLeft();
    await page.mouse.wheel(-180, 0);
    await expect.poll(scrollLeft).toBeLessThan(beforeWheel);
    await page.getByRole("textbox", { name: "Search looks" }).fill("narrow");
    await expect(strip.locator(".stylebuilder-tile")).toHaveCount(1);
    await expect(shuttle).toBeDisabled();
    expect(errors).toEqual([]);
  } finally {
    releasePage();
  }
});

import { expect, test } from "@playwright/test";
import { canvasFixture } from "./fixtures.mjs";
import { openFixture } from "./helpers.mjs";

test("Timeline Shift-click and marquee select clips across tracks", async ({ page }) => {
  const fixture = canvasFixture({ timeline: true, scale: 0.7 });
  const { assembly } = fixture.nodes.find(node => node.id === "timeline").data;
  const clip = assembly.tracks[0].clips[0];
  assembly.tracks[0].clips.push({ ...clip, id: "third", start: 4 });
  assembly.tracks.push({ id: "v2", type: "video", clips: [{ ...clip, id: "second" }] });
  const { errors } = await openFixture(page, { fixture });
  const node = page.locator('[data-node-card-id="timeline"]');
  const first = node.locator('[data-clip-id="clip"]');
  const second = node.locator('[data-clip-id="second"]');
  const third = node.locator('[data-clip-id="third"]');
  const selection = node.locator('.assembly-clip.selected');

  await first.click();
  await expect(first).toHaveClass(/\bselected\b/);
  await second.click({ modifiers: ['Shift'] });
  await expect(selection).toHaveCount(2);
  await first.click({ modifiers: ['Shift'] });
  await expect(selection).toHaveCount(1);
  await expect(second).toHaveClass(/\bselected\b/);

  const a = await first.boundingBox();
  const b = await second.boundingBox();
  const drag = async (shift = false) => {
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.move(a.x + a.width + 18, a.y + 5);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 });
    await expect(node.locator('.assembly-selection-marquee')).toBeVisible();
    await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
  };
  await third.click();
  await drag(true);
  await expect(selection).toHaveCount(3);
  await drag();
  await expect(selection).toHaveCount(2);
  await expect(third).not.toHaveClass(/\bselected\b/);
  await page.keyboard.press('Delete');
  await expect(node.locator('.assembly-clip')).toHaveCount(1);
  await node.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(node.locator('.assembly-clip')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test("Timeline clip dragging snaps to the playhead and trim handles follow the pointer at canvas zoom", async ({ page }) => {
  const { errors } = await openFixture(page, { timeline: true, scale: 0.7 });
  const node = page.locator('[data-node-card-id="timeline"]');
  const clip = node.locator('[data-clip-id="clip"]');
  const ruler = node.locator('.assembly-ruler');
  const rulerBox = await ruler.boundingBox();
  const pps = await ruler.evaluate(element => 72 * element.getBoundingClientRect().width / element.offsetWidth);
  await page.mouse.click(rulerBox.x + 3.5 * pps, rulerBox.y + rulerBox.height / 2);
  await expect(node.getByLabel('Timeline frame number')).toHaveText('Frame 84');

  const move = async seconds => {
    const box = await clip.boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + seconds * pps, y, { steps: 8 });
    await page.mouse.up();
  };
  await move(3.4);
  await expect(clip).toHaveCSS('left', '252px');
  await move(-1.9);
  await expect(clip).toHaveCSS('left', '108px');

  const trim = async (name, delta) => {
    const grip = await clip.getByRole('button', { name }).boundingBox();
    expect(grip.width).toBeGreaterThan(10);
    const x = grip.x + grip.width / 2;
    const y = grip.y + grip.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + delta * pps, y, { steps: 5 });
    await page.mouse.up();
  };
  await trim('Trim clip start', 0.25);
  await expect(clip).toHaveCSS('left', '126px');
  await expect(clip).toHaveCSS('width', '126px');
  await trim('Trim clip end', -0.25);
  await expect(clip).toHaveCSS('width', '108px');
  expect(errors).toEqual([]);
});

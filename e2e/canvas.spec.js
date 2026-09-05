import { test, expect } from "@playwright/test";
import { openFixture, wireGeometry, wireAttachmentErrors } from "./helpers.mjs";

test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const state = await page.evaluate(() => ({
    media: [...document.querySelectorAll("video, [data-node-card-id='viewer'] img")].map((element) => ({ tag: element.tagName, src: element.src.slice(0, 100), time: element.currentTime, ready: element.readyState, duration: element.duration, error: element.error?.message, width: element.naturalWidth, seeking: element.seeking })),
    canvas: [...document.querySelectorAll("canvas")].map((element) => ({ width: element.width, height: element.height, center: [...element.getContext("2d").getImageData(element.width / 2, element.height / 2, 1, 1).data] })),
    timeline: JSON.parse(localStorage.getItem("seedance-node-editor-draft-v1"))?.nodes?.find((node) => node.id === "timeline")?.data?.assembly,
  }));
  console.log(JSON.stringify(state));
  await info.attach("failed-media-state", { body: JSON.stringify(state), contentType: "application/json" });
});

for (const scale of [0.05, 0.08, 0.15, 0.3, 1]) {
  test(`271 full-detail nodes retain wires during pan and zoom at ${scale * 100}%`, async ({ page }, testInfo) => {
    const { errors, fixture } = await openFixture(page, { scale });
    await expect(page.locator(".newt-flow-edge-visible")).toHaveCount(fixture.edges.length);
    await expect.poll(async () => (await wireAttachmentErrors(page, fixture.edges)).every((edge) => !edge.missing && edge.start < 2 && edge.end < 2)).toBeTruthy();
    const before = await wireGeometry(page);
    expect(before.every((wire) => wire.length > 0 && Number.isFinite(wire.start.x))).toBeTruthy();
    const panPoint = await page.evaluate(() => [[1350, 850], [1480, 1000], [1200, 1000], [1500, 200], [30, 900]].find(([x, y]) => document.elementFromPoint(x, y)?.classList.contains("react-flow__pane")));
    expect(panPoint).toBeTruthy();
    const transform = () => page.locator(".react-flow__viewport").evaluate((element) => getComputedStyle(element).transform);
    const initialTransform = await transform();
    await page.mouse.move(...panPoint);
    await page.mouse.down();
    await page.mouse.move(panPoint[0] - 100, panPoint[1] - 40, { steps: 12 });
    await page.mouse.up();
    await expect.poll(transform).not.toBe(initialTransform);
    await page.mouse.wheel(0, -100);
    await page.mouse.wheel(0, 100);
    await expect(page.locator(".react-flow__node")).toHaveCount(271);
    await expect(page.locator(".newt-flow-edge-visible")).toHaveCount(fixture.edges.length);
    await expect.poll(async () => (await wireAttachmentErrors(page, fixture.edges)).every((edge) => !edge.missing && edge.start < 2 && edge.end < 2)).toBeTruthy();
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`canvas-${scale}.png`) });
  });
}

test("groups resize from every corner while the opposite corner stays anchored", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 2, scale: 0.8, group: true });
  const group = page.locator(".node-group-backdrop");
  await expect(group.locator(".group-resize-handle")).toHaveCount(4);
  const nodeBefore = await page.locator('[data-node-card-id="fixture-0"]').boundingBox();

  async function dragCorner(corner, deltaX, deltaY, fixedEdges) {
    const before = await group.boundingBox();
    const handle = await group.locator(`.group-resize-handle-${corner}`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2 + deltaX, handle.y + handle.height / 2 + deltaY, { steps: 8 });
    await page.mouse.up();
    const after = await group.boundingBox();
    for (const edge of fixedEdges) {
      const value = edge === "right" ? (box) => box.x + box.width : edge === "bottom" ? (box) => box.y + box.height : (box) => box[edge === "left" ? "x" : "y"];
      expect(value(after)).toBeCloseTo(value(before), 0);
    }
    expect(Math.abs(after.width - before.width) + Math.abs(after.height - before.height)).toBeGreaterThan(30);
  }

  await dragCorner("top-left", 40, 30, ["right", "bottom"]);
  await dragCorner("top-right", -40, 30, ["left", "bottom"]);
  await dragCorner("bottom-right", 40, 30, ["left", "top"]);
  await dragCorner("bottom-left", 40, -30, ["right", "top"]);

  const nodeAfter = await page.locator('[data-node-card-id="fixture-0"]').boundingBox();
  expect(nodeAfter.x).toBeCloseTo(nodeBefore.x, 0);
  expect(nodeAfter.y).toBeCloseTo(nodeBefore.y, 0);
  expect(errors).toEqual([]);
});

test("rail uses proportional still posters, retains items after refresh, and loads older generations", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 12, scale: 0.3 });
  await page.getByTitle("Show project outputs", { exact: true }).click();
  const rail = page.locator(".project-output-drawer");
  await expect(rail.locator(".project-output-thumb")).toHaveCount(102);
  await expect(rail.locator("video")).toHaveCount(0);
  const handle = await page.getByRole("separator", { name: "Resize project output previews" }).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + 30);
  await page.mouse.down(); await page.mouse.move(handle.x - 350, handle.y + 30, { steps: 12 }); await page.mouse.up();
  const image = rail.locator("img").first();
  await expect(image).toBeVisible();
  const box = await image.boundingBox();
  expect(box.width).toBeGreaterThan(250);
  expect(Math.abs(box.width / box.height - 640 / 360)).toBeLessThan(0.05);
  await rail.locator(".project-output-list").evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await expect(rail.locator(".project-output-thumb")).toHaveCount(202);
  await rail.getByRole("button", { name: /Refresh/ }).click();
  await expect(rail.locator(".project-output-thumb")).toHaveCount(202);
  expect(errors).toEqual([]);
});

test("uncertain recovery is inline, requires confirmation and never submits another generation", async ({ page }) => {
  const { errors, requests } = await openFixture(page, { attention: true, scale: 0.8 });
  const recovery = page.locator(".remote-video-attention");
  await recovery.locator("summary").click();
  await expect(recovery.getByRole("link", { name: "Open Fal" })).toHaveAttribute("href", "https://fal.ai/dashboard/requests");
  const dismiss = recovery.getByRole("button", { name: "Dismiss local tracking" });
  await expect(dismiss).toBeDisabled();
  await recovery.getByRole("checkbox").check();
  await dismiss.click();
  await expect(recovery).toHaveCount(0);
  expect(requests.some((request) => request.path === "/api/node/generate-video")).toBe(false);
  expect(errors).toEqual([]);
});

test("diagnostics are opt-in and export a local support snapshot", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 1, scale: 0.6 });
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Diagnostics", exact: true }).click();
  const checkbox = page.getByRole("checkbox", { name: "Collect diagnostics (10 minutes)" });
  await expect(checkbox).not.toBeChecked();
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export diagnostics", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("newtnode-diagnostics.json");
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
  expect(errors).toEqual([]);
});

test("text editing, live resize, multi-selection and repeated paste preserve the canvas", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 4, scale: 0.6 });
  const card = page.locator('[data-node-card-id="fixture-0"]');
  const input = card.getByRole("textbox", { name: "Text prompt", exact: true });
  const position = await card.boundingBox();
  await input.click();
  await input.press("ControlOrMeta+a");
  await input.press("ArrowLeft");
  await input.press("Shift+ArrowRight");
  expect(await input.evaluate((element) => element.selectionEnd - element.selectionStart)).toBe(1);
  await input.fill("Browser regression edit");
  const unchanged = await card.boundingBox();
  expect(unchanged.x).toBeCloseTo(position.x, 0);
  expect(unchanged.y).toBeCloseTo(position.y, 0);
  const beforeField = await input.boundingBox();
  const handle = await card.getByRole("button", { name: "Resize node", exact: true }).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 90, handle.y + 80, { steps: 10 });
  const during = await card.boundingBox();
  expect(during.width).toBeGreaterThan(position.width + 50);
  expect(during.height).toBeGreaterThan(position.height + 40);
  await page.mouse.up();
  expect((await input.boundingBox()).height).toBeGreaterThan(beforeField.height);
  await card.locator(".node-title").click();
  await page.locator('[data-node-card-id="fixture-1"] .node-title').click({ modifiers: ["Shift"] });
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  await page.keyboard.press("ControlOrMeta+v");
  await expect(page.locator(".react-flow__node")).toHaveCount(8);
  expect(errors).toEqual([]);
});

test("marquee selects intersected nodes and releases cleanly before copy", async ({ page }) => {
  const { errors } = await openFixture(page, { count: 4, scale: 0.6 });
  const first = await page.locator('[data-node-card-id="fixture-0"]').boundingBox();
  const second = await page.locator('[data-node-card-id="fixture-1"]').boundingBox();
  await page.keyboard.down("Shift");
  const start = { x: first.x - 12, y: Math.max(first.y + first.height, second.y + second.height) + 12 };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.classList.contains("react-flow__pane"), start)).toBe(true);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(second.x + second.width + 12, first.y - 12, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);
  await expect(page.locator(".react-flow__selection")).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(page.locator(".react-flow__node")).toHaveCount(6);
  expect(errors).toEqual([]);
});

test("Timeline scrubbing updates a nonblack connected preview", async ({ page }, testInfo) => {
  const { errors } = await openFixture(page, { timeline: true, scale: 0.7 });
  const viewer = page.locator('[data-node-card-id="viewer"]');
  const image = viewer.locator("img").first();
  await expect(image).toBeVisible();
  const pixels = () => image.evaluate((element) => {
    if (!element.complete || !element.naturalWidth) return 0;
    const canvas = document.createElement("canvas");
    canvas.width = element.naturalWidth; canvas.height = element.naturalHeight;
    const context = canvas.getContext("2d");
    context.drawImage(element, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += data[i] + data[i + 1] + data[i + 2];
      hash = Math.imul(hash ^ (data[i] + 256 * data[i + 1] + 65536 * data[i + 2]), 16777619);
    }
    return sum > 1000 ? hash >>> 0 : 0;
  });
  await expect.poll(pixels).toBeGreaterThan(1000);
  const original = await pixels();
  const ruler = await page.locator(".assembly-ruler").boundingBox();
  await page.mouse.click(ruler.x + 72 * 0.7, ruler.y + ruler.height / 2);
  await expect.poll(() => page.getByRole("slider", { name: "Timeline playhead" }).getAttribute("aria-valuenow")).not.toBe("0");
  await testInfo.attach("media-state", { contentType: "application/json", body: JSON.stringify(await page.evaluate(() => ({
    videos: [...document.querySelectorAll("video")].map((video) => ({ time: video.currentTime, duration: video.duration, ready: video.readyState, seeking: video.seeking, error: video.error?.message })),
    images: [...document.querySelectorAll('[data-node-card-id="viewer"] img')].map((image) => ({ src: image.src.slice(0, 120), width: image.naturalWidth })),
  }))) });
  await expect.poll(pixels).not.toBe(original);
  expect(await pixels()).toBeGreaterThan(1000);
  await page.locator('[data-node-card-id="timeline"]').getByTitle("Set Out point", { exact: true }).click();
  expect(await pixels()).toBeGreaterThan(1000);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("timeline-preview.png") });
});

test("generated images propagate without a nudge, stay contained on resize, and survive Save As/reload", async ({ page }) => {
  const { errors, requests } = await openFixture(page, { generation: true, scale: 0.8 });
  await page.getByRole("button", { name: "Run Image", exact: true }).click();
  const viewer = page.locator('[data-node-card-id="viewer"]');
  const image = viewer.locator("img").first();
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((element) => element.naturalWidth)).toBe(640);
  expect(requests.filter((request) => request.path === "/api/node/generate-image")).toHaveLength(1);
  const handle = await viewer.getByRole("button", { name: "Resize node", exact: true }).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down(); await page.mouse.move(handle.x - 80, handle.y - 100, { steps: 12 }); await page.mouse.up();
  const geometry = await image.evaluate((element) => {
    const image = element.getBoundingClientRect(); const node = element.closest(".node-card").getBoundingClientRect();
    return { fit: getComputedStyle(element).objectFit, width: image.width, height: image.height, inside: image.left >= node.left && image.right <= node.right + 1 && image.bottom <= node.bottom + 1 };
  });
  expect(geometry.fit).toBe("contain"); expect(geometry.inside).toBeTruthy();
  await page.getByTitle("Show node palette", { exact: true }).click();
  await page.getByTitle("File", { exact: true }).click();
  await page.getByRole("button", { name: "Save As", exact: true }).click();
  await expect.poll(() => requests.some((request) => request.path === "/api/saved-workflows" && request.method === "POST")).toBeTruthy();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("seedance-node-editor-draft-v1"))?.projectId)).toBe("fixture-clone");
  await page.reload();
  await page.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator('[data-node-card-id="viewer"] img').first()).toBeVisible();
  expect(errors).toEqual([]);
});

import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

test("Boxes modes, transforms, undo, reference upload and preferred-model submission", async ({ page }, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem("seedance-node-editor-draft-v1", JSON.stringify({
    nodes: [{ id: "edit-source", type: "image", x: 30, y: 30, data: { title: "Edit source", resultUrl: "/outputs/e2e/landscape.png", fileName: "landscape.png", status: "complete" } }],
    edges: [], groups: [], viewport: { x: 20, y: 20, scale: .8 }
  })));
  const { errors } = await openFixture(page, { count: 1, settings: { falKeyConfigured: true, userPreferences: { imageEditorModel: "OpenAI Image 2.5 Flare" } } });
  await page.locator('[data-node-card-id="edit-source"] img').first().dblclick();
  await page.getByRole("button", { name: "Draw and edit with OpenAI Image 2.5 Flare", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Image Edit", exact: true });
  await editor.getByRole("button", { name: "Boxes", exact: true }).click();
  const surface = await editor.locator(".ies-surface").boundingBox();
  const move = (x, y) => page.mouse.move(surface.x + surface.width * x, surface.y + surface.height * y);
  await move(.2, .2); await page.mouse.down(); await move(.4, .4); await page.mouse.up();
  await editor.getByLabel("Rename box 1", { exact: true }).dblclick();
  await editor.getByLabel("Canvas box description").fill("Cat");
  await editor.getByLabel("Canvas box description").press("Enter");
  await expect(editor.getByLabel("Box description", { exact: true })).toHaveValue("Cat");
  await editor.getByLabel("Rename box 1", { exact: true }).dblclick();
  await editor.getByLabel("Canvas box description").fill("Discarded name");
  await editor.getByLabel("Canvas box description").press("Escape");
  await expect(editor.getByLabel("Box description", { exact: true })).toHaveValue("Cat");
  const corner = editor.locator(".ies-box-corner").first(), hit = editor.locator(".ies-box-scale-hit").first();
  expect(Number(await corner.getAttribute("r"))).toBe(Number(await hit.getAttribute("r")) / 4);
  await expect(editor.getByLabel("Shadow / lighting area", { exact: true })).toHaveValue("35");
  await editor.getByLabel("Shadow / lighting area", { exact: true }).fill("60");
  await editor.getByLabel("Translate X (%)", { exact: true }).fill("60");
  await editor.getByLabel("Rotation (°)", { exact: true }).fill("35");
  await editor.getByRole("button", { name: "Undo stroke" }).click();
  await expect(editor.getByLabel("Rotation (°)")).toHaveValue("0");
  await editor.getByRole("button", { name: "Redo stroke" }).click();
  await expect(editor.getByLabel("Rotation (°)")).toHaveValue("35");
  await expect(editor.getByLabel("Edit method")).toBeDisabled();
  const target = editor.locator(".ies-box-target");
  const before = await target.getAttribute("points");
  const handle = await editor.getByLabel("Scale box 1", { exact: true }).last().boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down();
  await page.mouse.move(handle.x - 20, handle.y + 20); await page.mouse.up();
  await expect(target).not.toHaveAttribute("points", before);
  const rotation = await editor.getByLabel("Rotate box 1", { exact: true }).boundingBox();
  await page.mouse.move(rotation.x + rotation.width / 2, rotation.y + rotation.height / 2); await page.mouse.down();
  await page.mouse.move(rotation.x + 25, rotation.y + 15); await page.mouse.up();
  await expect(editor.getByLabel("Rotation (°)")).not.toHaveValue("35");
  for (const mode of ["new", "keep", "remove", "text", "reference", "move"]) {
    await editor.getByLabel("Box mode", { exact: true }).selectOption(mode);
    if (mode === "text") await editor.getByLabel("Box text", { exact: true }).fill("Hello world");
    if (mode === "reference") {
      await page.route("**/api/node/upload-asset", route => route.fulfill({ json: { asset: { localUrl: "/outputs/e2e/reference.png", fileName: "reference.png" } } }));
      await editor.getByLabel("Box reference image").setInputFiles({ name: "reference.png", mimeType: "image/png", buffer: Buffer.from("fixture") });
      await expect(editor.getByAltText("Box reference", { exact: true })).toBeVisible();
    }
  }
  await editor.getByLabel("Translate X (%)", { exact: true }).fill("65");
  await editor.getByLabel("Rotation (°)", { exact: true }).fill("25");
  await editor.getByRole("button", { name: "Zoom in", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("boxes.png") });
  let form, edits = 0;
  await page.route("**/api/node/edit-image", async route => {
    edits++;
    if (edits === 1) { await route.fulfill({ status: 503, json: { error: "Temporary edit failure" } }); return; }
    const request = route.request();
    form = await new Response(request.postDataBuffer(), { headers: { "content-type": request.headers()["content-type"] } }).formData();
    await route.fulfill({ json: { item: { url: "/outputs/e2e/edited.png", fileName: "edited.png", type: "image" } } });
  });
  await editor.getByLabel("Box description", { exact: true }).fill("");
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect(editor.getByRole("alert")).toBeInViewport();
  await expect(editor.getByRole("alert")).toContainText("Describe each boxed object");
  expect(form).toBeUndefined();
  await editor.getByLabel("Box description", { exact: true }).fill("Cat");
  await page.route("**/api/node/image-objects", route => route.fulfill({ json: { masks: [] } }));
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText('No object matched "Cat"');
  expect(form).toBeUndefined();
  let selections = 0;
  await page.route("**/api/node/image-objects", route => { selections++; expect(route.request().postDataJSON().prompt).toBe("Cat"); return route.fulfill({ json: { masks: [{ width: 10, height: 10, runs: [22, 2, 32, 2], area: 4 }] } }); });
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect(editor.getByRole("alert")).toContainText("Temporary edit failure");
  await expect(editor.getByText("Object selected. Check", { exact: false })).toBeVisible();
  expect(selections).toBe(1);
  await editor.getByRole("button", { name: "Generate Edit", exact: true }).click();
  await expect.poll(() => Boolean(form)).toBe(true);
  expect(selections).toBe(1);
  expect(form.get("model")).toBe("OpenAI Image 2.5 Flare");
  expect(form.get("boxObjects")).toBeTruthy();
  const [box] = JSON.parse(form.get("boxes"));
  expect(box.contextPadding).toBe(.6); expect(box.label).toBe("Cat"); expect(box.mode).toBe("move");
  expect(box.target.x).toBe(.65); expect(box.target.rotation).toBe(25);
  expect(box.source.x).toBeCloseTo(.3, 2);
  const divider = editor.getByRole("slider", { name: "Compare divider", exact: true });
  await expect(divider).toBeVisible();
  const imageRect = await editor.locator(".ies-surface").boundingBox();
  const transform = await editor.locator(".ies-surface").evaluate(el => el.style.transform);
  const grip = await divider.boundingBox();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
  await page.mouse.move(imageRect.x + imageRect.width * .8, imageRect.y + imageRect.height * .5); await page.mouse.up();
  await expect(divider).toHaveAttribute("aria-valuenow", "80");
  expect(Number(await editor.getByLabel("Comparison split", { exact: true }).inputValue())).toBeCloseTo(80, 0);
  expect(await editor.locator(".ies-surface").evaluate(el => el.style.transform)).toBe(transform);
  await editor.getByLabel("Comparison split", { exact: true }).focus();
  await page.keyboard.press("Home"); await page.keyboard.press("ArrowRight");
  await expect(divider).toHaveAttribute("aria-valuenow", "1");
  await divider.focus(); await page.keyboard.press("End");
  await expect(divider).toHaveAttribute("aria-valuenow", "100");
  await page.keyboard.press("Home");
  await expect(divider).toHaveAttribute("aria-valuenow", "0");
  expect(errors).toEqual([]);
});

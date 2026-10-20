import { test, expect } from "@playwright/test";
import { openFixture } from "./helpers.mjs";

for (const [kind, options] of [["image", { generation: true }], ["video", { videoProgress: true }]]) {
  test(`${kind} model prompt preserves spaces while typing`, async ({ page }) => {
    const { errors } = await openFixture(page, { ...options, scale: 1 });
    const prompt = page.locator('[data-node-card-id="model"] .tagged-prompt-editor textarea').first();
    await prompt.fill("");
    await prompt.pressSequentially("a ");
    await expect(prompt).toHaveValue("a ");
    await prompt.pressSequentially(" red  fox");
    await expect(prompt).toHaveValue("a  red  fox");
    expect(errors).toEqual([]);
  });
}

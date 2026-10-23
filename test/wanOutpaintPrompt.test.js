import test from "node:test";
import assert from "node:assert/strict";
import { wanOutpaintPrompt, wanOutpaintNegativePrompt } from "../src/wanOutpaintPrompt.js";
import { outpaintFrameOneRule } from "../src/outpaintFrameOne.js";

test("Wan wrapper names actual expanded sides and keeps frame-one coverage for saved prompts", () => {
  const plan = { width: 720, height: 1280, top: 306, left: 0, sourceWidth: 720, sourceHeight: 664 };
  const prompt = wanOutpaintPrompt("Pale sky above @Video1, snowy ground matching @Image1.", plan);
  assert.match(prompt, /top and bottom outer regions/);
  assert.match(prompt, /already present from frame one/);
  assert.match(prompt, /Pale sky/);
  assert.doesNotMatch(prompt, /@Video|@Image/);
  assert.match(wanOutpaintPrompt("A room", { ...plan, top: 0, left: 60, sourceWidth: 660, sourceHeight: 1280 }), /the left outer regions/);
  assert.match(wanOutpaintNegativePrompt("extra people"), /black bars.*transition.*extra people/);
  assert.ok(prompt.endsWith(outpaintFrameOneRule));
  assert.match(prompt, /extension already complete at t=0/);
  assert.match(wanOutpaintNegativePrompt("extra people"), /animated bar removal, delayed extension/);
});


test("Wan guidance art-directs wardrobe in the fill without copying reference composition", () => {
  const prompt = wanOutpaintPrompt("Continue the sleeve.", { width: 720, height: 1280, top: 306, left: 0, sourceWidth: 720, sourceHeight: 664 }, 1);
  assert.match(prompt, /APPEARANCE REFERENCE ONLY, NOT COMPOSITION/);
  assert.match(prompt, /wardrobe, garment cut, fabric/);
  assert.match(prompt, /source video alone controls composition/);
  assert.doesNotMatch(prompt, /@Image/);
});

import test from "node:test";
import assert from "node:assert/strict";

import { replacementResultItems } from "../src/mediaResults.js";

test("replacement uploads replace downstream media with the new asset", () => {
  const resultItems = replacementResultItems({
    localUrl: "/workflow-assets/workflow/inputs/depth-5s.mp4",
    fileName: "DEPTH_5s.mp4",
    mimeType: "video/mp4",
    mediaType: "video"
  });

  assert.deepEqual(resultItems, [{
    url: "/workflow-assets/workflow/inputs/depth-5s.mp4",
    type: "video",
    label: "DEPTH_5s.mp4",
    fileName: "DEPTH_5s.mp4",
    mimeType: "video/mp4"
  }]);
});

test("replacement uploads do not retain a result without a local URL", () => {
  assert.deepEqual(replacementResultItems({ mediaType: "video" }), []);
});

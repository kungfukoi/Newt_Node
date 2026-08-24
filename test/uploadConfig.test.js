import assert from "node:assert/strict";
import test from "node:test";

import { isLocalVideoUpload, localVideoUploadLimits, standardUploadLimits } from "../server/upload-config.js";

test("local video imports have no byte-size ceiling", () => {
  assert.equal(Object.hasOwn(localVideoUploadLimits, "fileSize"), false);
  assert.equal(localVideoUploadLimits.files, 1);
  assert.equal(standardUploadLimits.fileSize, 200 * 1024 * 1024);
});

test("unlimited local imports accept only supported video files", () => {
  assert.equal(isLocalVideoUpload({ originalname: "source.mp4", mimetype: "video/mp4" }), true);
  assert.equal(isLocalVideoUpload({ originalname: "source.MOV", mimetype: "application/octet-stream" }), true);
  assert.equal(isLocalVideoUpload({ originalname: "source.webm", mimetype: "" }), true);
  assert.equal(isLocalVideoUpload({ originalname: "source.avi", mimetype: "video/avi" }), false);
  assert.equal(isLocalVideoUpload({ originalname: "source.png", mimetype: "image/png" }), false);
});

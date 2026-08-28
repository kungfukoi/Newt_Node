import assert from "node:assert/strict";
import test from "node:test";

import viteConfig from "../vite.config.js";

test("Vite keeps desktop controls on the dedicated control server", () => {
  for (const proxy of [viteConfig.server.proxy, viteConfig.preview.proxy]) {
    assert.equal(proxy["/api/system"], "http://127.0.0.1:3337");
    assert.equal(proxy["/api/saved-workflows"], "http://127.0.0.1:3337");
    assert.equal(proxy["/api"], "http://127.0.0.1:3336");
  }
});

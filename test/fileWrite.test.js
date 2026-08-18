import assert from "node:assert/strict";
import test from "node:test";

import {
  isTransientFileWriteError,
  retryTransientFileOperation
} from "../server/file-write.js";

test("transient Windows file locks are retried", async () => {
  let calls = 0;
  const delays = [];
  const result = await retryTransientFileOperation(() => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error("OneDrive is syncing"), { code: "EPERM" });
    return "written";
  }, {
    attempts: 4,
    initialDelayMs: 10,
    delayFn: async (milliseconds) => delays.push(milliseconds)
  });

  assert.equal(result, "written");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("permanent file errors are not retried", async () => {
  let calls = 0;
  await assert.rejects(
    retryTransientFileOperation(() => {
      calls += 1;
      throw Object.assign(new Error("missing directory"), { code: "ENOENT" });
    }, { delayFn: async () => {} }),
    { code: "ENOENT" }
  );

  assert.equal(calls, 1);
  assert.equal(isTransientFileWriteError({ code: "EBUSY" }), true);
  assert.equal(isTransientFileWriteError({ code: "ENOENT" }), false);
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  archiveInstallBranchStatus,
  defaultUpdateBranch,
  defaultUpdateRepository,
  githubArchiveUrl
} from "../server/runtime-update.js";

test("ZIP installs have a stable official update source", () => {
  assert.equal(defaultUpdateRepository, "https://github.com/kungfukoi/Newt_Node.git");
  assert.equal(defaultUpdateBranch, "main");
  assert.deepEqual(archiveInstallBranchStatus(), {
    state: "archive-install",
    label: "ZIP install",
    detail: "main · Ready to update"
  });
});

test("GitHub repositories map to bounded source archive URLs", () => {
  assert.equal(
    githubArchiveUrl("https://github.com/kungfukoi/Newt_Node.git", "main"),
    "https://codeload.github.com/kungfukoi/Newt_Node/zip/refs/heads/main"
  );
  assert.equal(
    githubArchiveUrl("https://www.github.com/example/fork/", "feature/zip updates"),
    "https://codeload.github.com/example/fork/zip/refs/heads/feature%2Fzip%20updates"
  );
});

test("archive fallback rejects non-GitHub and credential-bearing repositories", () => {
  assert.equal(githubArchiveUrl("https://example.com/example/fork.git", "main"), "");
  assert.equal(githubArchiveUrl("http://github.com/example/fork.git", "main"), "");
  assert.equal(githubArchiveUrl("https://token@github.com/example/fork.git", "main"), "");
  assert.equal(githubArchiveUrl("C:\\dev\\Newt_Node", "main"), "");
  assert.equal(githubArchiveUrl("https://github.com/example/fork/tree/main", "main"), "");
});

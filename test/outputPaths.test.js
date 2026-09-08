import assert from "node:assert/strict";
import test from "node:test";
import { rebaseOutputPathToProjectOutputs } from "../src/outputPaths.js";

test("Output paths from another Windows user rebase into the open project package", () => {
  assert.equal(
    rebaseOutputPathToProjectOutputs(
      "C:\\Users\\kungf\\OneDrive\\Projects\\SubwayStation\\outputs\\Selects",
      "C:\\Users\\user\\OneDrive\\Projects\\SubwayStation\\outputs"
    ),
    "C:\\Users\\user\\OneDrive\\Projects\\SubwayStation\\outputs\\Selects"
  );
});

test("Output paths rebase across operating systems", () => {
  assert.equal(
    rebaseOutputPathToProjectOutputs(
      "C:\\Users\\someone\\Projects\\ShowPackage\\outputs\\Seq01",
      "/Users/current/Projects/ShowPackage/outputs"
    ),
    "/Users/current/Projects/ShowPackage/outputs/Seq01"
  );
});

test("external custom Output paths are preserved", () => {
  assert.equal(
    rebaseOutputPathToProjectOutputs(
      "D:\\StudioRenders\\ClientA\\Selects",
      "C:\\Users\\user\\Projects\\ShowPackage\\outputs"
    ),
    "D:\\StudioRenders\\ClientA\\Selects"
  );
});

test("another project's Output path is preserved", () => {
  assert.equal(
    rebaseOutputPathToProjectOutputs(
      "D:\\Projects\\DifferentPackage\\outputs\\Selects",
      "C:\\Users\\user\\Projects\\ShowPackage\\outputs"
    ),
    "D:\\Projects\\DifferentPackage\\outputs\\Selects"
  );
});

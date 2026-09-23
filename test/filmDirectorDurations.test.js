import assert from "node:assert/strict";
import test from "node:test";

import {
  filmDirectorDurationOptionLabel,
  filmDirectorDurationOptions,
  filmDirectorIsStillDuration,
  filmDirectorShotCountForDuration,
  normalizeFilmDirectorDuration
} from "../src/filmDirectorDurations.js";

test("Film Director offers Still and every whole-second duration from 4 through 30 seconds", () => {
  assert.deepEqual(filmDirectorDurationOptions, [
    "still", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17",
    "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30"
  ]);
});

test("Film Director duration normalization preserves valid intermediate values", () => {
  assert.equal(normalizeFilmDirectorDuration("Still"), "still");
  assert.equal(normalizeFilmDirectorDuration("7 seconds"), "7");
  assert.equal(normalizeFilmDirectorDuration("19", "12"), "19");
  assert.equal(normalizeFilmDirectorDuration("29 seconds"), "29");
  assert.equal(normalizeFilmDirectorDuration("3", "12"), "12");
  assert.equal(normalizeFilmDirectorDuration("invalid"), "15");
});

test("Still duration is labeled clearly and always forces one shot", () => {
  assert.equal(filmDirectorDurationOptionLabel("still"), "Still");
  assert.equal(filmDirectorIsStillDuration("STILL"), true);
  assert.equal(filmDirectorShotCountForDuration("Auto", "still"), "1");
  assert.equal(filmDirectorShotCountForDuration("9", "still"), "1");
  assert.equal(filmDirectorShotCountForDuration("9", "12"), "9");
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateFluxVideoUpscaleCost,
  fluxVideoUpscaleBillingTier,
  fluxVideoUpscaleEndpoint,
  fluxVideoUpscaleMaximumBytes,
  fluxVideoUpscaleMaximumDurationSeconds,
  normalizeFluxVideoUpscaleCreativity,
  normalizeFluxVideoUpscaleFactor,
  normalizeFluxVideoUpscaleSafetyTolerance
} from "../src/fluxVideoUpscale.js";

test("Flux Video Upscale exposes the current Fal endpoint and provider limits", () => {
  assert.equal(fluxVideoUpscaleEndpoint, "blackforestlabs/flux-video-upscale");
  assert.equal(fluxVideoUpscaleMaximumDurationSeconds, 20);
  assert.equal(fluxVideoUpscaleMaximumBytes, 50 * 1024 * 1024);
});

test("Flux Video Upscale normalizes every API control", () => {
  assert.equal(normalizeFluxVideoUpscaleFactor(1), 1.5);
  assert.equal(normalizeFluxVideoUpscaleFactor(2.25), 2.25);
  assert.equal(normalizeFluxVideoUpscaleFactor(4), 3);
  assert.equal(normalizeFluxVideoUpscaleCreativity(0), 0);
  assert.equal(normalizeFluxVideoUpscaleCreativity("1"), 1);
  assert.equal(normalizeFluxVideoUpscaleSafetyTolerance(-1), 0);
  assert.equal(normalizeFluxVideoUpscaleSafetyTolerance(9), 4);
});

test("Flux Video Upscale resolves portrait and landscape billing tiers", () => {
  assert.equal(fluxVideoUpscaleBillingTier({ width: 1920, height: 1080 }), "1080p");
  assert.equal(fluxVideoUpscaleBillingTier({ width: 1080, height: 1920 }), "1080p");
  assert.equal(fluxVideoUpscaleBillingTier({ width: 2560, height: 1440 }), "2k");
  assert.equal(fluxVideoUpscaleBillingTier({ width: 3840, height: 2160 }), "4k");
  assert.equal(fluxVideoUpscaleBillingTier({}), "");
});

test("Flux Video Upscale estimates published 10-second prices from source dimensions", () => {
  const precise = estimateFluxVideoUpscaleCost({
    durationSeconds: 10,
    sourceWidth: 960,
    sourceHeight: 540,
    upscaleFactor: 2,
    creativity: 0
  });
  const creative = estimateFluxVideoUpscaleCost({
    durationSeconds: 10,
    sourceWidth: 960,
    sourceHeight: 540,
    upscaleFactor: 2,
    creativity: 1
  });

  assert.equal(precise.amountUsd, 1.4);
  assert.equal(precise.billingResolutionTier, "1080p");
  assert.equal(creative.amountUsd, 2);
  assert.equal(creative.mode, "creative");
});

test("Flux Video Upscale uses delivered dimensions when available", () => {
  const cost = estimateFluxVideoUpscaleCost({
    durationSeconds: 4,
    sourceWidth: 1920,
    sourceHeight: 1080,
    outputWidth: 2560,
    outputHeight: 1440,
    upscaleFactor: 2,
    creativity: 0
  });

  assert.equal(cost.billingResolutionTier, "2k");
  assert.equal(cost.amountUsd, 1);
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  estimateTopazSdrToHdrCost,
  normalizeTopazSdrToHdrOutputFormat,
  topazSdrToHdrBillingTier,
  topazSdrToHdrEndpoint,
  topazSdrToHdrMaximumDurationSeconds
} from "../src/topazSdrToHdr.js";

test("Topaz SDR to HDR exposes the current Fal endpoint and provider limit", () => {
  assert.equal(topazSdrToHdrEndpoint, "topaz/sdr-to-hdr/video");
  assert.equal(topazSdrToHdrMaximumDurationSeconds, 300);
});

test("Topaz SDR to HDR normalizes its two output formats", () => {
  assert.equal(normalizeTopazSdrToHdrOutputFormat("prores"), "prores");
  assert.equal(normalizeTopazSdrToHdrOutputFormat("MP4"), "mp4");
  assert.equal(normalizeTopazSdrToHdrOutputFormat("unexpected"), "mp4");
});

test("Topaz SDR to HDR resolves source-resolution billing tiers", () => {
  assert.equal(topazSdrToHdrBillingTier({ width: 1920, height: 1080 }), "up-to-1080p");
  assert.equal(topazSdrToHdrBillingTier({ width: 1080, height: 1920 }), "up-to-1080p");
  assert.equal(topazSdrToHdrBillingTier({ width: 3840, height: 2160 }), "4k");
  assert.equal(topazSdrToHdrBillingTier({}), "");
});

test("Topaz SDR to HDR estimates published 10-second prices", () => {
  const hd = estimateTopazSdrToHdrCost({ durationSeconds: 10, width: 1920, height: 1080 });
  const uhd = estimateTopazSdrToHdrCost({ durationSeconds: 10, width: 3840, height: 2160 });

  assert.equal(hd.amountUsd, 2.4);
  assert.equal(hd.unitRateUsd, 0.24);
  assert.equal(hd.billingResolutionTier, "up-to-1080p");
  assert.equal(uhd.amountUsd, 5.1);
  assert.equal(uhd.unitRateUsd, 0.51);
  assert.equal(uhd.billingResolutionTier, "4k");
});

test("Topaz SDR to HDR leaves cost unpriced without duration or dimensions", () => {
  assert.equal(estimateTopazSdrToHdrCost({ width: 1920, height: 1080 }).amountUsd, null);
  assert.equal(estimateTopazSdrToHdrCost({ durationSeconds: 10 }).amountUsd, null);
});

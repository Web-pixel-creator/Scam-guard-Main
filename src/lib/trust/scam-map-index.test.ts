import { describe, expect, it } from "vitest";

import {
  buildScamMapCategoryBuckets,
  getPrivacySafeScamMapIndex,
  isRegionBucketPublishable,
  SCAM_MAP_FORBIDDEN_PUBLIC_FIELDS,
  SCAM_MAP_PRIVACY_POLICY,
} from "./scam-map-index";
import { PUBLIC_SCHEME_TRENDS } from "./scheme-trends";

describe("privacy-safe scam map index", () => {
  it("builds category buckets from public non-personal scheme trends", () => {
    const buckets = buildScamMapCategoryBuckets();
    const bucketTrendCount = buckets.reduce((sum, bucket) => sum + bucket.trendCount, 0);

    expect(buckets.length).toBeGreaterThan(0);
    expect(bucketTrendCount).toBe(PUBLIC_SCHEME_TRENDS.length);
    expect(buckets.every((bucket) => bucket.trendIds.length === bucket.trendCount)).toBe(true);
  });

  it("publishes only the national layer and suppresses regional buckets by default", () => {
    const index = getPrivacySafeScamMapIndex();

    expect(index.summary.trendCount).toBe(PUBLIC_SCHEME_TRENDS.length);
    expect(index.summary.publicRegionBuckets).toBe(1);
    expect(index.summary.suppressedRegionBuckets).toBeGreaterThanOrEqual(1);
    expect(
      index.regionBuckets.filter((bucket) => bucket.published).map((bucket) => bucket.layer),
    ).toEqual(["national_index"]);
    expect(
      index.regionBuckets
        .filter((bucket) => !bucket.published)
        .every((bucket) => bucket.suppressionReason !== null),
    ).toBe(true);
  });

  it("requires all privacy thresholds before a future region bucket can publish", () => {
    expect(
      isRegionBucketPublishable({
        moderatedReports: SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion - 1,
        distinctSchemes: SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion,
        sourceTypes: SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion,
      }),
    ).toBe(false);

    expect(
      isRegionBucketPublishable({
        moderatedReports: SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion,
        distinctSchemes: SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion - 1,
        sourceTypes: SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion,
      }),
    ).toBe(false);

    expect(
      isRegionBucketPublishable({
        moderatedReports: SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion,
        distinctSchemes: SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion,
        sourceTypes: SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion - 1,
      }),
    ).toBe(false);

    expect(
      isRegionBucketPublishable({
        moderatedReports: SCAM_MAP_PRIVACY_POLICY.minModeratedReportsPerRegion,
        distinctSchemes: SCAM_MAP_PRIVACY_POLICY.minDistinctSchemesPerRegion,
        sourceTypes: SCAM_MAP_PRIVACY_POLICY.minSourceTypesPerRegion,
      }),
    ).toBe(true);
  });

  it("does not expose private evidence shaped fields in the public map payload", () => {
    const payload = JSON.stringify(getPrivacySafeScamMapIndex());

    for (const field of SCAM_MAP_FORBIDDEN_PUBLIC_FIELDS) {
      expect(payload).not.toMatch(new RegExp(`"${field}"\\s*:`));
    }
    expect(payload).not.toMatch(/\+998\d{9}/);
    expect(payload).not.toMatch(/https?:\/\/[^\s"]+/);
  });
});

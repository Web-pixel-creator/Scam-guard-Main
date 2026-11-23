import { describe, expect, it } from "vitest";
import {
  MEDIA_PROVIDER_CONSENT_CANCEL_CALLBACK,
  MEDIA_PROVIDER_CONSENT_TTL_MS,
  isMediaProviderReportFlowId,
  mediaProviderConsentCallback,
  parseMediaProviderConsentCallback,
} from "./media-provider-consent";

describe("media provider consent", () => {
  it("parses only exact allow/cancel callback values", () => {
    expect(parseMediaProviderConsentCallback(mediaProviderConsentCallback("image"))).toEqual({
      action: "allow",
      kind: "image",
    });
    expect(parseMediaProviderConsentCallback(MEDIA_PROVIDER_CONSENT_CANCEL_CALLBACK)).toEqual({
      action: "cancel",
    });
    expect(parseMediaProviderConsentCallback("media_consent:image:extra")).toBeNull();
    expect(parseMediaProviderConsentCallback("media_consent:video")).toBeNull();
  });

  it("keeps the database-backed consent TTL contract at ten minutes", () => {
    expect(MEDIA_PROVIDER_CONSENT_TTL_MS).toBe(600_000);
  });

  it("accepts only canonical UUID-shaped report generations", () => {
    expect(isMediaProviderReportFlowId("4a761fe8-d3d6-4ff4-996c-59bef651ed86")).toBe(true);
    expect(isMediaProviderReportFlowId("not-a-flow")).toBe(false);
    expect(isMediaProviderReportFlowId(undefined)).toBe(false);
  });
});

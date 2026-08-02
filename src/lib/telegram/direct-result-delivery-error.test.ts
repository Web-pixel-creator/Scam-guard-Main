import { describe, expect, it } from "vitest";
import {
  directDeliveryRetryAfterMs,
  directDeliveryRetryMsFromSeconds,
  TelegramDirectResultDeliveryError,
} from "./direct-result-delivery-error";

describe("Direct result delivery retry control", () => {
  it("preserves a valid retry_after and bounds excessive delays", () => {
    expect(directDeliveryRetryMsFromSeconds(17)).toBe(17_000);
    expect(directDeliveryRetryMsFromSeconds(86_400)).toBe(60_000);
    expect(directDeliveryRetryMsFromSeconds(undefined)).toBe(2_000);
  });

  it("recognizes only its sanitized control-flow error", () => {
    expect(directDeliveryRetryAfterMs(new TelegramDirectResultDeliveryError(17_000))).toBe(17_000);
    expect(directDeliveryRetryAfterMs(new Error("network detail"))).toBeNull();
  });
});

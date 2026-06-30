import { describe, expect, it } from "vitest";

import { t } from "@/lib/i18n";
import { safeCheckErrorMessage, safeClientErrorReason } from "./client-error";

describe("safeCheckErrorMessage", () => {
  it("does not expose internal server configuration errors", () => {
    const message = safeCheckErrorMessage(
      new Error("HASH_PEPPER_SECRET is required for identifier hashing"),
      "ru",
    );

    expect(message).not.toContain("HASH_PEPPER_SECRET");
    expect(message).toContain("Проверка временно недоступна");
  });

  it("keeps the user-facing rate limit message", () => {
    expect(safeCheckErrorMessage(new Error("rate_limited"), "en")).toBe(t("rate_limited", "en"));
    expect(safeCheckErrorMessage(new Error("HTTP 429"), "ru")).toBe(t("rate_limited", "ru"));
  });

  it("keeps client console reasons coarse for server configuration errors", () => {
    const reason = safeClientErrorReason(
      new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin writes"),
    );

    expect(reason).toBe("unavailable");
    expect(reason).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("keeps rate limit as a safe client console reason", () => {
    expect(safeClientErrorReason(new Error("HTTP 429"))).toBe("rate_limited");
  });
});

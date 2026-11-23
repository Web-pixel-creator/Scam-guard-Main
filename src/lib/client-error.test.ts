import { afterEach, describe, expect, it, vi } from "vitest";

import { t } from "@/lib/i18n";
import { offlineMessage, safeCheckErrorMessage, safeClientErrorReason } from "./client-error";

describe("safeCheckErrorMessage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("says the connection is gone, not that the service broke, when offline", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(safeCheckErrorMessage(new Error("Failed to fetch"), "uz")).toBe(offlineMessage("uz"));
    expect(offlineMessage("ru")).toContain("введённый текст сохранён");
  });

  it("uses the site's Uzbek apostrophe in the unavailable message", () => {
    expect(safeCheckErrorMessage(new Error("boom"), "uz")).toContain("ko‘ring");
    expect(safeCheckErrorMessage(new Error("boom"), "uz")).not.toContain("'");
  });

  it("keeps rate limit as a safe client console reason", () => {
    expect(safeClientErrorReason(new Error("HTTP 429"))).toBe("rate_limited");
  });
});

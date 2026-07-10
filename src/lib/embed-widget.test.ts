import { describe, expect, it } from "vitest";

import {
  buildEmbedIframeSnippet,
  buildEmbedWidgetUrl,
  normalizeEmbedLang,
  sanitizePartner,
} from "@/lib/embed-widget";

describe("embed widget helpers", () => {
  it("normalizes supported languages and falls back to Russian", () => {
    expect(normalizeEmbedLang("ru")).toBe("ru");
    expect(normalizeEmbedLang("uz")).toBe("uz");
    expect(normalizeEmbedLang("en")).toBe("en");
    expect(normalizeEmbedLang("de")).toBe("ru");
    expect(normalizeEmbedLang(undefined)).toBe("ru");
  });

  it("sanitizes partner labels without keeping markup", () => {
    expect(sanitizePartner("  Bank Media_01  ")).toBe("Bank Media_01");
    expect(sanitizePartner("<script>alert(1)</script>")).toBe("scriptalert1script");
    expect(sanitizePartner("")).toBeNull();
  });

  it("builds a deterministic widget URL", () => {
    const url = buildEmbedWidgetUrl("https://example.com/path?q=1", {
      lang: "uz",
      partner: "Mahalla News",
    });

    expect(url).toBe("https://example.com/embed/check?lang=uz&partner=Mahalla+News");
  });

  it("builds a privacy-preserving iframe snippet", () => {
    const snippet = buildEmbedIframeSnippet("https://example.com", {
      lang: "en",
      partner: "Trusted Site",
    });

    expect(snippet).toContain('src="https://example.com/embed/check?lang=en');
    expect(snippet).toContain('referrerpolicy="strict-origin-when-cross-origin"');
    expect(snippet).not.toContain("sandbox=");
    expect(snippet).not.toContain("allow-same-origin");
    expect(snippet).not.toContain("<script");
  });
});

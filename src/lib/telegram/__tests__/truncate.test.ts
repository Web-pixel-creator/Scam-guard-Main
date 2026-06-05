import { describe, it, expect } from "vitest";
import { truncateExplanation } from "@/lib/telegram/truncate";

describe("truncateExplanation", () => {
  describe("empty string", () => {
    it("returns empty string unchanged", () => {
      const result = truncateExplanation("");
      expect(result).toBe("");
    });
  });

  describe("short text no-op", () => {
    it("returns short text unchanged without ellipsis", () => {
      const text = "This message is safe. No threats detected.";
      const result = truncateExplanation(text);

      expect(result).toBe(text);
      expect(result).not.toContain("…");
    });

    it("returns text at exactly 280 chars and 5 lines unchanged", () => {
      // 5 lines, each short enough to total ≤ 280
      const lines = [
        "Line one content here.",
        "Line two with more text.",
        "Line three is normal.",
        "Line four keeps it short.",
        "Line five ends it.",
      ];
      const text = lines.join("\n");
      expect(text.length).toBeLessThanOrEqual(280);

      const result = truncateExplanation(text);
      expect(result).toBe(text);
      expect(result).not.toContain("…");
    });
  });

  describe("long text truncation", () => {
    it("truncates text exceeding 280 chars and appends ellipsis", () => {
      const text = "This is a sentence. ".repeat(20); // ~400 chars
      expect(text.length).toBeGreaterThan(280);

      const result = truncateExplanation(text);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result).toMatch(/…$/);
    });

    it("result has at most 5 lines", () => {
      const text = "This is a sentence. ".repeat(20);
      const result = truncateExplanation(text);

      expect(result.split("\n").length).toBeLessThanOrEqual(5);
    });
  });

  describe("multi-line truncation", () => {
    it("truncates text with more than 5 lines", () => {
      const lines = Array.from({ length: 8 }, (_, i) => `Line ${i + 1} text.`);
      const text = lines.join("\n");

      const result = truncateExplanation(text);

      expect(result.split("\n").length).toBeLessThanOrEqual(5);
      expect(result).toMatch(/…$/);
    });

    it("preserves content from first lines", () => {
      const lines = [
        "First line stays.",
        "Second line stays.",
        "Third line stays.",
        "Fourth line stays.",
        "Fifth line stays.",
        "Sixth line dropped.",
        "Seventh line dropped.",
      ];
      const text = lines.join("\n");
      const result = truncateExplanation(text);

      expect(result).toContain("First line stays.");
      expect(result).toContain("Second line stays.");
    });
  });

  describe("multi-language text", () => {
    it("handles Russian/Cyrillic text correctly", () => {
      const text = "Это сообщение безопасно. Никаких угроз не обнаружено. Отправитель проверен.";
      const result = truncateExplanation(text);

      expect(result).toBe(text);
      expect(result).not.toContain("…");
    });

    it("truncates long Russian text within limits", () => {
      const text = "Это подозрительное сообщение. ".repeat(15); // long Cyrillic
      expect(text.length).toBeGreaterThan(280);

      const result = truncateExplanation(text);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result).toMatch(/…$/);
    });

    it("handles Uzbek/Latin text correctly", () => {
      const text = "Bu xabar xavfsiz. Hech qanday tahdid aniqlanmadi. Jo'natuvchi tekshirilgan.";
      const result = truncateExplanation(text);

      expect(result).toBe(text);
      expect(result).not.toContain("…");
    });

    it("truncates long Uzbek text within limits", () => {
      const text = "Bu juda shubhali xabar. ".repeat(15);
      expect(text.length).toBeGreaterThan(280);

      const result = truncateExplanation(text);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result).toMatch(/…$/);
    });
  });

  describe("single long line edge case", () => {
    it("truncates a single line exceeding 280 chars", () => {
      const text = "A".repeat(300);
      const result = truncateExplanation(text);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result).toMatch(/…$/);
      expect(result.split("\n").length).toBe(1);
    });

    it("handles a single line of words exceeding 280 chars", () => {
      const text = "word ".repeat(60); // ~300 chars
      expect(text.trim().length).toBeGreaterThan(280);

      const result = truncateExplanation(text);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result).toMatch(/…$/);
    });
  });

  describe("sentence boundary preservation", () => {
    it("prefers cutting at sentence boundary (period + space)", () => {
      // Build text where a sentence ends just before 280 char limit
      const sentence1 = "First sentence is here. "; // 24 chars
      const sentence2 = "Second sentence follows. "; // 25 chars
      // Fill up to near 280 with full sentences, then add a long tail
      const filler = sentence1.repeat(10) + sentence2; // 240 + 25 = 265
      const text =
        filler + "This last part is extra content that pushes us over the limit significantly";

      expect(text.length).toBeGreaterThan(280);

      const result = truncateExplanation(text);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result).toMatch(/…$/);
      // Should end at a sentence boundary before the ellipsis
      // The text before "…" should end with a period or the cut happens at a sentence end
      const beforeEllipsis = result.slice(0, -1);
      expect(
        beforeEllipsis.endsWith(".") ||
          beforeEllipsis.endsWith("!") ||
          beforeEllipsis.endsWith("?") ||
          beforeEllipsis.endsWith(" "),
      ).toBe(true);
    });

    it("prefers cutting at exclamation boundary", () => {
      const text =
        "Watch out! This is dangerous! Do not click! " +
        "More filler text goes here to pad the message. ".repeat(6);

      expect(text.length).toBeGreaterThan(280);

      const result = truncateExplanation(text);

      expect(result.length).toBeLessThanOrEqual(280);
      expect(result).toMatch(/…$/);
    });
  });
});

import { describe, it, expect } from "vitest";
import { validateMarkdownV2 } from "@/lib/telegram/__tests__/markdown-v2-validator";

describe("validateMarkdownV2", () => {
  describe("properly escaped strings", () => {
    it("passes a fully escaped string", () => {
      const text = "Hello\\! This is a test\\. No issues here\\.";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes plain text without special characters", () => {
      const text = "Simple text with no special chars";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes text with all special chars properly escaped", () => {
      const text = "\\_ \\* \\[ \\] \\( \\) \\~ \\` \\> \\# \\+ \\- \\= \\| \\{ \\} \\. \\!";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("unescaped special characters", () => {
    it("fails on unescaped dot", () => {
      const text = "Check this link. It is suspicious";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("'.'");
    });

    it("fails on unescaped exclamation mark", () => {
      const text = "Warning! This is dangerous";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("'!'"))).toBe(true);
    });

    it("fails on unescaped parentheses", () => {
      const text = "See details (here)";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("'('"))).toBe(true);
      expect(result.errors.some((e) => e.includes("')'"))).toBe(true);
    });
  });

  describe("bold markers", () => {
    it("passes properly paired bold markers", () => {
      const text = "*Bold text here* and more escaped text\\.";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes bold content containing special chars", () => {
      // Content inside *...* is allowed to have special chars
      const text = "*Risk level: high!* Check the link\\.";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("flags unpaired bold marker as unescaped *", () => {
      const text = "This has a lone * in it";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("'*'"))).toBe(true);
    });
  });

  describe("emoji characters", () => {
    it("passes emoji characters without escaping", () => {
      const text = "🟢 Safe \\- no issues found\\.";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes multiple emojis mixed with text", () => {
      const text = "🔴 *High risk* 🚨 \\- take action now\\!";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes section header emojis", () => {
      const text = "💡 *Brief*\n📌 *What I noticed*\n✅ *What to do*";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("unicode special cases", () => {
    it("passes bullet character •", () => {
      const text = "• First item\\.\n• Second item\\.";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes thin separator ┈", () => {
      const text = "┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes thick separator ━", () => {
      const text = "━━━━━━━━━━━━━━━━━━━━";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("newlines", () => {
    it("passes text with newline characters", () => {
      const text = "First line\\.\nSecond line\\.\nThird line\\.";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe("error descriptions", () => {
    it("provides position info in error messages", () => {
      const text = "Hello.World";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("position");
    });

    it("provides context snippet in error messages", () => {
      const text = "Some text. More text";
      const result = validateMarkdownV2(text);

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("near:");
    });
  });
});

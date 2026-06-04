import { describe, expect, it } from "vitest";
import { shouldRedactAsCard, redactText } from "../detect";

/**
 * Validates: Requirements 3.1, 3.2
 *
 * Verifies that barcode/ad OCR digit sequences do NOT trigger card redaction
 * when no payment context words are present.
 */
describe("Barcode/ad OCR does not trigger card risk", () => {
  describe("shouldRedactAsCard — direct function", () => {
    it("EAN-13 barcode digits without payment context → no redaction", () => {
      const digits = "4607062670125";
      const text = "Штрих-код товара: 4607062670125 годен до 12.2025";
      const start = text.indexOf(digits);
      const end = start + digits.length;

      expect(shouldRedactAsCard(digits, text, start, end)).toBe(false);
    });

    it("shipping tracking number (19 digits) without payment context → no redaction", () => {
      const digits = "4215039876543210987";
      const text = `Ваш трек-номер: ${digits} — отслеживайте на сайте почты`;
      const start = text.indexOf(digits);
      const end = start + digits.length;

      expect(shouldRedactAsCard(digits, text, start, end)).toBe(false);
    });

    it("beverage ad OCR text with EAN barcode → no redaction", () => {
      const digits = "4607062670125";
      const text = "Coca-Cola 330ml 4607062670125 акция до 31.12";
      const start = text.indexOf(digits);
      const end = start + digits.length;

      expect(shouldRedactAsCard(digits, text, start, end)).toBe(false);
    });

    it("product catalog article number → no redaction", () => {
      const digits = "8901526401567";
      const text = "Артикул 8901526401567 Чай зеленый 100г";
      const start = text.indexOf(digits);
      const end = start + digits.length;

      expect(shouldRedactAsCard(digits, text, start, end)).toBe(false);
    });
  });

  describe("redactText — full pipeline", () => {
    it("EAN-13 barcode in product label is preserved", () => {
      const text = "Штрих-код товара: 4607062670125 годен до 12.2025";
      const result = redactText(text);

      expect(result).toContain("4607062670125");
      expect(result).not.toContain("•••• •••• •••• ••••");
    });

    it("tracking number in shipping notification is preserved", () => {
      const text = "Ваш трек-номер: 4215039876543210987 — отслеживайте на сайте почты";
      const result = redactText(text);

      expect(result).toContain("4215039876543210987");
      expect(result).not.toContain("•••• •••• •••• ••••");
    });

    it("beverage ad OCR screenshot text is preserved", () => {
      const text = "Coca-Cola 330ml 4607062670125 акция до 31.12";
      const result = redactText(text);

      expect(result).toContain("4607062670125");
      expect(result).not.toContain("•••• •••• •••• ••••");
    });

    it("product catalog with article number is preserved", () => {
      const text = "Артикул 8901526401567 Чай зеленый 100г";
      const result = redactText(text);

      expect(result).toContain("8901526401567");
      expect(result).not.toContain("•••• •••• •••• ••••");
    });
  });
});

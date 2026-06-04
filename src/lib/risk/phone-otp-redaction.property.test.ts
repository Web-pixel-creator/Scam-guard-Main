import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { redactText } from "./detect";

/**
 * Feature: telegram-ux-polish, Property 5: Phone and OTP redaction invariance
 *
 * Validates: Requirements 3.5
 *
 * Property: For any string containing a phone number pattern (7+ digits with
 * international prefix) or an OTP pattern (4-8 consecutive digits), applying
 * the updated redactText function SHALL still redact those patterns — the
 * card-detection changes do not alter phone/OTP masking.
 */
describe("Property 5: Phone and OTP redaction invariance", () => {
  // -------------------------------------------------------------------------
  // Generators
  // -------------------------------------------------------------------------

  /**
   * Generate a phone number with + prefix and enough digits to match PHONE_INLINE_RE.
   * The regex /\+?\d[\d\s\-()]{7,}\d/g requires at least 9 digit chars in the match.
   * We generate 9-12 pure digits to clearly land in phone territory (the + prefix
   * ensures hasFormatting=true so they are never deferred to card logic).
   */
  const phoneNumberArb = fc.integer({ min: 9, max: 12 }).chain((totalDigits) =>
    fc
      .array(fc.integer({ min: 0, max: 9 }), {
        minLength: totalDigits,
        maxLength: totalDigits,
      })
      .map((digits) => `+${digits.join("")}`),
  );

  /** Generate an OTP-like pattern: 4-8 consecutive digits. */
  const otpArb = fc
    .integer({ min: 4, max: 8 })
    .chain((len) =>
      fc
        .array(fc.integer({ min: 0, max: 9 }), { minLength: len, maxLength: len })
        .map((digits) => digits.join("")),
    );

  /** Generate surrounding text that does NOT contain card context words or digit sequences. */
  const surroundingTextArb = fc.constantFrom(
    "Позвоните по номеру ",
    "Ваш код подтверждения: ",
    "Please call ",
    "Your verification code is ",
    "Tasdiqlash kodi: ",
    "Telefon raqami: ",
    "SMS code: ",
    "Пароль: ",
    "Contact number: ",
    "Qo'ng'iroq qiling: ",
  );

  const suffixArb = fc.constantFrom(
    " для подтверждения",
    " и подождите ответа",
    " please confirm",
    " ni kiriting",
    "",
    " - do not share",
    " — никому не говорите",
  );

  // -------------------------------------------------------------------------
  // Property: Phone numbers with + prefix and 7+ digits are always redacted
  // -------------------------------------------------------------------------
  it("phone numbers (+ prefix, 7+ digits) are always redacted by redactText", () => {
    fc.assert(
      fc.property(surroundingTextArb, phoneNumberArb, suffixArb, (prefix, phone, suffix) => {
        const text = `${prefix}${phone}${suffix}`;
        const result = redactText(text);

        // The original phone number should NOT appear verbatim in the output
        expect(result).not.toContain(phone);

        // The result should contain the phone masking pattern (partial digits + dots)
        // redactText masks phones as: +XXX•••••YY (first 3 digits + last 2)
        const digits = phone.replace(/\D/g, "");
        const expectedMask = `+${digits.slice(0, 3)}•••••${digits.slice(-2)}`;
        expect(result).toContain(expectedMask);
      }),
      { numRuns: 100 },
    );
  });

  // -------------------------------------------------------------------------
  // Property: OTP patterns (4-8 standalone digits) are always redacted
  // -------------------------------------------------------------------------
  it("OTP patterns (4-8 digit standalone numbers) are always redacted by redactText", () => {
    fc.assert(
      fc.property(surroundingTextArb, otpArb, suffixArb, (prefix, otp, suffix) => {
        const text = `${prefix}${otp}${suffix}`;
        const result = redactText(text);

        // The original OTP should NOT appear verbatim in the output
        expect(result).not.toContain(otp);

        // OTP is replaced with "••••"
        expect(result).toContain("••••");
      }),
      { numRuns: 100 },
    );
  });

  // -------------------------------------------------------------------------
  // Property: Phone redaction works regardless of card-detection refactor context
  // -------------------------------------------------------------------------
  it("phone numbers are redacted even when card context words are present nearby", () => {
    const cardContextArb = fc.constantFrom(
      "карта",
      "банк",
      "card",
      "bank",
      "uzcard",
      "humo",
      "оплата",
    );

    fc.assert(
      fc.property(cardContextArb, phoneNumberArb, (contextWord, phone) => {
        // Phone appears near a card context word — should still be masked as phone, not card
        const text = `${contextWord}: позвоните ${phone} для уточнения`;
        const result = redactText(text);

        // Phone number must not remain in cleartext
        expect(result).not.toContain(phone);

        // Must be masked with phone pattern, not card pattern
        const digits = phone.replace(/\D/g, "");
        const expectedPhoneMask = `+${digits.slice(0, 3)}•••••${digits.slice(-2)}`;
        expect(result).toContain(expectedPhoneMask);
      }),
      { numRuns: 100 },
    );
  });
});

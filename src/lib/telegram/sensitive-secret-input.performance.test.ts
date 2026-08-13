import { describe, expect, it } from "vitest";

import {
  detectTelegramSensitiveSecret,
  hasPastedSensitiveSecretValue,
} from "@/lib/telegram/sensitive-secret-input";

describe("value-first password preflight", () => {
  it.each([
    "Correct-Horse-Battery-Staple password",
    "AlphaSecret42AB pаsswоrd",
    "AlphaSecret42 password",
    "AlphaSecret42 — password",
    "AlphaSecret! password",
    "Parol!2026 parolini",
    "CorrectHorse42BatteryStaple passphrase",
    "Correct-Horse-Battery-Staple p a s s w o r d",
    "correct horse battery staple — password",
    "correct horse battery staple — passphrase",
  ])("keeps value-first secret detection for %s", (input) => {
    expect(hasPastedSensitiveSecretValue(input)).toBe(true);
    expect(detectTelegramSensitiveSecret(input)?.classes).toContain("password");
  });

  it.each(["I read out the one-time password", "Use a single-use password."])(
    "keeps natural one-time-password prose out of the private-value path: %s",
    (input) => {
      expect(hasPastedSensitiveSecretValue(input)).toBe(false);
      expect(detectTelegramSensitiveSecret(input)).toBeNull();
    },
  );

  it.each([
    "This list contains the words correct horse battery staple and password guidance.",
    "The model name is Correct Horse Battery Staple Password Edition.",
    "AlphaSecret password policy",
  ])("does not treat ordinary prose as a value-first secret: %s", (input) => {
    expect(hasPastedSensitiveSecretValue(input)).toBe(false);
  });

  it("handles a long marker-free candidate without offset-by-offset regex retries", () => {
    const input = `pаsswоrd ${"a".repeat(65_536)}`;

    // This assertion is intentionally functional rather than tied to a
    // machine-specific millisecond threshold. Vitest's normal test timeout
    // still catches a return to the old quadratic unanchored scan.
    expect(hasPastedSensitiveSecretValue(input)).toBe(false);
  });
});

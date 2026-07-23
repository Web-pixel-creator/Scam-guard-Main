import { describe, expect, it } from "vitest";

import { SIGNUP_PASSWORD_MIN_LENGTH, SIGNUP_PASSWORD_PATTERN } from "./auth-password-policy";

const signupPassword = new RegExp(`^(?:${SIGNUP_PASSWORD_PATTERN})$`);

describe("signup password policy", () => {
  it("matches the configured Supabase password policy", () => {
    expect(SIGNUP_PASSWORD_MIN_LENGTH).toBe(12);
    expect(signupPassword.test("StrongPass1!")).toBe(true);
  });

  it.each(["Short1!", "lowercaseonly1!", "UPPERCASEONLY1!", "NoDigitsHere!", "NoSymbols123"])(
    "rejects a password missing a required class: %s",
    (password) => {
      expect(signupPassword.test(password)).toBe(false);
    },
  );
});

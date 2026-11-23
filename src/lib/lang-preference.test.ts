import { describe, expect, it } from "vitest";
import {
  langCookie,
  langFromAcceptLanguage,
  langFromCookieHeader,
  resolveLang,
} from "./lang-preference";

describe("language preference", () => {
  it.each([
    ["ig_lang=uz", "uz"],
    ["theme=dark; ig_lang=en; sb=1", "en"],
    [" ig_lang = ru ", "ru"],
    ["ig_lang=de", null],
    ["xig_lang=uz", null],
    ["ig_lang=", null],
    ["", null],
  ])("reads the cookie header %j", (header, expected) => {
    expect(langFromCookieHeader(header)).toBe(expected);
  });

  it.each([
    ["uz-UZ,uz;q=0.9,ru;q=0.8,en;q=0.7", "uz"],
    ["ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7", "ru"],
    ["en-US,en;q=0.9", "en"],
    ["uz-Cyrl-UZ,ru;q=0.5", "uz"],
    ["de-DE,de;q=0.9,en;q=0.8,ru;q=0.7", "en"],
    ["ru;q=0.5,uz;q=0.9", "uz"],
    ["uz;q=0,ru", "ru"],
    ["tr-TR,kk;q=0.8,*;q=0.5", null],
    ["", null],
  ])("picks the first supported browser language from %j", (header, expected) => {
    expect(langFromAcceptLanguage(header)).toBe(expected);
  });

  it("prefers the visitor's explicit choice, then the browser, then Russian", () => {
    expect(resolveLang({ cookie: "ru", acceptLanguage: "uz-UZ,uz" })).toBe("ru");
    expect(resolveLang({ cookie: "fr", acceptLanguage: "uz-UZ,uz" })).toBe("uz");
    expect(resolveLang({ cookie: null, acceptLanguage: "de-DE" })).toBe("ru");
    expect(resolveLang({})).toBe("ru");
  });

  it("writes a first-party, year-long, lax cookie, Secure on HTTPS", () => {
    expect(langCookie("uz", true)).toBe(
      "ig_lang=uz; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
    );
    expect(langCookie("en", false)).toBe("ig_lang=en; Path=/; Max-Age=31536000; SameSite=Lax");
  });
});

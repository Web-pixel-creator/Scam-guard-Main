import { describe, expect, it } from "vitest";
import { renderErrorPage } from "./error-page";

describe("server fallback error page", () => {
  const html = renderErrorPage();

  it("works under the strict CSP: no inline handlers, scripts or <style> blocks", () => {
    expect(html).not.toMatch(/\son[a-z]+=/iu);
    expect(html).not.toContain("<script");
    // style-src-elem is 'self'; only style attributes are allowed.
    expect(html).not.toContain("<style");
  });

  it("offers reload and home as plain links in all three languages", () => {
    expect(html).toMatch(/<a class="primary" href="" /u);
    expect(html).toMatch(/<a class="secondary" href="\/" /u);
    for (const text of ["Страница не загрузилась", "Sahifa yuklanmadi", "This page didn't load"]) {
      expect(html).toContain(text);
    }
    expect(html.match(/<h1[\s>]/gu)?.length).toBe(1);
  });
});

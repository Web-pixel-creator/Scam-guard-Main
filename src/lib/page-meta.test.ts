import { describe, expect, it } from "vitest";
import { LANGS } from "./lang-preference";
import { PAGE_META, SITEMAP_PATHS, pageForPath, pageHead, type PagePath } from "./page-meta";

const PATHS = Object.keys(PAGE_META) as PagePath[];

describe("page metadata", () => {
  it.each(LANGS)("gives every page a %s title and a search-sized description", (lang) => {
    const titles = new Set<string>();
    for (const path of PATHS) {
      const { title, description } = PAGE_META[path];
      expect(title[lang].length, `${path} title`).toBeGreaterThan(10);
      expect(title[lang].length, `${path} title`).toBeLessThanOrEqual(90);
      expect(description[lang].length, `${path} description`).toBeGreaterThan(20);
      // Search snippets only matter where the page may be indexed.
      if (SITEMAP_PATHS.includes(path)) {
        expect(description[lang].length, `${path} description`).toBeGreaterThanOrEqual(50);
        expect(description[lang].length, `${path} description`).toBeLessThanOrEqual(200);
      }
      titles.add(title[lang]);
    }
    expect(titles.size).toBe(PATHS.length);
  });

  it("writes Uzbek with the site's apostrophes", () => {
    const uz = JSON.stringify(
      PATHS.map((path) => [PAGE_META[path].title.uz, PAGE_META[path].description.uz]),
    );
    expect(uz).not.toContain("'");
  });

  it("builds absolute canonical and og:url links, none on noindex pages", () => {
    const head = pageHead("/scams", { lang: "uz", origin: "https://ishonch.example" });
    expect(head.links).toEqual([{ rel: "canonical", href: "https://ishonch.example/scams" }]);
    expect(head.meta).toContainEqual({
      property: "og:url",
      content: "https://ishonch.example/scams",
    });
    expect(head.meta).toContainEqual({ property: "og:locale", content: "uz_UZ" });
    expect(head.meta).toContainEqual({
      property: "og:image",
      content: "https://ishonch.example/og-image.png",
    });
    expect(head.meta).toContainEqual({ property: "og:image:width", content: "1200" });
    expect(head.meta).toContainEqual({ property: "og:image:height", content: "630" });
    expect(head.meta).toContainEqual({
      name: "twitter:image",
      content: "https://ishonch.example/og-image.png",
    });
    expect(head.meta[0]).toEqual({ title: PAGE_META["/scams"].title.uz });

    const appeal = pageHead("/appeal", { lang: "ru", origin: "https://ishonch.example" });
    expect(appeal.links).toEqual([]);
    expect(appeal.meta).toContainEqual({ name: "robots", content: "noindex" });
  });

  it("lists only indexable pages in the sitemap", () => {
    expect(SITEMAP_PATHS).toContain("/");
    expect(SITEMAP_PATHS).toContain("/official-numbers");
    for (const hidden of ["/appeal", "/login", "/embed/check"])
      expect(SITEMAP_PATHS).not.toContain(hidden);
  });

  it("maps URL paths to page entries, ignoring a trailing slash", () => {
    expect(pageForPath("/")).toBe("/");
    expect(pageForPath("/scams/")).toBe("/scams");
    expect(pageForPath("/embed/check")).toBe("/embed/check");
    expect(pageForPath("/admin")).toBeNull();
    expect(pageForPath("/no-such-page")).toBeNull();
  });
});

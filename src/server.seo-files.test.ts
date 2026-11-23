import { afterEach, describe, expect, it, vi } from "vitest";

import server, { renderRobotsTxt, renderSitemapXml } from "./server";
import { SITEMAP_PATHS } from "./lib/page-meta";

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: async () => new Response("<!doctype html><html></html>") },
}));

async function get(pathname: string): Promise<Response> {
  return server.fetch(new Request(`https://ishonch.example${pathname}`), {}, {});
}

describe("robots.txt and sitemap.xml", () => {
  afterEach(() => {
    delete process.env.PUBLIC_APP_URL;
  });

  it("points crawlers at an absolute sitemap and keeps the admin area out", () => {
    const robots = renderRobotsTxt("https://ishonch.example");
    expect(robots).toContain("Sitemap: https://ishonch.example/sitemap.xml");
    expect(robots).toContain("Disallow: /admin");
    // noindex pages stay crawlable so their meta robots tag is read.
    expect(robots).not.toContain("Disallow: /appeal");
    expect(robots).not.toContain("Disallow: /login");
  });

  it("lists every indexable page with an absolute URL", () => {
    const xml = renderSitemapXml("https://ishonch.example");
    for (const path of SITEMAP_PATHS) {
      expect(xml).toContain(`<loc>https://ishonch.example${path}</loc>`);
    }
    expect(xml).not.toContain("/appeal");
  });

  it("serves both from PUBLIC_APP_URL with the right types and security headers", async () => {
    process.env.PUBLIC_APP_URL = "https://ishonch.example/";
    const robots = await get("/robots.txt");
    expect(robots.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await robots.text()).toContain("Sitemap: https://ishonch.example/sitemap.xml");
    expect(robots.headers.get("x-content-type-options")).toBe("nosniff");

    const sitemap = await get("/sitemap.xml");
    expect(sitemap.headers.get("content-type")).toBe("application/xml; charset=utf-8");
    expect(await sitemap.text()).toContain("<loc>https://ishonch.example/</loc>");
  });
});

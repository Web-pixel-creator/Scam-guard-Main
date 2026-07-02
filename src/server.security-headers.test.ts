import { afterEach, describe, expect, it, vi } from "vitest";

import server from "./server";

vi.mock("@tanstack/react-start/server-entry", () => ({
  default: {
    fetch: async () =>
      new Response("<!doctype html><html><body>ok</body></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  },
}));

function cspDirective(policy: string, name: string): string {
  return (
    policy
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `)) ?? ""
  );
}

async function fetchPath(pathname: string): Promise<Response> {
  return server.fetch(new Request(`https://ishonch.example${pathname}`), {}, {});
}

describe("server security headers", () => {
  afterEach(() => {
    delete process.env.EMBED_ALLOWED_FRAME_ANCESTORS;
  });

  it("sets baseline security headers on public responses", async () => {
    const response = await fetchPath("/healthz");
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(response.status).toBe(200);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(response.headers.get("permissions-policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    expect(response.headers.get("strict-transport-security")).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(cspDirective(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(cspDirective(csp, "script-src")).not.toContain("'unsafe-inline'");
  });

  it("adds a per-request script nonce without weakening the main-site CSP", async () => {
    const response = await fetchPath("/");
    const csp = response.headers.get("content-security-policy") ?? "";
    const scriptSrc = cspDirective(csp, "script-src");

    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(cspDirective(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9_-]+'/);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("removes X-Frame-Options and uses the explicit embed frame ancestor allowlist", async () => {
    process.env.EMBED_ALLOWED_FRAME_ANCESTORS =
      "https://partner.example/path http://evil.example https://bank.example:8443";

    const response = await fetchPath("/embed/check");
    const csp = response.headers.get("content-security-policy") ?? "";
    const frameAncestors = cspDirective(csp, "frame-ancestors");

    expect(response.headers.get("x-frame-options")).toBeNull();
    expect(frameAncestors).toBe(
      "frame-ancestors 'self' https://partner.example https://bank.example:8443 http://localhost:* http://127.0.0.1:*",
    );
    expect(frameAncestors.split(/\s+/)).not.toContain("https:");
    expect(frameAncestors).not.toContain("http://evil.example");
    expect(cspDirective(csp, "script-src")).toMatch(/'nonce-[A-Za-z0-9_-]+'/);
    expect(cspDirective(csp, "script-src")).not.toContain("'unsafe-inline'");
  });
});

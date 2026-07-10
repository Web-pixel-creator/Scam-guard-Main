import { describe, expect, it } from "vitest";

import {
  addScriptNonceToContentSecurityPolicy,
  buildEmbedCheckContentSecurityPolicy,
  DEFAULT_CONTENT_SECURITY_POLICY,
  EMBED_CHECK_CONTENT_SECURITY_POLICY,
  parseEmbedFrameAncestorAllowlist,
  UNICORN_STUDIO_SCRIPT_SRC,
} from "./csp";

function directive(policy: string, name: string): string {
  return (
    policy
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `)) ?? ""
  );
}

describe("content security policy", () => {
  it("does not allow inline scripts on the main site", () => {
    const scriptSrc = directive(DEFAULT_CONTENT_SECURITY_POLICY, "script-src");
    const styleSrc = directive(DEFAULT_CONTENT_SECURITY_POLICY, "style-src");
    const styleSrcElem = directive(DEFAULT_CONTENT_SECURITY_POLICY, "style-src-elem");
    const styleSrcAttr = directive(DEFAULT_CONTENT_SECURITY_POLICY, "style-src-attr");

    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain(UNICORN_STUDIO_SCRIPT_SRC);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(styleSrc).not.toContain("'unsafe-inline'");
    expect(styleSrcElem).not.toContain("'unsafe-inline'");
    expect(styleSrcAttr).toBe("style-src-attr 'unsafe-inline'");
    expect(DEFAULT_CONTENT_SECURITY_POLICY).toContain("script-src-attr 'none'");
    expect(DEFAULT_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(DEFAULT_CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
  });

  it("keeps the embeddable widget frameable only for self/dev by default", () => {
    const scriptSrc = directive(EMBED_CHECK_CONTENT_SECURITY_POLICY, "script-src");
    const styleSrc = directive(EMBED_CHECK_CONTENT_SECURITY_POLICY, "style-src");
    const styleSrcElem = directive(EMBED_CHECK_CONTENT_SECURITY_POLICY, "style-src-elem");
    const styleSrcAttr = directive(EMBED_CHECK_CONTENT_SECURITY_POLICY, "style-src-attr");
    const frameAncestors = directive(EMBED_CHECK_CONTENT_SECURITY_POLICY, "frame-ancestors");

    expect(scriptSrc).toBe("script-src 'self'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(styleSrc).not.toContain("'unsafe-inline'");
    expect(styleSrcElem).not.toContain("'unsafe-inline'");
    expect(styleSrcAttr).toBe("style-src-attr 'unsafe-inline'");
    expect(frameAncestors).toBe("frame-ancestors 'self' http://localhost:* http://127.0.0.1:*");
    expect(frameAncestors).not.toContain("https:");
    expect(frameAncestors).toContain("http://localhost:*");
    expect(EMBED_CHECK_CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });

  it("builds embed frame-ancestors from explicit HTTPS partner origins", () => {
    const policy = buildEmbedCheckContentSecurityPolicy([
      "https://mahalla.example",
      "https://bank.example:8443",
    ]);
    const frameAncestors = directive(policy, "frame-ancestors");

    expect(frameAncestors).toBe(
      "frame-ancestors 'self' https://mahalla.example https://bank.example:8443 http://localhost:* http://127.0.0.1:*",
    );
    expect(frameAncestors.split(/\s+/)).not.toContain("https:");
  });

  it("normalizes and rejects unsafe embed frame ancestor allowlist entries", () => {
    expect(
      parseEmbedFrameAncestorAllowlist(
        "https://trusted.example/path, http://evil.example, javascript:alert(1), https://trusted.example",
      ),
    ).toEqual(["https://trusted.example"]);
  });

  it("adds a request nonce to script-src without allowing unsafe-inline", () => {
    const policy = addScriptNonceToContentSecurityPolicy(DEFAULT_CONTENT_SECURITY_POLICY, "abc123");
    const scriptSrc = directive(policy, "script-src");

    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'self'");
    expect(scriptSrc).toContain(UNICORN_STUDIO_SCRIPT_SRC);
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("does not duplicate an existing request nonce", () => {
    const first = addScriptNonceToContentSecurityPolicy(DEFAULT_CONTENT_SECURITY_POLICY, "abc123");
    const second = addScriptNonceToContentSecurityPolicy(first, "abc123");

    expect(directive(second, "script-src").match(/'nonce-abc123'/g)).toHaveLength(1);
  });
});

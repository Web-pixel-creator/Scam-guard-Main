import { describe, expect, it } from "vitest";
import { checkProxyIpHeaderTrust } from "../../scripts/security-smoke-env";

describe("production security smoke env checks", () => {
  it("fails Railway trust until edge overwrite/strip verification is recorded", () => {
    expect(
      checkProxyIpHeaderTrust({
        RAILWAY_ENVIRONMENT_ID: "00000000-0000-4000-8000-000000000001",
        TRUST_PROXY_IP_HEADERS: "true",
      }),
    ).toMatchObject({
      ok: false,
      label: "Railway client IP header trust has edge verification",
      detail: expect.stringContaining("requires TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true"),
    });
  });

  it("passes Railway trust only after explicit edge verification", () => {
    expect(
      checkProxyIpHeaderTrust({
        RAILWAY_ENVIRONMENT_NAME: "production",
        TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED: "true",
      }),
    ).toMatchObject({
      ok: true,
      label: "Railway client IP header trust has edge verification",
      detail: expect.stringContaining("only after explicit edge"),
    });
  });

  it("passes when proxy IP header trust is not enabled", () => {
    expect(checkProxyIpHeaderTrust({})).toMatchObject({
      ok: true,
      detail: "TRUST_PROXY_IP_HEADERS is unset/false",
    });
    expect(checkProxyIpHeaderTrust({ TRUST_PROXY_IP_HEADERS: "false" }).ok).toBe(true);
  });

  it("fails when proxy IP header trust is enabled without edge proof", () => {
    expect(checkProxyIpHeaderTrust({ TRUST_PROXY_IP_HEADERS: "true" })).toMatchObject({
      ok: false,
      label: "proxy IP header trust has edge verification",
    });
  });

  it("passes when proxy IP header trust has explicit edge proof", () => {
    expect(
      checkProxyIpHeaderTrust({
        TRUST_PROXY_IP_HEADERS: "true",
        TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED: "true",
      }),
    ).toMatchObject({
      ok: true,
      detail: expect.stringContaining("explicit edge"),
    });
  });
});

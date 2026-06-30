import { describe, expect, it } from "vitest";
import { checkProxyIpHeaderTrust } from "../../scripts/security-smoke-env";

describe("production security smoke env checks", () => {
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

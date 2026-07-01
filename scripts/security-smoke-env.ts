export type SecuritySmokeCheckResult = {
  label: string;
  ok: boolean;
  detail: string;
};

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

type ProxyIpHeaderEnv = Partial<
  Record<"TRUST_PROXY_IP_HEADERS" | "TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED", string | undefined>
>;

export function checkProxyIpHeaderTrust(env: ProxyIpHeaderEnv): SecuritySmokeCheckResult {
  if (!isEnabled(env.TRUST_PROXY_IP_HEADERS)) {
    return {
      label: "proxy IP header trust is disabled by default",
      ok: true,
      detail: "TRUST_PROXY_IP_HEADERS is unset/false",
    };
  }

  const verified = isEnabled(env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED);
  return {
    label: "proxy IP header trust has edge verification",
    ok: verified,
    detail: verified
      ? "TRUST_PROXY_IP_HEADERS=true with explicit edge overwrite/strip verification"
      : "TRUST_PROXY_IP_HEADERS=true requires TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true after verifying edge proxy header overwrite/strip behavior",
  };
}

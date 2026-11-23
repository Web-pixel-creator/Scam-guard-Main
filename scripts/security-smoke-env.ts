export type SecuritySmokeCheckResult = {
  label: string;
  ok: boolean;
  detail: string;
};

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

type ProxyIpHeaderEnv = Partial<
  Record<
    | "RAILWAY_ENVIRONMENT_ID"
    | "RAILWAY_ENVIRONMENT_NAME"
    | "RAILWAY_DEPLOYMENT_ID"
    | "TRUST_PROXY_IP_HEADERS"
    | "TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED",
    string | undefined
  >
>;

function isRailwayRuntime(env: ProxyIpHeaderEnv): boolean {
  return Boolean(
    env.RAILWAY_ENVIRONMENT_ID?.trim() ||
    env.RAILWAY_ENVIRONMENT_NAME?.trim() ||
    env.RAILWAY_DEPLOYMENT_ID?.trim(),
  );
}

export function checkProxyIpHeaderTrust(env: ProxyIpHeaderEnv): SecuritySmokeCheckResult {
  if (isRailwayRuntime(env)) {
    const verified = isEnabled(env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED);
    return {
      label: "Railway client IP header trust has edge verification",
      ok: verified,
      detail: verified
        ? "Railway X-Real-IP trust is enabled only after explicit edge overwrite/strip verification"
        : "Railway requires TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true only after verifying that its edge overwrites or strips a client-supplied X-Real-IP header",
    };
  }

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

import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

function trustProxyIpHeaders(): boolean {
  return process.env.TRUST_PROXY_IP_HEADERS === "true";
}

function cleanHeaderIp(value: string | undefined): string | null {
  const first = value?.split(",")[0]?.trim();
  if (!first || first.length > 64) return null;
  return /^[A-Fa-f0-9:.]+$/.test(first) ? first : null;
}

function trustedProxyIp(): string | null {
  return (
    cleanHeaderIp(getRequestHeader("cf-connecting-ip")) ||
    cleanHeaderIp(getRequestHeader("x-real-ip")) ||
    cleanHeaderIp(getRequestIP({ xForwardedFor: true }))
  );
}

export function publicRateLimitKey(scope: "check" | "report" | "appeal"): string {
  try {
    const ip =
      (trustProxyIpHeaders() ? trustedProxyIp() : null) ||
      cleanHeaderIp(getRequestIP({ xForwardedFor: false })) ||
      "unknown";
    return `${scope}:${ip}`;
  } catch {
    return `${scope}:unknown`;
  }
}

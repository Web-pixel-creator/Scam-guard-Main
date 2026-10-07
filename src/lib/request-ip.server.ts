import { isIP } from "node:net";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { isRailwayRuntime } from "@/lib/runtime-env.server";

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function trustRailwayClientIpHeader(): boolean {
  return isEnabled(process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED);
}

function trustGenericProxyIpHeaders(): boolean {
  return (
    isEnabled(process.env.TRUST_PROXY_IP_HEADERS) &&
    isEnabled(process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED)
  );
}

function cleanIp(value: string | undefined): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 64) return null;
  return isIP(candidate) === 0 ? null : candidate;
}

function genericTrustedProxyIp(): string | null {
  return (
    cleanIp(getRequestHeader("cf-connecting-ip")) ||
    cleanIp(getRequestHeader("x-real-ip")) ||
    cleanIp(getRequestIP({ xForwardedFor: true }))
  );
}

export function publicRateLimitKey(scope: "check" | "report" | "appeal"): string {
  try {
    const proxyIp = isRailwayRuntime()
      ? trustRailwayClientIpHeader()
        ? cleanIp(getRequestHeader("x-real-ip"))
        : null
      : trustGenericProxyIpHeaders()
        ? genericTrustedProxyIp()
        : null;
    const ip = proxyIp || cleanIp(getRequestIP({ xForwardedFor: false })) || "unknown";
    return `${scope}:${ip}`;
  } catch {
    return `${scope}:unknown`;
  }
}

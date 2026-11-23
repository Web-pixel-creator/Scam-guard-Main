import { isIP } from "node:net";
import { URL } from "node:url";
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
  // Interface/zone identifiers are not public client identities. Reject them,
  // rather than stripping a suffix into an otherwise trusted address.
  if (!candidate || candidate.length > 64 || candidate.includes("%")) return null;
  const family = isIP(candidate);
  if (family === 4) return candidate;
  if (family !== 6) return null;

  try {
    // WHATWG serialization canonicalizes a validated literal locally: no DNS
    // or network request. Validation first excludes URL/port/forwarding syntax.
    const canonical = new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
    if (!mapped) return canonical;

    // Only IPv4-mapped ::ffff:0:0/96 aliases IPv4; NAT64, compatible and
    // translated addresses remain distinct. Never aggregate an IPv6 subnet.
    const high = Number.parseInt(mapped[1], 16);
    const low = Number.parseInt(mapped[2], 16);
    return [high >>> 8, high & 255, low >>> 8, low & 255].join(".");
  } catch {
    return null;
  }
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

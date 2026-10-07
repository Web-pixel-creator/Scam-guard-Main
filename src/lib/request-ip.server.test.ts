import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  headers: {} as Record<string, string | undefined>,
  directRequestIp: undefined as string | undefined,
  forwardedRequestIp: undefined as string | undefined,
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeader: (name: string) => h.headers[name.toLowerCase()],
  getRequestIP: (options?: { xForwardedFor?: boolean }) =>
    options?.xForwardedFor ? h.forwardedRequestIp : h.directRequestIp,
}));

import { publicRateLimitKey } from "./request-ip.server";

const ORIGINAL_ENV = {
  railwayEnvironmentId: process.env.RAILWAY_ENVIRONMENT_ID,
  railwayEnvironmentName: process.env.RAILWAY_ENVIRONMENT_NAME,
  railwayDeploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
  trustProxyHeaders: process.env.TRUST_PROXY_IP_HEADERS,
  trustProxyHeadersVerified: process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED,
};

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  h.headers = {};
  h.directRequestIp = undefined;
  h.forwardedRequestIp = undefined;
  delete process.env.RAILWAY_ENVIRONMENT_ID;
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  delete process.env.RAILWAY_DEPLOYMENT_ID;
  delete process.env.TRUST_PROXY_IP_HEADERS;
  delete process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED;
});

afterEach(() => {
  restoreEnv("RAILWAY_ENVIRONMENT_ID", ORIGINAL_ENV.railwayEnvironmentId);
  restoreEnv("RAILWAY_ENVIRONMENT_NAME", ORIGINAL_ENV.railwayEnvironmentName);
  restoreEnv("RAILWAY_DEPLOYMENT_ID", ORIGINAL_ENV.railwayDeploymentId);
  restoreEnv("TRUST_PROXY_IP_HEADERS", ORIGINAL_ENV.trustProxyHeaders);
  restoreEnv("TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED", ORIGINAL_ENV.trustProxyHeadersVerified);
});

describe("publicRateLimitKey trusted client identity", () => {
  it("uses Railway's X-Real-IP only after explicit edge verification", () => {
    process.env.RAILWAY_ENVIRONMENT_ID = "00000000-0000-4000-8000-000000000001";
    process.env.TRUST_PROXY_IP_HEADERS = "true";
    process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED = "true";
    h.headers["x-real-ip"] = "198.51.100.9";
    h.headers["cf-connecting-ip"] = "203.0.113.77";
    h.headers["x-forwarded-for"] = "203.0.113.88";
    h.forwardedRequestIp = "203.0.113.88";
    h.directRequestIp = "10.0.0.8";

    expect(publicRateLimitKey("check")).toBe("check:198.51.100.9");
  });

  it("does not trust Railway X-Real-IP before edge overwrite/strip verification", () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = "production";
    h.headers["x-real-ip"] = "198.51.100.9";
    h.directRequestIp = "10.0.0.8";

    expect(publicRateLimitKey("check")).toBe("check:10.0.0.8");
  });

  it("does not trust generic proxy headers unless edge verification is also enabled", () => {
    process.env.TRUST_PROXY_IP_HEADERS = "true";
    h.headers["cf-connecting-ip"] = "203.0.113.77";
    h.forwardedRequestIp = "203.0.113.88";
    h.directRequestIp = "192.0.2.10";

    expect(publicRateLimitKey("report")).toBe("report:192.0.2.10");
  });

  it("honors generic proxy headers only with both explicit trust signals", () => {
    process.env.TRUST_PROXY_IP_HEADERS = "true";
    process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED = "true";
    h.headers["cf-connecting-ip"] = "203.0.113.77";
    h.directRequestIp = "192.0.2.10";

    expect(publicRateLimitKey("appeal")).toBe("appeal:203.0.113.77");
  });

  it("falls back to the socket when Railway X-Real-IP is absent or invalid", () => {
    process.env.RAILWAY_DEPLOYMENT_ID = "00000000-0000-4000-8000-000000000002";
    process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED = "true";
    h.headers["x-real-ip"] = "198.51.100.9, 203.0.113.7";
    h.headers["cf-connecting-ip"] = "203.0.113.77";
    h.forwardedRequestIp = "203.0.113.88";
    h.directRequestIp = "10.0.0.8";

    expect(publicRateLimitKey("check")).toBe("check:10.0.0.8");
  });

  it("returns the scoped unknown bucket when every trusted source is invalid", () => {
    process.env.RAILWAY_ENVIRONMENT_ID = "00000000-0000-4000-8000-000000000001";
    process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED = "true";
    h.headers["x-real-ip"] = "not-an-ip";
    h.directRequestIp = "also-not-an-ip";

    expect(publicRateLimitKey("report")).toBe("report:unknown");
  });
});

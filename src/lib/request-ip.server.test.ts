import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

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

describe("publicRateLimitKey canonical address identity", () => {
  it.each([
    ["2001:0DB8:0000:0000:0000:0000:0000:0001", "2001:db8::1"],
    ["2001:DB8::1", "2001:db8::1"],
    ["2001:db8:0:0:0:0:0:1", "2001:db8::1"],
    ["2001:db8::0001", "2001:db8::1"],
    ["2001:db8::1", "2001:db8::1"],
    ["2001:db8::1:443", "2001:db8::1:443"],
    ["  2001:DB8:0:0::1  ", "2001:db8::1"],
    ["0000:0000:0000:0000:0000:0000:0000:0000", "::"],
    ["0:0:0:0:0:0:0:1", "::1"],
    ["::", "::"],
    ["::1", "::1"],
    ["2001:0:0:1:0:0:1:1", "2001::1:0:0:1:1"],
    ["2001:0:0:1:0:0:0:1", "2001:0:0:1::1"],
    ["0:0:1:0:0:1:1:1", "::1:0:0:1:1:1"],
    ["2001:db8:1:2:0:0:0:0", "2001:db8:1:2::"],
    ["2001:db8:0:1:2:3:4:5", "2001:db8:0:1:2:3:4:5"],
    ["2001:db8:1:2:3:4:5:0", "2001:db8:1:2:3:4:5:0"],
    ["FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF", "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"],
    ["2001:db8:1:2:3:4:192.0.2.9", "2001:db8:1:2:3:4:c000:209"],
    ["::192.0.2.9", "::c000:209"],
    ["64:FF9B::192.0.2.9", "64:ff9b::c000:209"],
  ])("canonicalizes IPv6 %s as %s", (input, canonical) => {
    h.directRequestIp = input;

    expect(publicRateLimitKey("check")).toBe(`check:${canonical}`);
  });

  it.each([
    "192.0.2.9",
    "::ffff:192.0.2.9",
    "::FFFF:192.0.2.9",
    "::ffff:c000:209",
    "0:0:0:0:0:ffff:c000:0209",
    "0000:0000:0000:0000:0000:FFFF:C000:0209",
    "  ::FFFF:C000:0209  ",
  ])("gives plain and mapped IPv4 %s the same bucket", (input) => {
    h.directRequestIp = input;

    expect(publicRateLimitKey("report")).toBe("report:192.0.2.9");
  });

  it.each([
    ["::ffff:0:0", "0.0.0.0"],
    ["::ffff:ffff:ffff", "255.255.255.255"],
    ["::ffff:127.0.0.1", "127.0.0.1"],
    ["::ffff:0100:0001", "1.0.0.1"],
  ])("maps all four IPv4 bytes in %s without dropping leading zero bytes", (input, expected) => {
    h.directRequestIp = input;

    expect(publicRateLimitKey("appeal")).toBe(`appeal:${expected}`);
  });

  it.each([
    ["2001:db8:1:2::1", "2001:db8:1:2::2"],
    ["2001:db8:1:2::1", "2001:db8:1:3::1"],
    ["192.0.2.9", "::192.0.2.9"],
    ["192.0.2.9", "64:ff9b::192.0.2.9"],
    ["192.0.2.9", "::ffff:0:192.0.2.9"],
    ["::ffff:192.0.2.9", "::ffff:192.0.2.10"],
  ])("does not merge distinct addresses %s and %s or aggregate a /64", (left, right) => {
    h.directRequestIp = left;
    const leftKey = publicRateLimitKey("check");
    h.directRequestIp = right;

    expect(leftKey).not.toBe("check:unknown");
    expect(publicRateLimitKey("check")).not.toBe("check:unknown");
    expect(publicRateLimitKey("check")).not.toBe(leftKey);
  });

  it.each(["check", "report", "appeal"] as const)(
    "preserves the %s scope around a canonical identity",
    (scope) => {
      h.directRequestIp = "2001:0DB8:0:0:0:0:0:1";

      expect(publicRateLimitKey(scope)).toBe(`${scope}:2001:db8::1`);
    },
  );

  it("keeps 256 fixed-seed numeric IPv6 identities equal across textual forms", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 0xffff }), { minLength: 8, maxLength: 8 }),
        fc.integer({ min: 1, max: 6 }),
        fc.integer({ min: 0, max: 5 }),
        (generatedWords, zeroStart, zeroLengthChoice) => {
          const words = [...generatedWords];
          // A nonzero first word keeps this synthetic corpus non-mapped.
          words[0] = 0x2001;
          const zeroLength = 2 + (zeroLengthChoice % (7 - zeroStart));
          words.fill(0, zeroStart, zeroStart + zeroLength);
          const minimalGroups = words.map((word) => word.toString(16));
          const expanded = words.map((word) => word.toString(16).padStart(4, "0")).join(":");
          // Build a valid compressed spelling from numeric words, without URL parsing
          // or another production parser as the expected-identity oracle.
          const compressed = `${minimalGroups.slice(0, zeroStart).join(":")}::${minimalGroups
            .slice(zeroStart + zeroLength)
            .join(":")}`;
          const variants = [minimalGroups.join(":"), expanded, expanded.toUpperCase(), compressed];
          const keys = variants.map((input) => {
            h.directRequestIp = input;
            return publicRateLimitKey("check");
          });

          expect(keys[0]).not.toBe("check:unknown");
          expect(new Set(keys).size).toBe(1);

          const distinctWords = [...words];
          distinctWords[7] = (distinctWords[7] + 1) % 0x10000;
          h.directRequestIp = distinctWords.map((word) => word.toString(16)).join(":");
          expect(publicRateLimitKey("check")).not.toBe(keys[0]);
          expect(publicRateLimitKey("check")).not.toBe("check:unknown");
        },
      ),
      { seed: 20261009, numRuns: 256 },
    );
  });

  it("maps 256 fixed-seed arbitrary IPv4 byte tuples to the plain IPv4 identity", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
          fc.integer({ min: 0, max: 255 }),
        ),
        (bytes) => {
          const plain = bytes.join(".");
          const upperWord = (bytes[0] * 256 + bytes[1]).toString(16).padStart(4, "0");
          const lowerWord = (bytes[2] * 256 + bytes[3]).toString(16).padStart(4, "0");
          for (const input of [
            plain,
            `::ffff:${plain}`,
            `::FFFF:${upperWord.toUpperCase()}:${lowerWord.toUpperCase()}`,
            `0000:0000:0000:0000:0000:ffff:${upperWord}:${lowerWord}`,
          ]) {
            h.directRequestIp = input;
            expect(publicRateLimitKey("report")).toBe(`report:${plain}`);
          }
        },
      ),
      { seed: 20261010, numRuns: 256 },
    );
  });
});

describe("publicRateLimitKey malformed and zoned address rejection", () => {
  it.each([
    undefined,
    "",
    " ",
    "not-an-ip",
    "fe80::1%eth0",
    "fe80::1%3",
    "fe80::1%25eth0",
    "2001:db8::1%lo",
    "::ffff:192.0.2.9%eth0",
    "[2001:db8::1]",
    "[2001:db8::1]:443",
    "192.0.2.9:443",
    "2001:db8::1/64",
    "192.0.2.9/24",
    "2001::db8::1",
    "2001:db8:1:2:3:4:5",
    "2001:db8:1:2:3:4:5:6:7",
    "2001:db8:00000:0:0:0:0:1",
    "2001:db8::gggg",
    "2001:db8::1, 2001:db8::2",
    "192.0.2.9, 198.51.100.9",
    "::ffff:192.0.2.999",
    "::ffff:192.000.2.9",
    "192.000.2.9",
    "0xc0000209",
    "3221225993",
    "2001:db8::\u00001",
    "2001:db8::1\r\nX-Fake: injected",
    "1".repeat(65),
  ])("fails closed to scoped unknown for socket input %s", (input) => {
    h.directRequestIp = input;

    expect(publicRateLimitKey("appeal")).toBe("appeal:unknown");
  });

  it.each(["fe80::1%eth0", "[2001:db8::1]", "2001::db8::1"])(
    "rejects invalid trusted Railway header %s and canonicalizes the socket fallback",
    (input) => {
      process.env.RAILWAY_ENVIRONMENT_ID = "00000000-0000-4000-8000-000000000001";
      process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED = "true";
      h.headers["x-real-ip"] = input;
      h.headers["cf-connecting-ip"] = "203.0.113.77";
      h.forwardedRequestIp = "203.0.113.88";
      h.directRequestIp = "2001:0DB8:0:0:0:0:0:7";

      expect(publicRateLimitKey("report")).toBe("report:2001:db8::7");
    },
  );
});

describe("publicRateLimitKey keeps trust and source selection separate from normalization", () => {
  it("normalizes Railway X-Real-IP without allowing competing generic headers", () => {
    process.env.RAILWAY_ENVIRONMENT_ID = "00000000-0000-4000-8000-000000000001";
    process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED = "true";
    h.headers["x-real-ip"] = "::FFFF:C000:0209";
    h.headers["cf-connecting-ip"] = "203.0.113.77";
    h.forwardedRequestIp = "203.0.113.88";
    h.directRequestIp = "2001:db8::7";

    expect(publicRateLimitKey("check")).toBe("check:192.0.2.9");
  });

  it.each([
    [undefined, undefined],
    ["true", undefined],
    [undefined, "true"],
    ["false", "true"],
    ["true", "false"],
    ["1", "true"],
    ["true", "1"],
  ])("ignores generic headers with trust=%s and verified=%s", (trust, verified) => {
    restoreEnv("TRUST_PROXY_IP_HEADERS", trust);
    restoreEnv("TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED", verified);
    h.headers["cf-connecting-ip"] = "2001:db8::99";
    h.headers["x-real-ip"] = "2001:db8::98";
    h.forwardedRequestIp = "2001:db8::97";
    h.directRequestIp = "::FFFF:C000:0209";

    expect(publicRateLimitKey("check")).toBe("check:192.0.2.9");
  });

  it.each([
    ["2001:0DB8:0:0:0:0:0:9", "2001:db8::8", "2001:db8::7", "2001:db8::9"],
    ["fe80::1%eth0", "2001:0DB8:0:0:0:0:0:8", "2001:db8::7", "2001:db8::8"],
    ["invalid", "invalid", "2001:0DB8:0:0:0:0:0:7", "2001:db8::7"],
    ["invalid", "invalid", "fe80::1%eth0", "192.0.2.9"],
  ])(
    "keeps generic source precedence and validation (%s, %s, %s)",
    (cf, real, forwarded, expected) => {
      process.env.TRUST_PROXY_IP_HEADERS = "true";
      process.env.TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED = "true";
      h.headers["cf-connecting-ip"] = cf;
      h.headers["x-real-ip"] = real;
      h.forwardedRequestIp = forwarded;
      h.directRequestIp = "::FFFF:C000:0209";

      expect(publicRateLimitKey("report")).toBe(`report:${expected}`);
    },
  );
});

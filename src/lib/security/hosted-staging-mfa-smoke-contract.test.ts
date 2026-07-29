import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const smoke = readFileSync(
  resolve(process.cwd(), "scripts/hosted-staging-mfa-smoke.ts"),
  "utf8",
).replace(/\r\n?/gu, "\n");

describe("hosted staging MFA smoke contract", () => {
  it("probes the protected fixture with the same user client at AAL1 and AAL2", () => {
    const aal1Probe = smoke.indexOf("const aal1ProtectedRead = await userClient");
    const enrollment = smoke.indexOf("userClient.auth.mfa.enroll");
    const aal2Session = smoke.indexOf("const aal2Claims = decodeJwtClaims");
    const aal2Probe = smoke.indexOf("const aal2ProtectedRead = await userClient");

    expect(aal1Probe).toBeGreaterThan(-1);
    expect(enrollment).toBeGreaterThan(aal1Probe);
    expect(aal2Session).toBeGreaterThan(enrollment);
    expect(aal2Probe).toBeGreaterThan(aal2Session);
    expect(smoke.slice(aal1Probe, enrollment)).toMatch(
      /\.from\("checks"\)[\s\S]*?\.eq\("id", protectedCheckId\)[\s\S]*?assertAal1ProtectedReadDenied\(aal1ProtectedRead\)/u,
    );
    expect(smoke.slice(aal2Probe)).toMatch(
      /\.from\("checks"\)[\s\S]*?\.eq\("id", protectedCheckId\)[\s\S]*?aal2ProtectedRead\.count === 1/u,
    );
  });

  it("accepts only an empty AAL1 result or the PostgreSQL permission-denied code", () => {
    expect(smoke).toMatch(
      /function assertAal1ProtectedReadDenied[\s\S]*?result\.error\.code === "42501"[\s\S]*?result\.count === 0/u,
    );
  });

  it("does not use the service-role admin client as AAL2 boundary evidence", () => {
    expect(smoke).not.toMatch(
      /const aal2ProtectedRead = await adminClient\(\)|protected read-only admin count/u,
    );
  });

  it("always deletes the protected fixture and verifies that it is gone", () => {
    const finallyBlock = smoke.slice(smoke.indexOf("} finally {"));
    expect(finallyBlock).toMatch(
      /adminClient\(\)[\s\S]*?\.from\("checks"\)[\s\S]*?\.delete\(\)[\s\S]*?\.eq\("id", protectedCheckId\)/u,
    );
    expect(finallyBlock).toMatch(/remainingProtectedChecks[\s\S]*?protected-fixture:remaining/u);
  });
});

import { describe, expect, it } from "vitest";
import { isProtectedServerRuntime, isRailwayRuntime } from "./runtime-env.server";

describe("server runtime identity", () => {
  it.each([
    ["RAILWAY_ENVIRONMENT_ID", "00000000-0000-4000-8000-000000000001"],
    ["RAILWAY_ENVIRONMENT_NAME", "production"],
    ["RAILWAY_DEPLOYMENT_ID", "00000000-0000-4000-8000-000000000002"],
  ] as const)("detects Railway from its documented %s system variable", (name, value) => {
    expect(isRailwayRuntime({ [name]: value })).toBe(true);
  });

  it("does not treat the undocumented legacy name as Railway evidence", () => {
    expect(isRailwayRuntime({ RAILWAY_ENVIRONMENT: "production" })).toBe(false);
  });

  it("protects either a production Node process or an identified Railway deployment", () => {
    expect(isProtectedServerRuntime({ NODE_ENV: "production" })).toBe(true);
    expect(
      isProtectedServerRuntime({ NODE_ENV: "test", RAILWAY_ENVIRONMENT_NAME: "staging" }),
    ).toBe(true);
    expect(isProtectedServerRuntime({ NODE_ENV: "test" })).toBe(false);
  });
});

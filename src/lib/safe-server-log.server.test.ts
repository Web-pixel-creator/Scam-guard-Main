import { describe, expect, it, vi } from "vitest";

import { logServerError, safeServerErrorDetails } from "./safe-server-log.server";

describe("safe-server-log", () => {
  it("keeps raw messages, stacks and secret-shaped fields out of metadata", () => {
    const error = Object.assign(
      new Error("SUPABASE_SERVICE_ROLE_KEY=service-secret; phone=+998901234567; password=Hunter2!"),
      {
        details: "card 8600123412341234",
        hint: "telegram token 123456:ABC_SECRET",
        requestBody: { otp: "614921" },
      },
    );

    const serialized = JSON.stringify(safeServerErrorDetails(error));

    expect(serialized).toBe('{"kind":"error","category":"storage"}');
    expect(serialized).not.toContain("service-secret");
    expect(serialized).not.toContain("+998901234567");
    expect(serialized).not.toContain("Hunter2");
    expect(serialized).not.toContain("614921");
  });

  it("keeps only recognized operational code and status metadata", () => {
    expect(
      safeServerErrorDetails({
        code: "23505",
        status: 409,
        message: "duplicate value contains private user input",
        details: "secret",
      }),
    ).toEqual({
      kind: "object",
      category: "conflict",
      code: "23505",
      status: 409,
    });

    expect(
      safeServerErrorDetails({
        code: "user-secret-token",
        status: 503,
        message: "database query failed with private input",
      }),
    ).toEqual({
      kind: "object",
      category: "storage",
      status: 503,
    });
  });

  it("logs only the static event name and scrubbed details", () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logServerError(
      "reports.insert_failed",
      new Error("Bearer production-secret and OTP 614921 caused fetch failed"),
    );

    expect(errorLog).toHaveBeenCalledWith("reports.insert_failed", {
      kind: "error",
      category: "network",
    });
    const serialized = JSON.stringify(errorLog.mock.calls);
    expect(serialized).not.toContain("production-secret");
    expect(serialized).not.toContain("614921");

    errorLog.mockRestore();
  });
});

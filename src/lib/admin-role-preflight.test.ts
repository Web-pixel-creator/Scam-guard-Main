import { describe, expect, it } from "vitest";
import { collectCountedPages, summarizeAdminRoleDrift } from "./admin-role-preflight";

describe("summarizeAdminRoleDrift", () => {
  it("reports an aligned confirmed allowlist without exposing identities", () => {
    const result = summarizeAdminRoleDrift(
      [{ id: "admin-a", email: " Admin@Example.test ", emailConfirmedAt: "2026-07-12" }],
      ["admin@example.test"],
      ["admin-a"],
    );

    expect(result).toEqual({
      totalAuthUserCount: 1,
      currentAdminRoleCount: 1,
      currentEligibleAdminCount: 1,
      staleAdminRoleCount: 0,
      missingAdminRoleCount: 0,
    });
    expect(JSON.stringify(result)).not.toContain("admin-a");
    expect(JSON.stringify(result)).not.toContain("example.test");
  });

  it("counts stale, missing and unconfirmed transitions independently", () => {
    expect(
      summarizeAdminRoleDrift(
        [
          { id: "stale", email: "removed@example.test", emailConfirmedAt: "2026-07-12" },
          { id: "missing", email: "eligible@example.test", emailConfirmedAt: "2026-07-12" },
          { id: "unconfirmed", email: "pending@example.test", emailConfirmedAt: null },
        ],
        ["eligible@example.test", "pending@example.test"],
        ["stale", "unconfirmed"],
      ),
    ).toEqual({
      totalAuthUserCount: 3,
      currentAdminRoleCount: 2,
      currentEligibleAdminCount: 1,
      staleAdminRoleCount: 2,
      missingAdminRoleCount: 1,
    });
  });

  it("collects every counted page beyond a single PostgREST response", async () => {
    const source = Array.from({ length: 1_201 }, (_, index) => index);

    const result = await collectCountedPages(
      async (from, to) => ({
        rows: source.slice(from, to + 1),
        totalCount: source.length,
      }),
      500,
    );

    expect(result).toEqual(source);
  });

  it("fails closed when a counted source is truncated or changes during paging", async () => {
    await expect(
      collectCountedPages(
        async (from) => ({
          rows: from === 0 ? [1] : [],
          totalCount: 2,
        }),
        1,
      ),
    ).rejects.toThrow("paged_source_incomplete");

    await expect(
      collectCountedPages(
        async (from) => ({
          rows: [from],
          totalCount: from === 0 ? 2 : 3,
        }),
        1,
      ),
    ).rejects.toThrow("paged_source_count_changed");
  });
});

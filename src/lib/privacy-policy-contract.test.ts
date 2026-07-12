import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const privacyRoute = readFileSync(resolve(process.cwd(), "src/routes/privacy.tsx"), "utf8");
const retentionMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260702063847_embed_origin_analytics_v1.sql"),
  "utf8",
);

describe("public privacy and retention contract", () => {
  it("keeps public RU/UZ/EN retention numbers aligned with the active cleanup migration", () => {
    expect(retentionMigration).toContain("interval '90 days'");
    expect(retentionMigration).toContain("interval '30 days'");
    expect(retentionMigration).toContain("interval '365 days'");
    expect(retentionMigration).toContain("interval '180 days'");

    for (const value of ["90", "30", "365", "180"]) {
      expect(privacyRoute.match(new RegExp(`\\b${value}\\b`, "gu"))?.length).toBeGreaterThanOrEqual(
        3,
      );
    }
  });

  it("states raw screenshot disposal and the still-open appeal-retention decision", () => {
    expect(privacyRoute).toContain("Скриншоты обрабатываются в памяти и удаляются");
    expect(privacyRoute).toContain("Skrinshotlar xotirada qayta ishlanib o'chiriladi");
    expect(privacyRoute).toContain("Screenshots are processed in memory and discarded");
    expect(privacyRoute).toContain(
      "окончательный срок для них требует отдельного юридического решения",
    );
    expect(privacyRoute).toContain("yakuniy muddat alohida yuridik qarorni talab qiladi");
    expect(privacyRoute).toContain("final period still requires a separate legal decision");
  });

  it("keeps appeals moderated and forbids secret/document proof", () => {
    expect(privacyRoute.match(/\/appeal/gu)?.length).toBe(3);
    expect(privacyRoute).toContain("Для апелляции не отправляйте паспорт");
    expect(privacyRoute).toContain("Apellyatsiya uchun pasport");
    expect(privacyRoute).toContain("Never send a passport");
  });
});

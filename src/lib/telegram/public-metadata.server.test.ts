import { describe, expect, it } from "vitest";
import type { RunCheckResult } from "@/lib/risk/check-core";
import {
  buildTelegramPublicMetadataBrief,
  enrichTelegramPublicMetadata,
  extractTelegramPublicTarget,
  lookupTelegramPublicMetadata,
} from "@/lib/telegram/public-metadata.server";

function baseTelegramResult(overrides: Partial<RunCheckResult> = {}): RunCheckResult {
  return {
    type: "telegram",
    display: "@ui•••eb",
    level: "unknown",
    score: 5,
    reasons: ["unknown_sender"],
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
    ...overrides,
  };
}

describe("telegram public metadata", () => {
  it("extracts public usernames from mentions and t.me links", () => {
    expect(extractTelegramPublicTarget("@UiWebWeb")).toEqual({
      kind: "public_username",
      username: "UiWebWeb",
    });
    expect(extractTelegramPublicTarget("Проверь https://t.me/LX_SUPP")).toEqual({
      kind: "public_username",
      username: "LX_SUPP",
    });
    expect(extractTelegramPublicTarget("support@example.com")).toEqual({ kind: "none" });
  });

  it("classifies private invite and internal Telegram links without network lookup", () => {
    expect(extractTelegramPublicTarget("https://t.me/+fdOETKx56pozNTBi")).toEqual({
      kind: "private_invite",
      value: "+fdOETKx56pozNTBi",
    });
    expect(extractTelegramPublicTarget("https://t.me/c/123/456")).toEqual({
      kind: "internal_or_private",
      value: "c",
    });
  });

  it("builds a safe found brief without inventing reports or spam history", () => {
    const brief = buildTelegramPublicMetadataBrief(
      {
        status: "found",
        username: "public_channel",
        chat: {
          id: 1,
          type: "channel",
          username: "public_channel",
          title: "Public Channel",
          join_by_request: true,
        },
      },
      "ru",
    );

    expect(brief).toContain("Telegram: публичные данные");
    expect(brief).toContain("канал");
    expect(brief).toContain("Это не гарантия безопасности");
    expect(brief).not.toMatch(/есть жалоб|spam history known|создан недавно/i);
  });

  it("returns a helpful not-found limitation brief", async () => {
    const metadata = await lookupTelegramPublicMetadata("@UiWebWeb", async () => ({
      ok: false,
      errorCode: 400,
      description: "Bad Request: chat not found",
    }));

    expect(metadata).toEqual({ status: "not_found", username: "UiWebWeb" });
    const brief = buildTelegramPublicMetadataBrief(metadata, "ru");
    expect(brief).toContain("@UiWebWeb недоступен");
    expect(brief).toMatch(/это не доказательство скама/i);
    expect(brief).toContain("scam-label");
  });

  it("does not call getChat for private invites", async () => {
    let calls = 0;
    const metadata = await lookupTelegramPublicMetadata("https://t.me/+abcDEF123", async () => {
      calls += 1;
      return { ok: false };
    });

    expect(calls).toBe(0);
    expect(metadata.status).toBe("private_invite");
    expect(buildTelegramPublicMetadataBrief(metadata, "ru")).toContain("закрытый чат");
  });

  it("adds visible risk signals and next steps for private invite betting promos", () => {
    const brief = buildTelegramPublicMetadataBrief(
      { status: "private_invite", value: "+fdOETKx56pozNTBi" },
      "ru",
      {
        reasons: ["unknown_sender", "suspicious_invite_link", "gambling_prediction_promo"],
        knownReports: 0,
      },
    );

    expect(brief).toContain("закрытый чат/канал");
    expect(brief).toContain("Сигналы:");
    expect(brief).toContain("ставки/прогнозы/выигрыш");
    expect(brief).toContain("не оплачивайте доступ/прогнозы");
    expect(brief).not.toMatch(/создан недавно|spam.+извест|scam label есть/i);
  });

  it("adds cautious next steps for unavailable public usernames with official-looking names", () => {
    const brief = buildTelegramPublicMetadataBrief(
      { status: "not_found", username: "kapitalbank_support" },
      "ru",
      {
        reasons: ["unknown_sender", "impersonates_official"],
        knownReports: 0,
      },
    );

    expect(brief).toContain("@kapitalbank_support");
    expect(brief).toContain("поддержку/официальный аккаунт");
    expect(brief).toContain("пришлите текст/скрин");
    expect(brief).toContain("возраст аккаунта");
    expect(brief).toContain("недоступны");
    expect(brief).not.toMatch(/точно мошенник|есть scam-label/i);
  });

  it("enriches explanation without changing deterministic verdict fields", async () => {
    const result = baseTelegramResult({
      level: "suspicious",
      score: 25,
      reasons: ["suspicious_invite_link", "unknown_sender"],
    });

    const enriched = await enrichTelegramPublicMetadata("@UiWebWeb", result, "ru", async () => ({
      ok: false,
      errorCode: 400,
      description: "Bad Request: chat not found",
    }));

    expect(enriched.level).toBe(result.level);
    expect(enriched.score).toBe(result.score);
    expect(enriched.reasons).toEqual(result.reasons);
    expect(enriched.knownReports).toBe(result.knownReports);
    expect(enriched.verifiedContact).toBe(result.verifiedContact);
    expect(enriched.brandEvidence).toEqual(result.brandEvidence);
    expect(enriched.explanation).toContain("@UiWebWeb недоступен");
    expect(enriched.explanation).toContain("Сигналы:");
  });
});

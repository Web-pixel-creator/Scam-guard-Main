import { beforeEach, describe, expect, it } from "vitest";
import type { RunCheckResult } from "@/lib/risk/check-core";
import {
  __resetTelegramPublicMetadataCacheForTests,
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
  beforeEach(() => {
    __resetTelegramPublicMetadataCacheForTests();
  });

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

  it("extracts public Telegram post links without losing the post id", () => {
    expect(extractTelegramPublicTarget("https://t.me/TonZnatok/123")).toEqual({
      kind: "public_post",
      username: "TonZnatok",
      postId: "123",
    });
    expect(extractTelegramPublicTarget("https://t.me/s/TonZnatok/456")).toEqual({
      kind: "public_post",
      username: "TonZnatok",
      postId: "456",
    });
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

    expect(brief).toContain("Telegram-паспорт: @public_channel");
    expect(brief).toContain("Что видно");
    expect(brief).toContain("канал");
    expect(brief).toContain("не гарантия безопасности");
    expect(brief).not.toMatch(/есть жалоб|spam history known|создан недавно/i);
  });

  it("explains the limitation for a public Telegram post link", async () => {
    const metadata = await lookupTelegramPublicMetadata("https://t.me/TonZnatok/123", async () => ({
      ok: true,
      chat: {
        id: 3,
        type: "channel",
        username: "TonZnatok",
        title: "TON Знаток",
      },
    }));

    expect(metadata).toMatchObject({
      status: "found",
      username: "TonZnatok",
      postId: "123",
    });

    const brief = buildTelegramPublicMetadataBrief(metadata, "ru") ?? "";
    expect(brief).toContain("пост #123");
    expect(brief).toContain("если публичную web-страницу не удалось прочитать");
    expect(brief).toContain("перешлите пост");
    expect(brief).not.toMatch(/точно мошенник|создан недавно|spam.+извест/i);
  });

  it("returns a helpful not-found limitation brief", async () => {
    const metadata = await lookupTelegramPublicMetadata("@UiWebWeb", async () => ({
      ok: false,
      errorCode: 400,
      description: "Bad Request: chat not found",
    }));

    expect(metadata).toEqual({ status: "not_found", username: "UiWebWeb" });
    const brief = buildTelegramPublicMetadataBrief(metadata, "ru");
    expect(brief).toContain("Telegram-паспорт: @UiWebWeb");
    expect(brief).toContain("Bot API не видит этот username");
    expect(brief).toMatch(/это не доказательство скама/i);
    expect(brief).toContain("SCAM-метка");
  });

  it("coaches users to read Telegram native profile signals without inventing them", () => {
    const brief =
      buildTelegramPublicMetadataBrief({ status: "not_found", username: "UiWebWeb" }, "ru", {
        reasons: ["unknown_sender"],
        knownReports: 0,
      }) ?? "";

    expect(brief).toContain("Как читать профиль Telegram");
    expect(brief).toContain("Telegram может сам показать страну телефона");
    expect(brief).toContain("недавнюю смену имени/фото");
    expect(brief).toContain("просьбой дать код, деньги, карту, APK");
    expect(brief).not.toMatch(/зарегистрирован.*2026|создан недавно|скрытая SCAM-метка есть/i);
  });

  it("adds conservative username heuristics without changing the honest limitation", () => {
    const randomBrief =
      buildTelegramPublicMetadataBrief({ status: "not_found", username: "qwrtsxplm" }, "ru", {
        reasons: ["unknown_sender"],
        knownReports: 0,
      }) ?? "";

    expect(randomBrief).toContain("Признаки в username");
    expect(randomBrief).toContain("username выглядит случайным");
    expect(randomBrief).toContain("По одному username нельзя честно сказать");

    const normalBrief =
      buildTelegramPublicMetadataBrief({ status: "not_found", username: "UiWebWeb" }, "ru", {
        reasons: ["unknown_sender"],
        knownReports: 0,
      }) ?? "";

    expect(normalBrief).not.toContain("username выглядит случайным");
  });

  it("flags brand/support and promo wording as visible username clues only", () => {
    const supportBrief =
      buildTelegramPublicMetadataBrief(
        { status: "not_found", username: "kapitalbank_support" },
        "ru",
        { reasons: ["unknown_sender", "impersonates_official"], knownReports: 0 },
      ) ?? "";

    expect(supportBrief).toContain("похожи на поддержку или бренд");
    expect(supportBrief).toContain("По одному username нельзя честно сказать");

    const promoBrief =
      buildTelegramPublicMetadataBrief(
        { status: "not_found", username: "PlankaInvestBonus" },
        "ru",
        { reasons: ["unknown_sender"], knownReports: 0 },
      ) ?? "";

    expect(promoBrief).toContain("промо-тема");
    expect(promoBrief).not.toMatch(/точно мошенник|создан недавно|скрытая SCAM-метка есть/i);
  });

  it("returns unavailable quickly when public metadata lookup exceeds the soft budget", async () => {
    const startedAt = Date.now();
    const metadata = await lookupTelegramPublicMetadata(
      "@SlowPublicUser",
      () => new Promise(() => undefined),
      { timeoutMs: 5, cache: false },
    );

    expect(Date.now() - startedAt).toBeLessThan(250);
    expect(metadata).toEqual({ status: "unavailable", username: "SlowPublicUser" });
    const brief = buildTelegramPublicMetadataBrief(metadata, "ru") ?? "";
    expect(brief).toContain("Telegram-паспорт: @SlowPublicUser");
    expect(brief).toContain("не удалось запросить публичные данные");
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
    expect(brief).toContain("Репутация и признаки");
    expect(brief).toContain("ставки/прогнозы/выигрыш");
    expect(brief).toContain("Не платите за прогноз/VIP");
    expect(brief).not.toMatch(/создан недавно|spam.+извест|scam label есть/i);
  });

  it("puts the Telegram scenario before generic API limitations", () => {
    const brief =
      buildTelegramPublicMetadataBrief({ status: "private_invite", value: "+vipForecasts" }, "ru", {
        reasons: ["suspicious_invite_link", "gambling_prediction_promo"],
        knownReports: 0,
      }) ?? "";

    expect(brief).toContain("Похоже на прогнозы/VIP-ставки");
    expect(brief.indexOf("Похоже на прогнозы/VIP-ставки")).toBeLessThan(
      brief.indexOf("Telegram-паспорт invite-ссылки"),
    );
    expect(brief.indexOf("Безопасный шаг")).toBeLessThan(
      brief.indexOf("Telegram-паспорт invite-ссылки"),
    );
  });

  it("adds a casino/free-spins scenario for public Telegram channels", () => {
    const brief = buildTelegramPublicMetadataBrief(
      {
        status: "found",
        username: "casino_bonus",
        chat: {
          id: 2,
          type: "channel",
          username: "casino_bonus",
          title: "Twin bonus",
        },
      },
      "ru",
      {
        reasons: ["unknown_sender", "crypto_casino_bonus_funnel"],
        knownReports: 0,
      },
    );

    expect(brief).toContain("Похоже на казино/фриспины/депозитный бонус");
    expect(brief).toContain("Не платите за прогноз/VIP/казино-бонус");
    expect(brief).toContain("Telegram-паспорт: @casino_bonus");
    expect(brief).not.toMatch(/точно мошенник|создан недавно|spam.+извест/i);
  });

  it("adds a giveaway/captcha scenario without overclaiming Telegram internals", () => {
    const brief = buildTelegramPublicMetadataBrief(
      { status: "private_invite", value: "+giftGate" },
      "ru",
      {
        reasons: ["suspicious_invite_link", "giveaway_engagement_bait", "fake_captcha_or_voting"],
        knownReports: 0,
      },
    );

    expect(brief).toContain("Похоже на розыгрыш/NFT/Stars");
    expect(brief).toContain("капчу/голосование/реакции");
    expect(brief).toContain("не вводите кошелёк/код");
    expect(brief).toContain("содержимое, участников и скрытые жалобы");
    expect(brief).not.toMatch(/Telegram report|скрытая SCAM-метка есть|возраст аккаунта \d/i);
  });

  it("adds visible Web3 promo signals and wallet-safe next steps", () => {
    const brief = buildTelegramPublicMetadataBrief(
      { status: "private_invite", value: "+web3Promo" },
      "en",
      {
        reasons: [
          "suspicious_invite_link",
          "fake_captcha_or_voting",
          "wallet_action_urgency",
          "ton_referral_earning_scheme",
        ],
        knownReports: 0,
      },
    );

    expect(brief).toContain("closed chat/channel");
    expect(brief).toContain("captcha/voting for prize");
    expect(brief).toContain("urgent wallet action");
    expect(brief).toContain("Do not connect a wallet");
    expect(brief).not.toMatch(/account age|spam history known|scam label exists/i);
  });

  it("adds an account-takeover scenario for Telegram credential phishing", () => {
    const brief = buildTelegramPublicMetadataBrief(
      { status: "not_found", username: "telegram_cancel_support" },
      "ru",
      {
        reasons: ["unknown_sender", "telegram_account_takeover_phishing"],
        knownReports: 0,
      },
    );

    expect(brief).toContain("Похоже на попытку угона Telegram");
    expect(brief).toContain("Не вводите Telegram-код/пароль");
    expect(brief).toContain("не открывайте ссылки «cancel/delete»");
    expect(brief).toContain("Это не доказательство скама");
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
    expect(brief).toContain("пришлите сообщение/скрин");
    expect(brief).toContain("возраст аккаунта");
    expect(brief).toContain("Что недоступно");
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
    expect(enriched.explanation).toContain("Bot API не видит этот username");
    expect(enriched.explanation).toContain("подтвержд. жалоб в Ishonch Guard не найдено");
    expect(enriched.explanation).toContain("Репутация и признаки");
  });

  it("does not append generic AI text to low-signal username-only passport checks", async () => {
    const result = baseTelegramResult({
      explanation:
        "Этот контакт принадлежит неизвестному отправителю, поэтому определить уровень опасности по одному username невозможно.",
    });

    const enriched = await enrichTelegramPublicMetadata("@UiWebWeb", result, "ru", async () => ({
      ok: false,
      errorCode: 400,
      description: "Bad Request: chat not found",
    }));

    expect(enriched.explanation).toContain("📋 Telegram-паспорт: @UiWebWeb");
    expect(enriched.explanation).toContain("🛡 Репутация и признаки");
    expect(enriched.explanation).not.toContain("Этот контакт принадлежит неизвестному");
  });
});

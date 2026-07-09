import { describe, expect, it } from "vitest";
import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { bt } from "@/lib/telegram/bot-i18n";
import {
  buildLastCheckFollowUpText,
  buildLastCheckSnapshot,
  classifyLastCheckFollowUp,
} from "@/lib/telegram/check-followup";
import {
  buildEmergencyFollowUpText,
  classifyEmergencyFollowUp,
  withPanicContextData,
} from "@/lib/telegram/emergency";
import { CB, formatCheckResult, formatHelp, formatWelcome } from "@/lib/telegram/format";
import { buildForwardSourceBrief } from "@/lib/telegram/forward-context";
import {
  buildImageTriageFollowUpKeyboard,
  buildImageTriageKeyboard,
  buildImageTriageText,
  imageTriageCallback,
} from "@/lib/telegram/image-fallback";
import { buildUnsupportedMediaKeyboard } from "@/lib/telegram/handlers/misc";
import { buildTelegramPublicMetadataBrief } from "@/lib/telegram/public-metadata.server";
import type { LastCheckSnapshot, ReportDraft } from "@/lib/telegram/session.server";

const now = new Date("2026-06-07T10:00:00.000Z");

function baseResult(overrides: Partial<RunCheckResult> = {}): RunCheckResult {
  return {
    type: "text",
    display: "masked",
    level: "unknown",
    score: 5,
    reasons: [],
    explanation: null,
    knownReports: 0,
    verifiedContact: null,
    brandEvidence: [],
    ...overrides,
  };
}

function scenarioWith(snapshot: LastCheckSnapshot, extra: Partial<ReportDraft> = {}): ReportDraft {
  return { ...extra, lastCheck: snapshot };
}

function textOf(action: ReturnType<typeof classifyLastCheckFollowUp>, snapshot: LastCheckSnapshot) {
  if (action === null) return "";
  return buildLastCheckFollowUpText(action, snapshot, "ru");
}

function callbacks(keyboard: { callback_data?: string }[][]): string[] {
  return keyboard.flat().flatMap((button) => (button.callback_data ? [button.callback_data] : []));
}

function makeSnapshot(result: Partial<RunCheckResult>): LastCheckSnapshot {
  return buildLastCheckSnapshot(baseResult(result), now);
}

describe("Telegram Bot QA Matrix v1", () => {
  it("keeps the main menu actionable and compact", () => {
    const welcome = formatWelcome("ru");

    expect(callbacks(welcome.keyboard)).toEqual(
      expect.arrayContaining([
        CB.checkAnother,
        CB.emergency,
        CB.report,
        CB.safety,
        CB.showLang,
        CB.howItWorks,
        CB.digest,
        CB.trainer,
        CB.familyMenu,
      ]),
    );
    expect(formatHelp("ru")).toContain("/check");
    expect(formatHelp("ru")).toContain("/report");
    expect(formatHelp("ru")).toContain("/panic");
    expect(formatHelp("ru")).toContain("/family");
    expect(formatHelp("ru")).toContain("/digest");
    expect(formatHelp("ru")).toContain("/trainer");
    expect(formatHelp("ru")).toContain("/appeal");
  });

  it("gives a useful fallback for unsupported video and audio", () => {
    const text = bt("out_of_scope", "ru");
    const mediaTips = bt("media_capture_help", "ru");
    const keyboard = buildUnsupportedMediaKeyboard("ru");

    expect(text).toContain("не смотрю весь ролик");
    expect(text).toContain("кадр-превью");
    expect(text).toContain("аудиофайл до 60 секунд");
    expect(text).toContain("скрин кадра");
    expect(text).toContain("QR, username, реквизиты");
    expect(text).toContain("гарантированный доход");
    expect(text).toContain("что обещают");
    expect(text).toContain("что просят сделать");
    expect(mediaTips).toContain("кадр-превью");
    expect(mediaTips).toContain("не весь ролик");
    expect(callbacks(keyboard)).toEqual([CB.checkAnother, CB.emergency, CB.report, CB.mediaTips]);
  });

  it("gives unreadable images a practical triage menu instead of a dead end", () => {
    const keyboard = buildImageTriageKeyboard("ru");
    const text = buildImageTriageText("gift", "ru");

    expect(callbacks(keyboard)).toEqual([
      imageTriageCallback("gift"),
      imageTriageCallback("casino"),
      imageTriageCallback("wallet"),
      imageTriageCallback("bank"),
      imageTriageCallback("telegram_account"),
      imageTriageCallback("telegram_profile"),
      imageTriageCallback("qr_menu"),
      CB.mediaTips,
      CB.checkAnother,
      CB.emergency,
    ]);
    expect(text).toContain("Подарок");
    expect(text).toContain("капчу");
    expect(text).toContain("wallet");
    expect(text).toContain("следующего экрана");
    expect(text).not.toMatch(/точно мошенник|создан недавно|есть жалобы/i);
  });

  it("gives Telegram profile screenshots a conservative next-step triage answer", () => {
    const text = buildImageTriageText("telegram_profile", "en");

    expect(text).toContain("Telegram profile or chat");
    expect(text).toContain("clues, not proof of fraud");
    expect(text).toContain("What matters is the request");
    expect(text).toContain("code, money, card data, APK, link/QR, or urgency");
    expect(text).not.toMatch(/definitely a scammer|created recently|has reports/i);
  });

  it("gives unreadable Telegram account screenshots account-takeover guidance", () => {
    const text = buildImageTriageText("telegram_account", "en");

    expect(text).toContain("Telegram account");
    expect(text).toContain("account-takeover phishing");
    expect(text).toContain("do not tap the button or enter a code");
    expect(text).toContain("Settings");
    expect(text).toContain("Devices");
  });

  it("keeps image triage category answers compact instead of repeating the full menu", () => {
    const keyboard = buildImageTriageFollowUpKeyboard("ru");

    expect(callbacks(keyboard)).toEqual([CB.checkAnother, CB.mediaTips, CB.emergency]);
    expect(callbacks(keyboard)).not.toContain(imageTriageCallback("gift"));
    expect(callbacks(keyboard)).not.toContain(imageTriageCallback("casino"));
  });

  it("answers confidence questions after a QR/menu check instead of rechecking the phrase", () => {
    const snapshot = makeSnapshot({
      level: "safe",
      explanation: "Похоже на меню, акцию или информационный QR.",
    });

    const action = classifyLastCheckFollowUp("Точно?", scenarioWith(snapshot), now);
    const text = textOf(action, snapshot);

    expect(action).toBe("confidence");
    expect(text).toContain("Не могу гарантировать на 100%");
    expect(text).toContain("QR");
    expect(text).toContain("следующий экран");
  });

  it("answers high-risk next-step questions with safe action, not generic insufficient data", () => {
    const snapshot = makeSnapshot({
      level: "high_risk",
      reasons: ["asks_for_sms_code", "asks_to_install_apk"],
    });

    const action = classifyLastCheckFollowUp("Что еще посоветуешь?", scenarioWith(snapshot), now);
    const text = textOf(action, snapshot);

    expect(action).toBe("next_steps");
    expect(text).toContain("Следующий безопасный шаг");
    expect(text).toContain("Не сообщайте SMS-код");
    expect(text).not.toContain("Недостаточно данных");
  });

  it("answers bank-number questions with official callback guidance", () => {
    const snapshot = makeSnapshot({
      type: "phone",
      display: "+998 ** *** ** **",
      reasons: ["valid_uz_phone"],
    });

    const action = classifyLastCheckFollowUp("дай номер банка", scenarioWith(snapshot), now);
    const text = textOf(action, snapshot);

    expect(action).toBe("contacts");
    expect(text).toContain("Официальный обратный звонок");
    expect(text).toContain("Проверенные короткие номера");
    expect(text).toContain("1340");
    expect(text).not.toContain("+998 **");
  });

  it("explains the last result without exposing weights or thresholds", () => {
    const snapshot = makeSnapshot({
      level: "suspicious",
      reasons: ["suspicious_invite_link", "unknown_sender"],
    });

    const action = classifyLastCheckFollowUp("Почему так?", scenarioWith(snapshot), now);
    const text = textOf(action, snapshot);

    expect(action).toBe("explain");
    expect(text).toContain("видимые признаки риска");
    expect(text).not.toMatch(/score|threshold|порог|коэффициент|вес\s*(?:риска|=|:)/i);
  });

  it("does not swallow a new suspicious payload as a follow-up", () => {
    const snapshot = makeSnapshot({ level: "safe" });
    const context = scenarioWith(snapshot);

    expect(
      classifyLastCheckFollowUp("Точно? https://kapitalbank.uz.evil.com", context, now),
    ).toBeNull();
    expect(classifyLastCheckFollowUp("дай номер банка +998 90 123 45 67", context, now)).toBeNull();
  });

  it("keeps emergency follow-ups inside the emergency copilot context", () => {
    const apkContext = withPanicContextData({}, 2, now);
    const cardContext = withPanicContextData({}, 4, now);
    const callContext = withPanicContextData({}, 6, now);

    const more = classifyEmergencyFollowUp("Что еще посоветуешь?", apkContext, now);
    const contacts = classifyEmergencyFollowUp("дай номер банка", cardContext, now);
    const trusted = classifyEmergencyFollowUp("я пожилой человек и мне страшно", callContext, now);

    expect(more).toEqual({ action: "more", panicId: 2 });
    expect(buildEmergencyFollowUpText(more!.action, more!.panicId, "ru")).toContain("авиарежим");
    expect(contacts).toEqual({ action: "contacts", panicId: 4 });
    expect(buildEmergencyFollowUpText(contacts!.action, contacts!.panicId, "ru")).toContain(
      "официальном сайте",
    );
    expect(trusted).toEqual({ action: "trusted_person", panicId: 6 });
    expect(buildEmergencyFollowUpText(trusted!.action, trusted!.panicId, "ru")).toContain(
      "Позовите человека",
    );

    expect(
      classifyEmergencyFollowUp("Проверь https://kapitalbank.uz.evil.com", apkContext, now),
    ).toBeNull();
  });

  it("keeps Telegram public metadata cautious and non-accusatory", () => {
    const found = buildTelegramPublicMetadataBrief(
      {
        status: "found",
        username: "public_channel",
        chat: { id: 1, type: "channel", username: "public_channel", title: "Public Channel" },
      },
      "ru",
    );
    const notFound = buildTelegramPublicMetadataBrief(
      { status: "not_found", username: "UiWebWeb" },
      "ru",
    );
    const invite = buildTelegramPublicMetadataBrief(
      { status: "private_invite", value: "+fdOETKx56pozNTBi" },
      "ru",
    );

    expect(found).toContain("не гарантия безопасности");
    expect(found).not.toMatch(/есть жалоб|spam.+извест|создан недавно/i);
    expect(notFound).toMatch(/это не доказательство скама/i);
    expect(notFound).toContain("SCAM-метка");
    expect(notFound).toContain("код, деньги, карту, APK");
    expect(invite).toContain("закрытый чат/канал");
    expect(invite).toContain("не вижу");
    expect(invite).toContain("оцениваю только ссылку");
    expect(invite).toMatch(/не вводите код\/карту/i);
  });

  it("tells users what it can and cannot see for a public Telegram post link", () => {
    const post = buildTelegramPublicMetadataBrief(
      {
        status: "found",
        username: "TonZnatok",
        postId: "123",
        chat: { id: 2, type: "channel", username: "TonZnatok", title: "TON Знаток" },
      },
      "ru",
      { reasons: ["unknown_sender"], knownReports: 0 },
    );

    expect(post).toContain("пост #123");
    expect(post).toContain("если публичную web-страницу не удалось прочитать");
    expect(post).toContain("перешлите пост");
    expect(post).not.toMatch(/точно мошенник|создан недавно|spam.+извест/i);
  });

  it("keeps forwarded Telegram post mini-brief useful after formatting", () => {
    const explanation = buildForwardSourceBrief(
      { kind: "channel", title: "LUXEBET Promo", username: "luxebet_promo" },
      "ru",
      baseResult({
        reasons: ["crypto_casino_bonus_funnel", "suspicious_invite_link"],
      }),
    );

    const formatted = formatCheckResult(
      baseResult({
        level: "suspicious",
        score: 45,
        reasons: ["crypto_casino_bonus_funnel", "suspicious_invite_link"],
        explanation,
      }),
      "ru",
    );

    expect(formatted.text).toContain("Источник");
    expect(formatted.text).toContain("LUXEBET Promo");
    expect(formatted.text).toContain("Схема");
    expect(formatted.text).toContain("Цель");
    expect(formatted.text).toContain("Шаг");
    expect(formatted.text).toContain("скрытые метки");
    expect(formatted.text).not.toMatch(/создан недавно|спамит|точно мошенник/i);
  });

  it("explains what Telegram account data the bot can and cannot see", () => {
    const text = bt("meta_telegram_account_limits", "ru");

    expect(text).toContain("только видимые признаки");
    expect(text).toContain("скрытую метку SCAM");
    expect(text).toContain("возраст аккаунта");
    expect(text).toContain("сообщением или скриншотом");
    expect(text).not.toMatch(/точно мошенник|создан недавно|есть жалобы/i);
  });

  it.each(["safe", "unknown", "suspicious", "high_risk"] as const)(
    "formats %s result cards within Telegram limits and with expected actions",
    (level) => {
      const result = baseResult({
        level,
        score: level === "high_risk" ? 90 : level === "suspicious" ? 45 : 5,
        reasons:
          level === "safe"
            ? []
            : level === "unknown"
              ? ["valid_uz_phone"]
              : ["unknown_sender", "suspicious_invite_link"],
        explanation:
          level === "unknown"
            ? "Речь идет о номере телефона, но без контекста разговора точный вывод невозможен."
            : "Короткое объяснение видимых признаков.",
      });

      const formatted = formatCheckResult(result, "ru" satisfies Lang);
      const actionCallbacks = callbacks(formatted.keyboard);

      expect(formatted.text.length).toBeLessThanOrEqual(4096);
      expect(actionCallbacks).toEqual(
        expect.arrayContaining([CB.report, CB.checkAnother, CB.why, CB.explainSimple]),
      );
      if (level === "high_risk") {
        expect(actionCallbacks).toContain(CB.emergency);
      }
      if (level === "unknown") {
        expect(formatted.text).not.toMatch(/мошенник|скамер/i);
      }
    },
  );
});

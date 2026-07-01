import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalize } from "@/lib/risk/detect";
import { buildPhoneIntelligencePassport } from "@/lib/risk/phone-intelligence";
import type { ReasonCode, RiskLevel } from "@/lib/risk/rules";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { bt } from "@/lib/telegram/bot-i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import {
  CB,
  formatCheckResult,
  formatHelp,
  formatSafety,
  formatWelcome,
} from "@/lib/telegram/format";
import { formatWeeklyScamDigest } from "@/lib/telegram/digest";
import {
  buildImageUserExplanation,
  fallbackImageIntelligence,
  mergeDecodedQrEvidence,
} from "@/lib/risk/image-intelligence";
import {
  buildAskedContextFollowUpKeyboard,
  buildAskedContextKeyboardRows,
  buildAskedContextText,
  type AskedContextKind,
} from "@/lib/telegram/check-context-buttons";
import {
  buildImageTriageFollowUpKeyboard,
  buildImageTriageKeyboard,
  buildImageTriageText,
  type ImageTriageKind,
} from "@/lib/telegram/image-fallback";
import { buildTelegramPublicMetadataBrief } from "@/lib/telegram/public-metadata.server";
import {
  buildDetailedPanicScenarioText,
  buildEmergencyFollowUpKeyboard,
  buildEmergencyFollowUpText,
  buildLiveCallActiveKeyboard,
  buildLiveCallPhraseKeyboard,
  buildPanicKeyboardPage1,
  buildPanicKeyboardPage2,
  buildPanicKeyboardPage3,
  buildPanicMenuText,
  buildPanicScenarioText,
  PANIC_MENU_TITLES,
  type EmergencyFollowUpAction,
  type PanicScenarioId,
} from "@/lib/telegram/emergency";
import {
  GUARDIAN_CB,
  buildGuardianAngelIntro,
  buildGuardianAngelKeyboard,
  buildGuardianAngelText,
  type GuardianAngelAction,
  type GuardianAngelSnapshot,
} from "@/lib/telegram/guardian-angel";
import { buildGuardianVoiceOutText, buildPanicVoiceOutText } from "@/lib/telegram/voice-out.server";
import { buildTrustedAlertText } from "@/lib/telegram/family-shield.server";
import {
  reportRetryKeyboard,
  reportSkipKeyboard,
  reportValueKeyboard,
} from "@/lib/telegram/report-flow";

type Section = {
  title: string;
  text: string;
  keyboard?: InlineKeyboard;
};

const LANG = "ru" as const;
const REPORT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "ai_docs",
  "TELEGRAM_BOT_QA_REPORT.md",
);

const ASKED_KINDS: AskedContextKind[] = ["code", "card", "transfer", "apk", "link_qr", "call"];
const IMAGE_KINDS: ImageTriageKind[] = ["gift", "casino", "wallet", "bank", "qr_menu"];
const PANIC_IDS: PanicScenarioId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const FOLLOW_UP_ACTIONS: EmergencyFollowUpAction[] = ["more", "contacts", "script", "full"];
const GUARDIAN_ACTIONS: GuardianAngelAction[] = [
  GUARDIAN_CB.next,
  GUARDIAN_CB.done,
  GUARDIAN_CB.safeCall,
  GUARDIAN_CB.fullPlan,
];

function unescapeMarkdownV2(value: string): string {
  let unescaped = value;
  for (const char of "_*[]()~`>#+-=|{}.!") {
    unescaped = unescaped.replaceAll(`\\${char}`, char);
  }
  return unescaped.replaceAll("\\\\", "\\");
}

function keyboardToMarkdown(keyboard?: InlineKeyboard): string {
  if (!keyboard || keyboard.length === 0) return "_Нет кнопок._";
  return keyboard
    .map((row) =>
      row
        .map((button) => {
          const target = button.callback_data
            ? `callback: ${button.callback_data}`
            : `url: ${button.url}`;
          return `- [${button.text}] (${target})`;
        })
        .join("\n"),
    )
    .join("\n");
}

function section(title: string, text: string, keyboard?: InlineKeyboard): Section {
  return { title, text: unescapeMarkdownV2(text), keyboard };
}

function resultFixture(args: {
  type: RunCheckResult["type"];
  display: string;
  level: RiskLevel;
  score: number;
  reasons?: ReasonCode[];
  explanation?: string | null;
  knownReports?: number;
  phoneIntelligence?: RunCheckResult["phoneIntelligence"];
  phoneReputation?: RunCheckResult["phoneReputation"];
}): RunCheckResult {
  return {
    type: args.type,
    display: args.display,
    level: args.level,
    score: args.score,
    reasons: args.reasons ?? [],
    explanation: args.explanation ?? null,
    knownReports: args.knownReports ?? 0,
    verifiedContact: null,
    brandEvidence: [],
    phoneIntelligence: args.phoneIntelligence ?? null,
    phoneReputation: args.phoneReputation ?? null,
  };
}

function renderCheckResult(title: string, result: RunCheckResult): Section {
  const formatted = formatCheckResult(result, LANG);
  return section(title, formatted.text, formatted.keyboard);
}

function telegramUsernamePassportFixture(): RunCheckResult {
  return resultFixture({
    type: "telegram",
    display: "@UiWebWeb",
    level: "unknown",
    score: 5,
    reasons: ["unknown_sender"],
    explanation:
      buildTelegramPublicMetadataBrief({ status: "not_found", username: "UiWebWeb" }, LANG, {
        reasons: ["unknown_sender"],
        knownReports: 0,
      }) ?? null,
  });
}

function phonePassportFixture(): RunCheckResult {
  const raw = "+49 151 23456789";
  const normalized = normalize(raw, "phone");
  return resultFixture({
    type: "phone",
    display: raw,
    level: "unknown",
    score: 5,
    reasons: ["non_uz_phone"],
    phoneIntelligence: buildPhoneIntelligencePassport(raw, normalized, null),
  });
}

function highRiskSmsFixture(): RunCheckResult {
  return resultFixture({
    type: "text",
    display: "Мне звонят из банка и просят SMS-код",
    level: "high_risk",
    score: 95,
    reasons: ["asks_for_sms_code", "impersonates_bank", "asks_not_to_hang_up"],
    explanation:
      "Сообщение имитирует срочный запрос службы безопасности банка. Настоящий банк не просит SMS-код для отмены операции: такой код может открыть доступ к счету.",
  });
}

function cryptoInvestmentFixture(): RunCheckResult {
  return resultFixture({
    type: "text",
    display: "Новичок сделал +1.455$ за день на золоте",
    level: "unknown",
    score: 0,
    reasons: [],
    explanation:
      "Вижу тему крипто/инвестиций, но не вижу ссылки, номера, просьбы оплатить или кода. Пока это не похоже на явный скам.",
  });
}

function suspiciousInviteFixture(): RunCheckResult {
  return resultFixture({
    type: "telegram",
    display: "https://t.me/+fdOETKx56pozNTBi",
    level: "suspicious",
    score: 30,
    reasons: ["unknown_sender", "suspicious_invite_link"],
    explanation:
      "Это закрытая invite-ссылка. Сам invite не доказывает скам, но содержимое внутри мне недоступно. Безопасный шаг: не вводите Telegram-код, карту или пароль после перехода.",
  });
}

function restaurantQrFixture(): RunCheckResult {
  const evidence = mergeDecodedQrEvidence(
    fallbackImageIntelligence("Меню ресторана. QR-код для акций и бронирования."),
    {
      values: [
        "https://chenson.uz/loyalty",
        "https://chenson.uz/",
        "https://chenson.uz/locations",
        "https://t.me/chensonuz_bot",
      ],
      urls: [
        "https://chenson.uz/loyalty",
        "https://chenson.uz/",
        "https://chenson.uz/locations",
        "https://t.me/chensonuz_bot",
      ],
    },
  );

  return resultFixture({
    type: "text",
    display: "QR: ресторанное меню",
    level: "unknown",
    score: 0,
    reasons: [],
    explanation: buildImageUserExplanation(evidence, "unknown", LANG),
  });
}

function telegramLoginQrFixture(): RunCheckResult {
  const evidence = mergeDecodedQrEvidence(
    fallbackImageIntelligence("Быстрый вход по QR-коду. Подключить устройство."),
    {
      values: ["tg://login?token=SECRET_TOKEN_SHOULD_NOT_LEAK"],
      urls: ["tg://login?token=SECRET_TOKEN_SHOULD_NOT_LEAK"],
    },
  );

  return resultFixture({
    type: "text",
    display: "QR: вход в Telegram",
    level: "high_risk",
    score: 65,
    reasons: ["asks_to_scan_qr"],
    explanation: buildImageUserExplanation(evidence, "high_risk", LANG),
  });
}

function telegramProfileScreenshotFixture(): RunCheckResult {
  const evidence = fallbackImageIntelligence(
    [
      "Alina R. PlankaHub",
      "Не в контактах",
      "Страна телефона 🇺🇸 USA",
      "Регистрация Январь 2026 г.",
      "Не официальный аккаунт",
      "Пользователь обновил имя 19 дней назад",
      "Пользователь обновил фотографию 19 дней назад",
    ].join("\n"),
  );

  return resultFixture({
    type: "text",
    display: "Скрин профиля Telegram",
    level: "unknown",
    score: 0,
    reasons: [],
    explanation: buildImageUserExplanation(evidence, "unknown", LANG),
  });
}

function sections(): Section[] {
  const welcome = formatWelcome(LANG);
  const weekly = formatWeeklyScamDigest(LANG);
  const guardianSnapshot: GuardianAngelSnapshot = {
    level: "high_risk",
    type: "text",
    reasons: ["asks_for_sms_code", "impersonates_bank"],
    at: "2026-06-16T00:00:00.000Z",
  };

  const output: Section[] = [
    section("/start: главное меню", welcome.text, welcome.keyboard),
    section("/help", formatHelp(LANG)),
    section("/safety", formatSafety(LANG)),
    section("/digest: схемы недели", weekly.text, weekly.keyboard),
    section("Report: шаг 1", bt("report_ask_value", LANG), reportValueKeyboard(LANG)),
    section("Report: optional step", bt("report_ask_scam_type", LANG), reportSkipKeyboard(LANG)),
    section("Report: retry", bt("report_error", LANG), reportRetryKeyboard(LANG)),
    renderCheckResult("Risk Passport: username", telegramUsernamePassportFixture()),
    renderCheckResult("Image: скрин профиля Telegram", telegramProfileScreenshotFixture()),
    renderCheckResult("Risk Passport: иностранный номер", phonePassportFixture()),
    renderCheckResult("Risk result: инвестиции без ссылки", cryptoInvestmentFixture()),
    renderCheckResult("Risk result: закрытая Telegram invite-ссылка", suspiciousInviteFixture()),
    renderCheckResult("Risk result: SMS-код / банк", highRiskSmsFixture()),
    renderCheckResult("Image QR: ресторанное меню с прочитанными доменами", restaurantQrFixture()),
    renderCheckResult("Image QR: вход в Telegram без утечки токена", telegramLoginQrFixture()),
    section("Unsupported video/audio fallback", bt("out_of_scope", LANG), [
      [
        { text: bt("btn_check_another", LANG), callback_data: CB.checkAnother },
        { text: bt("btn_emergency", LANG), callback_data: CB.emergency },
      ],
      [
        { text: bt("btn_report", LANG), callback_data: CB.report },
        { text: bt("btn_media_tips", LANG), callback_data: CB.mediaTips },
      ],
    ]),
    section("Media tips", bt("media_capture_help", LANG), [
      [
        { text: bt("btn_check_another", LANG), callback_data: CB.checkAnother },
        { text: bt("btn_emergency", LANG), callback_data: CB.emergency },
      ],
    ]),
    section("Document/APK fallback", bt("document_safety", LANG)),
    section("Image fallback: triage menu", bt("ocr_failed", LANG), buildImageTriageKeyboard(LANG)),
  ];

  for (const kind of IMAGE_KINDS) {
    output.push(
      section(
        `Image triage: ${kind}`,
        buildImageTriageText(kind, LANG),
        buildImageTriageFollowUpKeyboard(LANG),
      ),
    );
  }

  output.push(
    section(
      "Asked-context buttons",
      "Контекстные кнопки под осторожными проверками.",
      buildAskedContextKeyboardRows(LANG),
    ),
  );
  for (const kind of ASKED_KINDS) {
    output.push(
      section(
        `Asked-context: ${kind}`,
        buildAskedContextText(kind, LANG),
        buildAskedContextFollowUpKeyboard(LANG),
      ),
    );
  }

  output.push(
    section("/panic: page 1", buildPanicMenuText(LANG), buildPanicKeyboardPage1(LANG)),
    section("/panic: page 2", buildPanicMenuText(LANG), buildPanicKeyboardPage2(LANG)),
    section("/panic: page 3", buildPanicMenuText(LANG), buildPanicKeyboardPage3(LANG)),
    section(
      "/call: active",
      `${bt("live_call_header", LANG)}\n\n${bt("live_call_hangup", LANG)}`,
      buildLiveCallActiveKeyboard(LANG),
    ),
    section(
      "Live-call: what to say",
      bt("live_call_what_to_say", LANG),
      buildLiveCallPhraseKeyboard(LANG),
    ),
    section(
      "Live-call: tell family",
      bt("live_call_tell_family", LANG),
      buildLiveCallPhraseKeyboard(LANG),
    ),
    section(
      "Guardian Angel: intro",
      buildGuardianAngelIntro(guardianSnapshot, LANG),
      buildGuardianAngelKeyboard(LANG),
    ),
    section(
      "Voice-out: Guardian Angel sample",
      buildGuardianVoiceOutText(guardianSnapshot, LANG) ?? "Нет безопасного контекста.",
      buildGuardianAngelKeyboard(LANG),
    ),
    section("Voice-out: SOS APK sample", buildPanicVoiceOutText(2, LANG)),
    section("Voice-out: SOS voice-clone sample", buildPanicVoiceOutText(11, LANG)),
  );

  for (const action of GUARDIAN_ACTIONS) {
    output.push(
      section(
        `Guardian Angel action: ${action}`,
        buildGuardianAngelText(action, guardianSnapshot, LANG),
        buildGuardianAngelKeyboard(LANG),
      ),
    );
  }

  output.push(
    section("Family Shield: menu", bt("family_menu_text", LANG), [
      [{ text: bt("family_btn_create_invite", LANG), callback_data: "family:invite" }],
      [{ text: bt("family_btn_notify", LANG), callback_data: "family:notify" }],
    ]),
    section("Family Shield: invite", bt("family_invite_text", LANG), [
      [{ text: bt("family_btn_open_invite", LANG), url: "https://t.me/share/url?...invite..." }],
      [{ text: bt("family_btn_revoke", LANG), callback_data: "family:revoke" }],
    ]),
    section("Family Shield: self-opened invite", bt("family_accept_self", LANG)),
    section("Family Shield: trusted alert", buildTrustedAlertText(LANG, "Web"), [
      [
        {
          text: bt("family_btn_trusted_stop_alerts", LANG),
          callback_data: "family:trusted_opt_out",
        },
      ],
    ]),
  );

  for (const id of PANIC_IDS) {
    output.push(
      section(
        `SOS ${id}: ${PANIC_MENU_TITLES[id][LANG]}`,
        buildPanicScenarioText(id, LANG),
        buildEmergencyFollowUpKeyboard(LANG, id),
      ),
    );
    for (const action of FOLLOW_UP_ACTIONS) {
      output.push(
        section(
          `SOS ${id}: ${action}`,
          buildEmergencyFollowUpText(action, id, LANG),
          buildEmergencyFollowUpKeyboard(LANG, id, { includeVoice: false, voiceAction: action }),
        ),
      );
    }
    output.push(
      section(`SOS ${id}: detailed full checklist`, buildDetailedPanicScenarioText(id, LANG)),
    );
  }

  return output;
}

function renderReport(items: Section[]): string {
  const lines: string[] = [
    "# Telegram Bot QA Report",
    "",
    "Generated from the current TypeScript formatters. This file is meant for product/UX review: if a bot response feels too long, generic, confusing, or unsafe here, fix the formatter and regenerate.",
    "",
    "- Language: `ru`",
    "- Scope: `/start`, `/help`, `/safety`, weekly digest, check results, media fallbacks, image triage, asked-context hints, `/panic`, `/call`, Guardian Angel, Voice-out/TTS, Family Shield, report flow.",
    "- Privacy note: samples are synthetic and contain no real user secrets.",
    "",
  ];

  items.forEach((item, index) => {
    lines.push(
      `## ${index + 1}. ${item.title}`,
      "",
      "```text",
      item.text,
      "```",
      "",
      "**Кнопки**",
      "",
    );
    lines.push(keyboardToMarkdown(item.keyboard), "");
  });

  return lines.join("\n");
}

const report = renderReport(sections());
writeFileSync(REPORT_PATH, report, "utf8");
console.log(`Telegram bot QA report written: ${REPORT_PATH}`);

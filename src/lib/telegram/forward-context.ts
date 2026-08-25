import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { redactText } from "@/lib/risk/detect";
import type { ReasonCode } from "@/lib/risk/rules";

export interface TelegramForwardSourceContext {
  kind: "channel" | "chat";
  title: string | null;
  username: string | null;
}

export interface TelegramForwardSourceInput {
  kind?: unknown;
  title?: unknown;
  username?: unknown;
}

const PUBLIC_USERNAME_RE = /^[a-zA-Z][a-zA-Z0-9_]{3,31}$/;
const MAX_TITLE_CHARS = 60;

function cleanTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = redactText(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > MAX_TITLE_CHARS ? `${cleaned.slice(0, MAX_TITLE_CHARS - 3)}...` : cleaned;
}

function cleanUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/^@/, "").trim();
  return PUBLIC_USERNAME_RE.test(cleaned) ? cleaned : null;
}

export function normalizeForwardSource(
  input: TelegramForwardSourceInput | null | undefined,
): TelegramForwardSourceContext | null {
  if (!input || (input.kind !== "channel" && input.kind !== "chat")) return null;

  const title = cleanTitle(input.title);
  const username = cleanUsername(input.username);
  if (!title && !username) return null;

  return { kind: input.kind, title, username };
}

function sourceType(source: TelegramForwardSourceContext, lang: Lang): string {
  if (source.kind === "channel") {
    if (lang === "uz") return "Telegram kanali";
    if (lang === "en") return "Telegram channel";
    return "Telegram-канал";
  }

  if (lang === "uz") return "Telegram guruhi";
  if (lang === "en") return "Telegram group";
  return "Telegram-группа";
}

function sourceName(source: TelegramForwardSourceContext, lang: Lang): string {
  const title =
    source.title && lang === "ru" ? `«${source.title}»` : source.title ? `"${source.title}"` : null;
  const username = source.username ? `@${source.username}` : null;
  return [title, username].filter(Boolean).join(" ");
}

function sourceLine(source: TelegramForwardSourceContext, lang: Lang): string {
  const type = sourceType(source, lang);
  const name = sourceName(source, lang);

  if (lang === "uz") return `Manba: ${type} ${name}.`;
  if (lang === "en") return `Source: ${type} ${name}.`;
  return `Источник: ${type} ${name}.`;
}

function hasAny(reasons: readonly ReasonCode[], codes: readonly ReasonCode[]): boolean {
  return codes.some((code) => reasons.includes(code));
}

interface ScenarioBrief {
  scheme: string;
  goal: string;
  step: string;
}

function scenarioBrief(reasons: readonly ReasonCode[], lang: Lang): ScenarioBrief | null {
  const violenceThreat = reasons.includes("threatens_physical_violence");
  const dangerousAuthorityTask = reasons.includes("authority_coerced_dangerous_act");
  const penaltyPointsFee = reasons.includes("fake_penalty_points_erasure");
  const moneyRequest = reasons.includes("asks_for_money_transfer");
  const accountTakeover = reasons.includes("telegram_account_takeover_phishing");
  const wallet = reasons.includes("wallet_action_urgency");
  const bettingOrCasino = hasAny(reasons, [
    "gambling_prediction_promo",
    "crypto_casino_bonus_funnel",
  ]);
  const giveawayOrTask = hasAny(reasons, [
    "giveaway_engagement_bait",
    "fake_captcha_or_voting",
    "task_reward_engagement_bait",
    "ton_referral_earning_scheme",
  ]);
  const credentialAction = hasAny(reasons, [
    "asks_for_sms_code",
    "asks_for_otp",
    "requests_card_digits",
    "asks_to_install_apk",
    "asks_to_scan_qr",
    "asks_to_transfer_to_safe_account",
  ]);
  const credentialOrOfficial = hasAny(reasons, [
    "asks_for_sms_code",
    "asks_for_otp",
    "requests_card_digits",
    "asks_to_install_apk",
    "asks_to_scan_qr",
    "asks_to_transfer_to_safe_account",
    "telegram_bank_contact",
    "impersonates_official",
  ]);

  if (lang === "uz") {
    if (violenceThreat) {
      return {
        scheme: "Xavf: kelish yoki jismoniy kuch ishlatish bilan tahdid.",
        goal: "Maqsad: qo'rqitib pul, uchrashuv yoki bo'ysunishga majburlash.",
        step: "Qadam: javob bermang, xavfsiz joyga o'ting va 102 ga qo'ng'iroq qiling.",
      };
    }
    if (dangerousAuthorityTask) {
      return {
        scheme: "Xavf: idora nomidan xavfli ishga majburlash.",
        goal: "Maqsad: sizni xavfli yoki noqonuniy harakatga jalb qilish.",
        step: "Qadam: talabni bajarmang, xavfsiz joyga o'ting va 102 ga qo'ng'iroq qiling.",
      };
    }
    if (penaltyPointsFee && !accountTakeover && !wallet && !credentialAction) {
      return {
        scheme: "Sxema: jarima ballarini pul evaziga o'chirish va'dasi.",
        goal: "Maqsad: norasmiy karta yoki rekvizitga pul oldirish.",
        step: "Qadam: pul yubormang; ballarni faqat rasmiy tizim orqali tekshiring.",
      };
    }
    if (accountTakeover) {
      return {
        scheme: "Sxema: Telegram akkauntini egallash.",
        goal: "Maqsad: kod, parol yoki QR-login olish.",
        step: "Qadam: kod kiritmang, QR skaner qilmang, link ochmang.",
      };
    }
    if (wallet) {
      return {
        scheme: "Sxema: Web3/hamyon tuzog'i.",
        goal: "Maqsad: tranzaksiya imzosi yoki seed phrase.",
        step: "Qadam: wallet ulamang, seed phrase kiritmang.",
      };
    }
    if (bettingOrCasino) {
      return {
        scheme: "Sxema: stavka/kazino/VIP-bonus.",
        goal: "Maqsad: prognoz, depozit yoki kirish uchun to'lov.",
        step: "Qadam: pul to'lamang, karta yoki kod kiritmang.",
      };
    }
    if (giveawayOrTask) {
      return {
        scheme: "Sxema: sovrin/NFT/Stars yoki vazifa mukofoti.",
        goal: "Maqsad: ovoz, referral, wallet yoki kodga olib borish.",
        step: "Qadam: kod/wallet bermang, keyingi ekranni yuboring.",
      };
    }
    if (credentialOrOfficial) {
      return {
        scheme: "Sxema: bank/support nomidan xavfli so'rov.",
        goal: "Maqsad: kod, karta, APK, pul yoki QR-login.",
        step: "Qadam: faqat rasmiy raqam/sayt orqali tekshiring.",
      };
    }
    if (moneyRequest) {
      return {
        scheme: "Sxema: Telegram orqali pul o'tkazish yoki to'lov so'rovi.",
        goal: "Maqsad: tekshirilmagan oluvchiga pul yubortirish.",
        step: "Qadam: pul o'tkazmang; oluvchi va sababni mustaqil tekshiring.",
      };
    }
    return null;
  }

  if (lang === "en") {
    if (violenceThreat) {
      return {
        scheme: "Danger: threat to come to you or use physical violence.",
        goal: "Goal: frighten you into paying, meeting, or complying.",
        step: "Step: do not reply; move somewhere safe and call 102.",
      };
    }
    if (dangerousAuthorityTask) {
      return {
        scheme: "Danger: claimed authority coerces a dangerous act.",
        goal: "Goal: involve you in a dangerous or illegal physical action.",
        step: "Step: do not comply; move somewhere safe and call 102.",
      };
    }
    if (penaltyPointsFee && !accountTakeover && !wallet && !credentialAction) {
      return {
        scheme: "Scheme: an offer to erase penalty points for money.",
        goal: "Goal: make you pay unofficial card or account details.",
        step: "Step: do not pay; verify points only through the official system.",
      };
    }
    if (accountTakeover) {
      return {
        scheme: "Scheme: Telegram account takeover.",
        goal: "Goal: get your code, password, or QR login.",
        step: "Step: do not enter codes, scan QR, or open links.",
      };
    }
    if (wallet) {
      return {
        scheme: "Scheme: Web3/wallet trap.",
        goal: "Goal: transaction signature or seed phrase.",
        step: "Step: do not connect a wallet or enter a seed phrase.",
      };
    }
    if (bettingOrCasino) {
      return {
        scheme: "Scheme: betting/casino/VIP-bonus funnel.",
        goal: "Goal: make you pay for prediction, deposit, or access.",
        step: "Step: do not pay or enter card/code data.",
      };
    }
    if (giveawayOrTask) {
      return {
        scheme: "Scheme: prize/NFT/Stars or task reward.",
        goal: "Goal: push you to vote, refer, connect wallet, or enter code.",
        step: "Step: do not share code/wallet; send the next screen.",
      };
    }
    if (credentialOrOfficial) {
      return {
        scheme: "Scheme: dangerous bank/support-style request.",
        goal: "Goal: code, card, APK, money, or QR login.",
        step: "Step: verify only through the official number/site.",
      };
    }
    if (moneyRequest) {
      return {
        scheme: "Scheme: a transfer or payment request through Telegram.",
        goal: "Goal: make you send money to an unverified recipient.",
        step: "Step: do not transfer; verify the recipient and reason independently.",
      };
    }
    return null;
  }

  if (violenceThreat) {
    return {
      scheme: "Опасность: угрожают приехать или применить физическую силу.",
      goal: "Цель: запугать и заставить заплатить, встретиться или подчиниться.",
      step: "Шаг: не отвечайте, перейдите в безопасное место и позвоните 102.",
    };
  }
  if (dangerousAuthorityTask) {
    return {
      scheme: "Опасность: от имени ведомства принуждают к опасному действию.",
      goal: "Цель: вовлечь вас в опасное или незаконное действие.",
      step: "Шаг: не выполняйте требование, отойдите в безопасное место и позвоните 102.",
    };
  }
  if (penaltyPointsFee && !accountTakeover && !wallet && !credentialAction) {
    return {
      scheme: "Схема: обещают за деньги удалить штрафные баллы.",
      goal: "Цель: получить оплату на неофициальную карту или реквизиты.",
      step: "Шаг: не платите; проверяйте баллы только через официальную систему.",
    };
  }
  if (accountTakeover) {
    return {
      scheme: "Схема: угон Telegram-аккаунта.",
      goal: "Цель: получить код, пароль или QR-вход.",
      step: "Шаг: не вводите код, не сканируйте QR, не открывайте ссылку.",
    };
  }
  if (wallet) {
    return {
      scheme: "Схема: Web3/кошелёк-ловушка.",
      goal: "Цель: подпись транзакции или seed phrase.",
      step: "Шаг: не подключайте wallet и не вводите seed phrase.",
    };
  }
  if (bettingOrCasino) {
    return {
      scheme: "Схема: ставки/казино/VIP-бонус.",
      goal: "Цель: оплата прогноза, депозита или доступа.",
      step: "Шаг: не платите и не вводите карту/код.",
    };
  }
  if (giveawayOrTask) {
    return {
      scheme: "Схема: приз/NFT/Stars или награда за задания.",
      goal: "Цель: привести к голосу, referral, wallet или коду.",
      step: "Шаг: не вводите код/wallet; пришлите следующий экран.",
    };
  }
  if (credentialOrOfficial) {
    return {
      scheme: "Схема: опасная просьба от имени банка/support.",
      goal: "Цель: код, карта, APK, деньги или QR-вход.",
      step: "Шаг: проверяйте только через официальный номер/сайт.",
    };
  }
  if (moneyRequest) {
    return {
      scheme: "Схема: просьба о переводе или оплате через Telegram.",
      goal: "Цель: заставить отправить деньги непроверенному получателю.",
      step: "Шаг: не переводите; независимо проверьте получателя и причину.",
    };
  }
  return null;
}

function limitsLine(lang: Lang): string {
  if (lang === "uz") {
    return "Chegara: yashirin belgilar, yosh va Telegram shikoyatlari ko'rinmaydi.";
  }
  if (lang === "en") {
    return "Limit: hidden labels, age, and Telegram reports are not visible to me.";
  }
  return "Важно: скрытые метки, возраст и жалобы Telegram мне не видны.";
}

export function buildForwardSourceBrief(
  source: TelegramForwardSourceContext | null | undefined,
  lang: Lang,
  result?: Pick<RunCheckResult, "reasons" | "knownReports">,
): string | null {
  if (!source) return null;
  const scenario = scenarioBrief(result?.reasons ?? [], lang);

  return [
    sourceLine(source, lang),
    scenario?.scheme,
    scenario?.goal,
    scenario?.step,
    limitsLine(lang),
  ]
    .filter(Boolean)
    .join("\n");
}

export function enrichForwardSourceContext(
  result: RunCheckResult,
  source: TelegramForwardSourceContext | null | undefined,
  lang: Lang,
): RunCheckResult {
  const brief = buildForwardSourceBrief(source, lang, result);
  if (!brief) return result;
  const hasScenario = scenarioBrief(result.reasons, lang) !== null;

  return {
    ...result,
    explanation: hasScenario || !result.explanation ? brief : `${brief}\n\n${result.explanation}`,
  };
}

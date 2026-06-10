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
    return "Telegram-канала";
  }

  if (lang === "uz") return "Telegram guruhi";
  if (lang === "en") return "Telegram group";
  return "Telegram-группы";
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

  if (lang === "uz") return `Manba: bu post ${type}dan yuborilgan: ${name}.`;
  if (lang === "en") return `Source: this post was forwarded from ${type}: ${name}.`;
  return `Источник: пост переслан из ${type} ${name}.`;
}

function hasAny(reasons: readonly ReasonCode[], codes: readonly ReasonCode[]): boolean {
  return codes.some((code) => reasons.includes(code));
}

function scenarioLine(reasons: readonly ReasonCode[], lang: Lang): string | null {
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
    if (accountTakeover)
      return "Ko'rinadigan belgilar Telegram akkauntini egallashga o'xshaydi: kod, parol yoki QR-login kiritmang.";
    if (wallet)
      return "Ko'rinadigan belgilar Web3/hamyon harakatiga o'xshaydi: wallet ulamang, tranzaksiya imzolamang, seed phrase kiritmang.";
    if (bettingOrCasino)
      return "Ko'rinadigan belgilar stavka/kazino/VIP-bonus voronkasiga o'xshaydi: prognoz yoki depozit uchun pul to'lamang.";
    if (giveawayOrTask)
      return "Ko'rinadigan belgilar sovrin/NFT/Stars yoki vazifa mukofotiga o'xshaydi: captcha, ovoz, referral, wallet yoki kod so'roviga ehtiyot bo'ling.";
    if (credentialOrOfficial)
      return "Ko'rinadigan belgilar xavfli so'rovga o'xshaydi: kod, karta, APK, pul yoki QR-login bermang.";
    return null;
  }

  if (lang === "en") {
    if (accountTakeover)
      return "Visible signs look like Telegram account takeover: do not enter codes, passwords, or QR login.";
    if (wallet)
      return "Visible signs look like a Web3/wallet action: do not connect a wallet, sign a transaction, or enter a seed phrase.";
    if (bettingOrCasino)
      return "Visible signs look like a betting/casino/VIP-bonus funnel: do not pay for predictions or deposits.";
    if (giveawayOrTask)
      return "Visible signs look like a prize/NFT/Stars or task-reward gate: be careful with captcha, voting, referrals, wallet, or code prompts.";
    if (credentialOrOfficial)
      return "Visible signs look like a dangerous request: do not share codes, card data, APK access, money, or QR login.";
    return null;
  }

  if (accountTakeover)
    return "По видимым признакам похоже на угон Telegram: не вводите код, пароль или QR-вход.";
  if (wallet)
    return "По видимым признакам похоже на Web3/кошелёк: не подключайте wallet, не подписывайте транзакцию и не вводите seed phrase.";
  if (bettingOrCasino)
    return "По видимым признакам похоже на ставки/казино/VIP-бонус: не платите за прогноз или депозит.";
  if (giveawayOrTask)
    return "По видимым признакам похоже на приз/NFT/Stars или награду за задания: осторожно с капчей, голосованием, referral, wallet или кодом.";
  if (credentialOrOfficial)
    return "По видимым признакам похоже на опасную просьбу: не передавайте код, карту, APK, деньги или QR-вход.";
  return null;
}

function limitsLine(lang: Lang): string {
  if (lang === "uz") {
    return "Men yashirin SCAM-belgi, akkaunt yoshi, shikoyatlar tarixi yoki kimga yozganini ko'ra olmayman.";
  }
  if (lang === "en") {
    return "I cannot see hidden SCAM labels, account age, report history, or who this source messaged.";
  }
  return "Я не вижу скрытую SCAM-метку, возраст аккаунта, историю жалоб или кому источник писал.";
}

export function buildForwardSourceBrief(
  source: TelegramForwardSourceContext | null | undefined,
  lang: Lang,
  result?: Pick<RunCheckResult, "reasons" | "knownReports">,
): string | null {
  if (!source) return null;

  return [sourceLine(source, lang), scenarioLine(result?.reasons ?? [], lang), limitsLine(lang)]
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

  return {
    ...result,
    explanation: result.explanation ? `${brief}\n\n${result.explanation}` : brief,
  };
}

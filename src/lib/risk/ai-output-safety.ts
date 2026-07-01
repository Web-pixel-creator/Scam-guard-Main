/**
 * Defensive filter for AI-authored, user-facing text.
 *
 * The risk score is deterministic, but AI may write explanations. Treat that
 * text as untrusted: prompt injection in OCR/STT/user input must never make the
 * bot ask a user to disclose secrets, install APKs, connect wallets or transfer
 * money.
 */
export interface UnsafeAiOutputFinding {
  sentence: string;
  reason:
    | "prompt_injection_leak"
    | "sensitive_data_request"
    | "payment_or_wallet_action"
    | "apk_install_action";
}

export interface AiExplanationSanitizationResult {
  text: string | null;
  finding: UnsafeAiOutputFinding | null;
}

const UNSAFE_AI_BLOCK_THRESHOLD = 2;
const UNSAFE_AI_BLOCK_WINDOW_MS = 10 * 60 * 1000;
const UNSAFE_AI_BLOCK_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_UNSAFE_AI_BLOCK_BUCKETS = 500;

interface UnsafeAiBlockBucket {
  firstBlockedAt: number;
  count: number;
  cooldownUntil: number;
}

const unsafeAiBlockBuckets = new Map<string, UnsafeAiBlockBucket>();

const PROMPT_INJECTION_LEAK_RE =
  /\b(ignore (?:previous|all) instructions|system prompt|developer message|jailbreak|you are chatgpt|act as|hidden instruction)\b|(?:игнорируй|игнорируйте)\s+(?:предыдущ|все)\s+инструкц|системн(?:ый|ого)\s+промпт|сообщени[ея]\s+разработчик|джейлбрейк/i;

const SAFE_NEGATION_RE =
  /\b(?:do not|don't|never|without|not\s+provide|not\s+send|not\s+share|not\s+enter|not\s+install|not\s+transfer|not\s+pay)\b|(?:\bне\b|\bникогда\b|\bнельзя\b|\bзапрещено\b|\bостановитесь\b|\bне\s+нужно\b|\bне\s+надо\b|\bбез\b).{0,45}(?:код|cvv|cvc|pin|пин|парол|карт|seed|сид|apk|прилож|кошел|wallet|перевод|оплат|деньг)|(?:yubormang|aytmang|kiritmang|bermang|o['’]?rnatmang|to['’]?lamang|o['’]?tkazmang)/i;

const SENSITIVE_TERM_RE =
  /\b(?:sms|otp|pin|cvv|cvc|password|passcode|seed phrase|recovery phrase|private key|card number|full card|passport)\b|смс|sms.?код|код(?:\s+из)?\s+смс|код\s+подтвержд|телеграм.?код|telegram.?код|пин|парол|сид.?фраз|seed.?фраз|мнемоническ|приватн(?:ый|ого)\s+ключ|cvv|cvc|номер\s+карт|полны[йе]\s+данн(?:ые|ых)\s+карт|фото\s+карт|паспорт|karta\s+raqam|sms.?kod|tasdiq.?kod|parol|maxfiy.?kalit/i;

const DIRECT_REQUEST_RE =
  /\b(?:send|share|enter|provide|give|show|submit|type|install|download|transfer|pay|deposit|top\s*up|connect|sign)\b|(?:пришлите|отправьте|сообщите|назовите|введите|укажите|передайте|продиктуйте|скиньте|дайте|покажите|загрузите|установите|переведите|оплатите|пополните|подключите|подпишите)|(?:yuboring|jo['’]?nating|ayting|kiriting|bering|ko['’]?rsating|o['’]?rnating|to['’]?lang|o['’]?tkazing|ulang|imzolang)/i;

const META_REQUEST_RE =
  /\b(?:ask|tell|instruct)\b.{0,80}\b(?:send|share|enter|provide|give|show|submit|type|install|download|transfer|pay|deposit|top\s*up|connect|sign)\b|(?:попроси(?:те)?|скажи(?:те)?|напиши(?:те)?|ответь(?:те)?).{0,80}(?:отправить|сообщить|назвать|ввести|указать|передать|продиктовать|установить|перевести|оплатить|пополнить|подключить|подписать)|(?:so['’]?rang|ayting).{0,80}(?:yubor|jo['’]?nat|ayt|kirit|ber|o['’]?rnat|to['’]?la|o['’]?tkaz|ula|imzola)/i;

const MONEY_OR_WALLET_TERM_RE =
  /\b(?:money|funds|safe account|deposit|fee|commission|wallet|seed phrase|connect wallet|sign transaction|transfer)\b|деньг|средств|безопасн(?:ый|ого)\s+сч[её]т|депозит|комисс|кошел|wallet|подписать\s+транзакц|seed.?фраз|hamyon|pul|to['’]?lov|komissiya|depozit/i;

const APK_TERM_RE = /\bapk\b|приложени|защитн(?:ое|ую)\s+прилож|ilova|dastur/i;

function normalizeForScan(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/ё/g, "е")
    .toLowerCase();
}

function sentenceFragments(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

function compact(text: string): string {
  return text.replace(/[\s._\-*`'’"“”()[\]{}:;|\\/]+/g, "");
}

function hasSensitiveTerm(fragment: string): boolean {
  const normalized = normalizeForScan(fragment);
  const squashed = compact(normalized);
  return (
    SENSITIVE_TERM_RE.test(normalized) ||
    /(?:smskod|smscode|otpkod|telegramkod|cvv|cvc|pin|parol|seedphrase|seedфраз|номеркарты|kartaniraqam)/i.test(
      squashed,
    )
  );
}

function hasUnsafeRequest(fragment: string): boolean {
  const normalized = normalizeForScan(fragment);
  return DIRECT_REQUEST_RE.test(normalized) || META_REQUEST_RE.test(normalized);
}

function hasMoneyOrWalletAction(fragment: string): boolean {
  const normalized = normalizeForScan(fragment);
  return (
    MONEY_OR_WALLET_TERM_RE.test(normalized) &&
    (DIRECT_REQUEST_RE.test(normalized) || META_REQUEST_RE.test(normalized))
  );
}

function hasApkInstallAction(fragment: string): boolean {
  const normalized = normalizeForScan(fragment);
  return (
    APK_TERM_RE.test(normalized) &&
    (DIRECT_REQUEST_RE.test(normalized) || META_REQUEST_RE.test(normalized))
  );
}

function isSafeWarning(fragment: string): boolean {
  return SAFE_NEGATION_RE.test(normalizeForScan(fragment));
}

export function findUnsafeAiOutput(text: string): UnsafeAiOutputFinding | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (PROMPT_INJECTION_LEAK_RE.test(trimmed)) {
    return { sentence: trimmed.slice(0, 240), reason: "prompt_injection_leak" };
  }

  for (const fragment of sentenceFragments(trimmed)) {
    if (isSafeWarning(fragment)) continue;
    if (hasSensitiveTerm(fragment) && hasUnsafeRequest(fragment)) {
      return { sentence: fragment.slice(0, 240), reason: "sensitive_data_request" };
    }
    if (hasMoneyOrWalletAction(fragment)) {
      return { sentence: fragment.slice(0, 240), reason: "payment_or_wallet_action" };
    }
    if (hasApkInstallAction(fragment)) {
      return { sentence: fragment.slice(0, 240), reason: "apk_install_action" };
    }
  }

  return null;
}

export function sanitizeAiExplanationWithFinding(
  text: string | null,
): AiExplanationSanitizationResult {
  if (text === null) return { text: null, finding: null };
  const trimmed = text.trim();
  if (!trimmed) return { text: null, finding: null };

  const finding = findUnsafeAiOutput(trimmed);
  if (finding) {
    console.warn("blocked unsafe AI explanation", finding.reason);
    return { text: null, finding };
  }

  return { text: trimmed, finding: null };
}

export function sanitizeAiExplanation(text: string | null): string | null {
  return sanitizeAiExplanationWithFinding(text).text;
}

function pruneUnsafeAiBlockBuckets(now: number): void {
  for (const [key, bucket] of unsafeAiBlockBuckets) {
    const staleWindow = bucket.firstBlockedAt + UNSAFE_AI_BLOCK_WINDOW_MS <= now;
    const staleCooldown = bucket.cooldownUntil > 0 && bucket.cooldownUntil <= now;
    if (staleWindow && staleCooldown) unsafeAiBlockBuckets.delete(key);
  }
  while (unsafeAiBlockBuckets.size > MAX_UNSAFE_AI_BLOCK_BUCKETS) {
    const oldest = unsafeAiBlockBuckets.keys().next().value as string | undefined;
    if (!oldest) break;
    unsafeAiBlockBuckets.delete(oldest);
  }
}

export function recordUnsafeAiExplanationBlock(rateLimitKey: string, now = Date.now()): void {
  pruneUnsafeAiBlockBuckets(now);
  const existing = unsafeAiBlockBuckets.get(rateLimitKey);
  const bucket =
    existing && existing.firstBlockedAt + UNSAFE_AI_BLOCK_WINDOW_MS > now
      ? existing
      : { firstBlockedAt: now, count: 0, cooldownUntil: 0 };

  bucket.count += 1;
  if (bucket.count >= UNSAFE_AI_BLOCK_THRESHOLD) {
    bucket.cooldownUntil = now + UNSAFE_AI_BLOCK_COOLDOWN_MS;
  }
  unsafeAiBlockBuckets.set(rateLimitKey, bucket);
}

export function isUnsafeAiExplanationCooldownActive(
  rateLimitKey: string,
  now = Date.now(),
): boolean {
  pruneUnsafeAiBlockBuckets(now);
  const bucket = unsafeAiBlockBuckets.get(rateLimitKey);
  if (!bucket) return false;
  if (bucket.cooldownUntil <= now) {
    if (bucket.firstBlockedAt + UNSAFE_AI_BLOCK_WINDOW_MS <= now) {
      unsafeAiBlockBuckets.delete(rateLimitKey);
    }
    return false;
  }
  return true;
}

export function resetUnsafeAiExplanationBlocksForTests(): void {
  unsafeAiBlockBuckets.clear();
}

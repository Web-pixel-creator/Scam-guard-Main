/**
 * Defensive filter for AI-authored, user-facing text.
 *
 * The risk score is deterministic, but AI may write explanations. Treat that
 * text as untrusted: prompt injection in OCR/STT/user input must never make the
 * bot ask a user to disclose secrets, install APKs, connect wallets or transfer
 * money.
 */
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";

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
  /\b(ignore (?:previous|all) instructions|system prompt|developer message|jailbreak|you are chatgpt|act as|hidden instruction)\b|(?:игнорируй|игнорируйте)\s+(?:предыдущ|все)\s+инструкц|системн(?:ый|ого)\s+промпт|сообщени[ея]\s+разработчик|джейлбрейк|\b(?:ignoriruy(?:te)?\s+(?:predydushchie|vse)\s+instruktsii|sistemn(?:yy|iy|ogo)\s+prompt|soobshcheni[eya]\s+razrabotchika|dzheylbreyk)\b/i;

const SAFE_NEGATION_RE =
  /\b(?:do not|don't|never|without|not\s+provide|not\s+send|not\s+share|not\s+enter|not\s+install|not\s+transfer|not\s+pay)\b|(?:\bне\b|\bникогда\b|\bнельзя\b|\bзапрещено\b|\bостановитесь\b|\bне\s+нужно\b|\bне\s+надо\b|\bбез\b).{0,45}(?:код|cvv|cvc|pin|пин|парол|карт|seed|сид|apk|прилож|кошел|wallet|перевод|оплат|деньг)|\b(?:ne|nikogda|nelzya|zapreshcheno|ne\s+nuzhno|ne\s+nado|bez)\b.{0,45}(?:kod|cvv|cvc|pin|parol|kart|seed|sid|apk|prilozh|koshel|wallet|perevod|oplat|deng)|(?:yubormang|aytmang|kiritmang|bermang|o['’]?rnatmang|to['’]?lamang|o['’]?tkazmang)/i;

const SENSITIVE_TERM_RE =
  /\b(?:sms|otp|pin|cvv|cvc|password|passcode|seed phrase|recovery phrase|private key|card number|full card|passport)\b|смс|sms.?код|код(?:\s+из)?\s+смс|код\s+подтвержд|телеграм.?код|telegram.?код|пин|парол|сид.?фраз|seed.?фраз|мнемоническ|приватн(?:ый|ого)\s+ключ|cvv|cvc|номер\s+карт|полны[йе]\s+данн(?:ые|ых)\s+карт|фото\s+карт|паспорт|\b(?:sms.?kod|kod(?:\s+iz)?\s+sms|kod\s+podtverzhd|telegram.?kod|parol|sid.?fraz|seed.?fraz|mnemonichesk|privatn\w*\s+klyuch|nomer\s+kart|dann\w*\s+kart|foto\s+kart|pasport|karta\s+raqam|tasdiq.?kod|maxfiy.?kalit)/i;

const DIRECT_REQUEST_RE =
  /\b(?:send|share|enter|provide|give|show|submit|type|install|download|transfer|pay|deposit|top\s*up|connect|sign)\b|(?:пришлите|отправьте|сообщите|назовите|введите|укажите|передайте|продиктуйте|скиньте|дайте|покажите|загрузите|установите|переведите|оплатите|пополните|подключите|подпишите)|(?:yuboring|jo['’]?nating|ayting|kiriting|bering|ko['’]?rsating|o['’]?rnating|to['’]?lang|o['’]?tkazing|ulang|imzolang)/i;

const RU_TRANSLIT_DIRECT_REQUEST_RE =
  /\b(?:prishli(?:te)?|otprav(?:te|i(?:te)?|lyayte)|soobshch(?:ite|i)|soobsh(?:ite|i)|nazov(?:ite|i)|vved(?:ite|i)|ukazh(?:ite|i)|pered(?:ayte|aite)|prodikt(?:uyte|uite)|skin(?:te)?|dayte|pokazh(?:ite|i)|zagruz(?:ite|i)|ustanov(?:ite|i)|pereved(?:ite|i)|oplat(?:ite|i)|popoln(?:ite|i)|podklyuch(?:ite|i)|podpis(?:hite|hi))\b/i;

const META_REQUEST_RE =
  /\b(?:ask|tell|instruct)\b.{0,80}\b(?:send|share|enter|provide|give|show|submit|type|install|download|transfer|pay|deposit|top\s*up|connect|sign)\b|(?:попроси(?:те)?|скажи(?:те)?|напиши(?:те)?|ответь(?:те)?).{0,80}(?:отправить|сообщить|назвать|ввести|указать|передать|продиктовать|установить|перевести|оплатить|пополнить|подключить|подписать)|(?:so['’]?rang|ayting).{0,80}(?:yubor|jo['’]?nat|ayt|kirit|ber|o['’]?rnat|to['’]?la|o['’]?tkaz|ula|imzola)/i;

const RU_TRANSLIT_META_REQUEST_RE =
  /\b(?:poprosi(?:te)?|skazhi(?:te)?|napishi(?:te)?|otvet(?:te|'))\b.{0,80}\b(?:otpravit|soobshchit|soobshit|nazvat|vvesti|ukazat|peredat|prodiktovat|ustanovit|perevesti|oplatit|popolnit|podklyuchit|podpisat)\b/i;

const MONEY_OR_WALLET_TERM_RE =
  /\b(?:money|funds|safe account|deposit|fee|commission|wallet|seed phrase|connect wallet|sign transaction|transfer)\b|деньг|средств|безопасн(?:ый|ого)\s+сч[её]т|депозит|комисс|кошел|wallet|подписать\s+транзакц|seed.?фраз|\b(?:deng|sredstv|bezopasn\w*\s+sch(?:e|yo|io|o)?t|depozit|komiss|koshel|podpisat\s+tranzak|tranzakts|perevod|hamyon|pul|to['’]?lov|komissiya)/i;

const APK_TERM_RE =
  /\bapk\b|приложени|защитн(?:ое|ую)\s+прилож|\b(?:prilozh|zashchitn\w*\s+prilozh|ilova|dastur)\w*/i;

const SECURITY_TOKEN_RE = /[\p{L}\p{M}\p{N}_'-]+/gu;
const LATIN_SCRIPT_RE = /\p{Script=Latin}/u;
const CYRILLIC_SCRIPT_RE = /\p{Script=Cyrillic}/u;
const LATIN_TO_CYRILLIC_SECURITY: Readonly<Record<string, string>> = Object.freeze({
  a: "а",
  c: "с",
  e: "е",
  k: "к",
  o: "о",
  p: "р",
  x: "х",
  y: "у",
});
const CYRILLIC_TO_LATIN_SECURITY: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(LATIN_TO_CYRILLIC_SECURITY).map(([latin, cyrillic]) => [cyrillic, latin]),
  ),
);

/**
 * The general intent normalizer repairs one isolated confusable. For an output
 * firewall we can safely be stricter: repair multiple minority-script letters
 * only when one script outnumbers the other at least two-to-one and every
 * minority character is a visually unambiguous mapping. This value is used for
 * matching only and is never displayed or persisted.
 */
function repairSecurityConfusables(token: string): string {
  const characters = Array.from(token);
  const latin = characters.filter((character) => LATIN_SCRIPT_RE.test(character));
  const cyrillic = characters.filter((character) => CYRILLIC_SCRIPT_RE.test(character));

  if (
    latin.length >= cyrillic.length * 2 &&
    cyrillic.length > 0 &&
    cyrillic.every((character) => CYRILLIC_TO_LATIN_SECURITY[character] !== undefined)
  ) {
    return characters
      .map((character) => CYRILLIC_TO_LATIN_SECURITY[character] ?? character)
      .join("");
  }
  if (
    cyrillic.length >= latin.length * 2 &&
    latin.length > 0 &&
    latin.every((character) => LATIN_TO_CYRILLIC_SECURITY[character] !== undefined)
  ) {
    return characters
      .map((character) => LATIN_TO_CYRILLIC_SECURITY[character] ?? character)
      .join("");
  }
  return token;
}

function normalizeForScan(text: string): string {
  return normalizeIntentTextForMatching(text)
    .replace(SECURITY_TOKEN_RE, repairSecurityConfusables)
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/ё/g, "е");
}

function sentenceFragments(text: string): string[] {
  return text
    .replace(/\r/g, "")
    .split(/(?<=[.!?。！？])\s+|\n+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

const ACTION_CLAUSE_BOUNDARY_RE =
  /\s*[;]\s*|,\s*(?=(?:and\s+then|but|however|instead|then|но|однако|зато|затем|потом|вместо\s+этого|ammo|lekin|biroq|keyin|buning\s+o['’]?rniga)\b)|\s+(?=(?:and\s+then|but|however|instead|then|но|однако|зато|затем|потом|вместо\s+этого|ammo|lekin|biroq|keyin|buning\s+o['’]?rniga)\b)/iu;

function actionFragments(text: string): string[] {
  return sentenceFragments(text).flatMap((sentence) =>
    sentence
      .split(ACTION_CLAUSE_BOUNDARY_RE)
      .map((part) => part.trim())
      .filter(Boolean),
  );
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
  return (
    DIRECT_REQUEST_RE.test(normalized) ||
    RU_TRANSLIT_DIRECT_REQUEST_RE.test(normalized) ||
    META_REQUEST_RE.test(normalized) ||
    RU_TRANSLIT_META_REQUEST_RE.test(normalized)
  );
}

function hasMoneyOrWalletAction(fragment: string): boolean {
  const normalized = normalizeForScan(fragment);
  return MONEY_OR_WALLET_TERM_RE.test(normalized) && hasUnsafeRequest(fragment);
}

function hasApkInstallAction(fragment: string): boolean {
  const normalized = normalizeForScan(fragment);
  return APK_TERM_RE.test(normalized) && hasUnsafeRequest(fragment);
}

function isSafeWarning(fragment: string): boolean {
  return SAFE_NEGATION_RE.test(normalizeForScan(fragment));
}

export function findUnsafeAiOutput(text: string): UnsafeAiOutputFinding | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (PROMPT_INJECTION_LEAK_RE.test(normalizeForScan(trimmed))) {
    return { sentence: trimmed.slice(0, 240), reason: "prompt_injection_leak" };
  }

  for (const fragment of actionFragments(trimmed)) {
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

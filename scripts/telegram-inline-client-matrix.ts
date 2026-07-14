import process from "node:process";

type ClientLanguage = "ru" | "uz" | "en" | "language-neutral";

interface InlineClientCase {
  id: string;
  language: ClientLanguage;
  query: string;
  expectation: string;
}

const BOT_MENTION = "@scamguard_bot";

function characterLength(value: string): number {
  return Array.from(value).length;
}

const CLIENT_CASES: readonly InlineClientCase[] = [
  {
    id: "INLINE-HIGH-RU",
    language: "ru",
    query: "Срочно назовите SMS-код от банка для отмены операции",
    expectation: "RU high-risk preview; inserted card starts with a stop/share-no-code action",
  },
  {
    id: "INLINE-SUSPICIOUS-RU",
    language: "ru",
    query: "Пришлите фото паспорта для подтверждения личности",
    expectation: "RU suspicious preview; no request to send the document to the bot",
  },
  {
    id: "INLINE-LOW-RU",
    language: "ru",
    query: "Мне пишет незнакомый человек",
    expectation: "RU low-signal preview asks what the person wants without inventing a verdict",
  },
  {
    id: "INLINE-HIGH-UZ",
    language: "uz",
    query: "Bank operatsiyasini bekor qilish uchun SMS kodni ayting",
    expectation: "UZ high-risk preview; inserted card says not to share the code",
  },
  {
    id: "INLINE-SUSPICIOUS-UZ",
    language: "uz",
    query: "Shaxsni tasdiqlash uchun pasport rasmini yuboring",
    expectation: "UZ suspicious preview; no request to send the document to the bot",
  },
  {
    id: "INLINE-LOW-UZ",
    language: "uz",
    query: "Menga notanish odam yozmoqda",
    expectation: "UZ low-signal preview asks for the request/context without a safe claim",
  },
  {
    id: "INLINE-HIGH-EN",
    language: "en",
    query: "Read me the SMS code to cancel the bank transfer",
    expectation: "EN high-risk preview; inserted card says not to share the code",
  },
  {
    id: "INLINE-SUSPICIOUS-EN",
    language: "en",
    query: "Send a photo of your passport for identity verification",
    expectation: "EN suspicious preview; no request to send the document to the bot",
  },
  {
    id: "INLINE-LOW-EN",
    language: "en",
    query: "A stranger is messaging me",
    expectation: "EN low-signal preview asks for the request/context without a safe claim",
  },
  {
    id: "INLINE-EMPTY",
    language: "language-neutral",
    query: "",
    expectation: "localized help result; no risk verdict",
  },
  {
    id: "INLINE-LENGTH-1",
    language: "language-neutral",
    query: "x",
    expectation: "one result or actionable low-signal prompt; no crash",
  },
  {
    id: "INLINE-LENGTH-255",
    language: "language-neutral",
    query: "x".repeat(255),
    expectation: "accepted at 255 Unicode characters; result remains bounded",
  },
  {
    id: "INLINE-LENGTH-256-UNICODE",
    language: "language-neutral",
    query: "🙂".repeat(256),
    expectation: "accepted as 256 Unicode characters instead of 512 UTF-16 code units",
  },
  {
    id: "INLINE-PRIVACY-OTP-PASSWORD",
    language: "language-neutral",
    query: 'OTP: 123456; password: "Correct-Horse-Battery-Staple"',
    expectation: "preview and inserted card contain neither synthetic credential",
  },
  {
    id: "INLINE-PRIVACY-RECOVERY",
    language: "language-neutral",
    query:
      "seed phrase: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    expectation: "preview and inserted card do not reproduce the synthetic recovery phrase",
  },
  {
    id: "INLINE-PRIVACY-MALFORMED-URL",
    language: "language-neutral",
    query: "https://%zz/reset/QA-INLINE-SECRET-TOKEN",
    expectation: "malformed URL display fails closed; token/path are absent",
  },
  {
    id: "INLINE-PRIVACY-QR-LOGIN",
    language: "language-neutral",
    query: "tg://login?token=QA_INLINE_SYNTHETIC_LOGIN_TOKEN",
    expectation: "login token is absent from preview and inserted card",
  },
];

const AUTOMATED_ONLY_CASES = [
  "257-character rejection: a real Telegram client may truncate/refuse it before the bot receives it",
  "Bot API timeout and ok:false: deterministic mocked API failure tests; do not break production networking",
  "MarkdownV2 entity-parse retry: deterministic first-failure/plaintext-retry test",
  "zero checks/session persistence and zero external fetch: real-handler sink-denial tests plus count-only production readback",
] as const;

function validateCases(): void {
  const ids = new Set<string>();
  for (const testCase of CLIENT_CASES) {
    if (ids.has(testCase.id)) throw new Error(`duplicate case id: ${testCase.id}`);
    ids.add(testCase.id);
    const length = characterLength(testCase.query);
    if (length > 256) throw new Error(`${testCase.id} exceeds 256 characters: ${length}`);
  }
}

function inlineText(query: string): string {
  return query.length === 0 ? `${BOT_MENTION} ` : `${BOT_MENTION} ${query}`;
}

function printHuman(): void {
  console.log("Telegram Inline real-client matrix (offline fixture generator; no network calls)");
  console.log("Run all 17 client cases on each of Desktop, Android and iOS: 51 client rows total.");
  console.log("Use only Saved Messages or a private non-moderator QA chat.\n");
  for (const testCase of CLIENT_CASES) {
    console.log(
      `[${testCase.id}] lang=${testCase.language} length=${characterLength(testCase.query)}`,
    );
    console.log(inlineText(testCase.query));
    console.log(`EXPECT: ${testCase.expectation}\n`);
  }
  console.log("Automated-only evidence (do not force these failures in production):");
  for (const item of AUTOMATED_ONLY_CASES) console.log(`- ${item}`);
}

function main(): void {
  validateCases();
  const args = process.argv.slice(2);
  const caseArgIndex = args.indexOf("--case");
  const caseId = caseArgIndex >= 0 ? args[caseArgIndex + 1] : undefined;
  if (caseArgIndex >= 0 && !caseId) throw new Error("--case requires a case id");

  const selected = caseId
    ? CLIENT_CASES.filter((testCase) => testCase.id === caseId)
    : CLIENT_CASES;
  if (caseId && selected.length === 0) throw new Error(`unknown case id: ${caseId}`);

  if (args.includes("--json")) {
    console.log(
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          networkCalls: 0,
          perClientCaseCount: CLIENT_CASES.length,
          totalRequiredClientRows: CLIENT_CASES.length * 3,
          cases: selected.map((testCase) => ({
            ...testCase,
            characterLength: characterLength(testCase.query),
            inlineText: inlineText(testCase.query),
          })),
          automatedOnly: AUTOMATED_ONLY_CASES,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (caseId) {
    console.log(inlineText(selected[0].query));
    return;
  }
  printHuman();
}

main();

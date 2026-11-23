import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Lang } from "@/lib/i18n";
import type { SensitiveSecretClass } from "@/lib/risk/sensitive-text";
import type { HandlerCtx } from "@/lib/telegram/router";

const boundary = vi.hoisted(() => ({
  sendMessage: vi.fn(),
  sendChatAction: vi.fn(),
  getFile: vi.fn(),
  downloadFileAsDataUrl: vi.fn(),
  runCheck: vi.fn(),
  saveSession: vi.fn(),
  checkSharedRateLimit: vi.fn(),
  database: vi.fn(() => {
    throw new Error("unexpected database access in offline voice boundary test");
  }),
  consumeConsent: vi.fn(),
  assertTransfer: vi.fn(),
}));

// Crucially, STT is real. Mocking its redacted return value is exactly the
// coverage gap this suite guards against. Only the later scoring/storage sink
// is intercepted so a routing failure cannot persist a synthetic secret.
vi.mock("@/lib/risk/check-core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/risk/check-core")>()),
  runCheck: boundary.runCheck,
}));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { from: boundary.database, rpc: boundary.database },
}));
vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: boundary.checkSharedRateLimit,
}));
vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: boundary.sendMessage,
  sendChatAction: boundary.sendChatAction,
  getFile: boundary.getFile,
  downloadFileAsDataUrl: boundary.downloadFileAsDataUrl,
  getChatInfo: vi.fn(),
  escapeMarkdownV2: (text: string) => text,
}));
vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: boundary.saveSession,
  loadSession: vi.fn(),
  resetScenario: vi.fn(),
  withSessionChatScope: (
    data: Record<string, unknown> | undefined,
    chatId: number,
    chatType = "private",
  ) => ({ ...data, chatScope: { chatId, chatType } }),
}));
vi.mock("@/lib/telegram/media-provider-consent.server", () => ({
  consumeMediaProviderConsent: boundary.consumeConsent,
  assertMediaProviderTransferAllowed: boundary.assertTransfer,
  isMediaProviderConsentStorageError: (error: unknown) =>
    error instanceof Error && error.message === "media_provider_consent_storage",
  requestMediaProviderConsent: (ctx: HandlerCtx) =>
    boundary.sendMessage({ chatId: ctx.chatId, text: "provider consent required" }),
  sendMediaProviderConsentFailure: vi.fn(),
}));

import { transcribeVoiceCore } from "@/lib/risk/check-core";
import {
  __resetTelegramCheckCachesForTests,
  __telegramCheckCacheStatsForTests,
  handleVoice,
} from "./check";

type Provider = "gemini" | "compatible";
const PROVIDERS = ["gemini", "compatible"] as const;
const DATA_URL = `data:audio/ogg;base64,${Buffer.from("synthetic offline audio").toString("base64")}`;
const MODEL = "offline-stt-test";
const API_KEY = "synthetic-stt-boundary-not-a-real-key";
const META = {
  fileSize: 128,
  duration: 8,
  mimeType: "audio/ogg",
  fileUniqueId: "offline-voice-boundary",
};
const RESULT = {
  type: "text",
  display: "synthetic offline result",
  level: "unknown",
  score: 0,
  reasons: [],
  explanation: null,
  knownReports: 0,
  verifiedContact: null,
  brandEvidence: [],
};

interface SecretFixture {
  id: string;
  lang: Lang;
  text: string;
  values: readonly string[];
  classes: readonly SensitiveSecretClass[];
  title: string;
  action: string;
}

// Hand-authored independent expectations, not labels obtained from the same
// detector under test. Values are synthetic fixtures, never valid credentials.
const SECRETS: readonly SecretFixture[] = [
  {
    id: "ru-sms",
    lang: "ru",
    text: "СМС-код: 731946",
    values: ["731946"],
    classes: ["code"],
    title: "Код скрыт",
    action: "проверьте операцию",
  },
  {
    id: "uz-pin",
    lang: "uz",
    text: "PIN: 4826",
    values: ["4826"],
    classes: ["code"],
    title: "Kod yashirildi",
    action: "operatsiyani tekshiring",
  },
  {
    id: "en-otp",
    lang: "en",
    text: "OTP: 619284",
    values: ["619284"],
    classes: ["code"],
    title: "Code hidden",
    action: "inspect the operation",
  },
  {
    id: "uz-sms-alphanumeric",
    lang: "uz",
    text: "SMS kod: UZ74AB",
    values: ["UZ74AB"],
    classes: ["code"],
    title: "Kod yashirildi",
    action: "operatsiyani tekshiring",
  },
  {
    id: "ru-password",
    lang: "ru",
    text: "пароль: SyntheticVoiceRu42",
    values: ["SyntheticVoiceRu42"],
    classes: ["password"],
    title: "Пароль скрыт",
    action: "завершите другие сессии",
  },
  {
    id: "uz-password",
    lang: "uz",
    text: "parol: SyntheticVoiceUz42",
    values: ["SyntheticVoiceUz42"],
    classes: ["password"],
    title: "Parol yashirildi",
    action: "sessiyalarni yoping",
  },
  {
    id: "en-password",
    lang: "en",
    text: ["password", ["Synthetic", "Voice", "En42"].join("")].join(": "),
    values: ["SyntheticVoiceEn42"],
    classes: ["password"],
    title: "Password hidden",
    action: "revoke other sessions",
  },
  {
    id: "ru-recovery",
    lang: "ru",
    text: "сид-фраза: apple bicycle candle dragon eagle forest garden harbor island jungle kitten lemon",
    values: ["apple bicycle candle", "jungle kitten lemon"],
    classes: ["recovery_phrase"],
    title: "Сид-фраза скрыта",
    action: "создайте новый кошелёк",
  },
  {
    id: "uz-recovery",
    lang: "uz",
    text: "tiklash iborasi: anchor blossom copper dolphin ember feather galaxy hazel ivory jasmine kernel lotus",
    values: ["anchor blossom copper", "jasmine kernel lotus"],
    classes: ["recovery_phrase"],
    title: "Tiklash iborasi yashirildi",
    action: "yangi hamyon yarating",
  },
  {
    id: "en-recovery",
    lang: "en",
    text: "recovery phrase: maple nectar olive pebble quartz river silver timber umber velvet willow xenon",
    values: ["maple nectar olive", "velvet willow xenon"],
    classes: ["recovery_phrase"],
    title: "Recovery phrase hidden",
    action: "create a new wallet",
  },
  {
    id: "ru-private-key",
    lang: "ru",
    text: "приватный ключ: SYNTHETIC_NOT_A_REAL_PRIVATE_KEY_42",
    values: ["SYNTHETIC_NOT_A_REAL_PRIVATE_KEY_42"],
    classes: ["private_key"],
    title: "Приватный ключ скрыт",
    action: "создайте новый кошелёк",
  },
  {
    id: "en-private-key",
    lang: "en",
    text: "private key: SYNTHETIC_NOT_A_REAL_PRIVATE_KEY_84",
    values: ["SYNTHETIC_NOT_A_REAL_PRIVATE_KEY_84"],
    classes: ["private_key"],
    title: "Private key hidden",
    action: "create a new wallet",
  },
  {
    id: "uz-token",
    lang: "uz",
    text: "access token: SYNTHETIC_NOT_A_REAL_ACCESS_TOKEN_42",
    values: ["SYNTHETIC_NOT_A_REAL_ACCESS_TOKEN_42"],
    classes: ["access_token"],
    title: "Kirish tokeni yashirildi",
    action: "darhol bekor qiling",
  },
  {
    id: "en-token",
    lang: "en",
    text: "api key: SYNTHETIC_NOT_A_REAL_ACCESS_TOKEN_84",
    values: ["SYNTHETIC_NOT_A_REAL_ACCESS_TOKEN_84"],
    classes: ["access_token"],
    title: "Access token hidden",
    action: "revoke it immediately",
  },
  {
    id: "mixed-password-code",
    lang: "en",
    text: `${["password", ["Synthetic", "Mixed", "Voice42"].join("")].join(": ")}\nOTP: 764829`,
    values: ["SyntheticMixedVoice42", "764829"],
    classes: ["password", "code"],
    title: "Password hidden",
    action: "revoke other sessions",
  },
  {
    id: "en-otp-cyrillic-homoglyph",
    lang: "en",
    // Final label character is Cyrillic U+0420, not ASCII P.
    text: "OTР: 742981",
    values: ["742981"],
    classes: ["code"],
    title: "Code hidden",
    action: "inspect the operation",
  },
  {
    id: "en-cvv",
    lang: "en",
    text: "CVV: 748",
    values: ["748"],
    classes: ["code"],
    title: "Code hidden",
    action: "inspect the operation",
  },
  {
    id: "en-grouped-value-first-pin",
    lang: "en",
    text: "84 26 PIN",
    values: ["84 26"],
    classes: ["code"],
    title: "Code hidden",
    action: "inspect the operation",
  },
  {
    id: "en-secret-after-transcript-clip",
    lang: "en",
    // A readable benign prefix longer than the core's 2,000-character limit.
    // Detection must precede clipping, otherwise this secret reaches cache.
    text: `${"An ordinary delivery update. ".repeat(80)}OTP: 764218`,
    values: ["764218"],
    classes: ["code"],
    title: "Code hidden",
    action: "inspect the operation",
  },
];

const BENIGN: ReadonlyArray<{ id: string; lang: Lang; text: string }> = [
  { id: "ru-no-value", lang: "ru", text: "Просят назвать код из СМС, но сам код здесь не указан." },
  { id: "uz-no-value", lang: "uz", text: "SMS kod so'rashyapti, lekin kodni bu yerga yozmadim." },
  {
    id: "en-no-value",
    lang: "en",
    text: "Someone asks for my verification code but there is no value in this message.",
  },
  { id: "en-guidance", lang: "en", text: "Never share your password with anyone." },
  { id: "en-code-reference-no-value", lang: "en", text: "I read out the one-time password" },
  { id: "ru-order", lang: "ru", text: "Номер заказа 482619, доставка завтра после обеда." },
  {
    id: "uz-order",
    lang: "uz",
    text: "Buyurtma raqami 573819, yetkazib berish ertaga tushdan keyin.",
  },
  {
    id: "en-phone",
    lang: "en",
    text: "The invoice lists phone +998901234567 and delivery on Monday.",
  },
  {
    id: "en-pre-redacted",
    lang: "en",
    text: "The verification code is •••• and no original value is present.",
  },
];

let unexpectedNetworkAttempts = 0;
let responseFactory: () => Promise<Response>;
let fetchMock: ReturnType<typeof vi.fn>;
let logSpies: Array<ReturnType<typeof vi.spyOn>>;

function context(lang: Lang = "en"): HandlerCtx {
  return {
    userId: 90421,
    chatId: 90422,
    session: {
      telegramUserId: 90421,
      lang,
      scenario: "none",
      scenarioStep: 0,
      scenarioData: {},
      updatedAt: new Date(0).toISOString(),
    },
  };
}

function providerResponse(provider: Provider, text: string, extra: object = {}): Response {
  return Response.json(
    provider === "gemini"
      ? { candidates: [{ content: { parts: [{ text }] } }], ...extra }
      : { text, ...extra },
  );
}

function configureProvider(provider: Provider, text: string, extra: object = {}): void {
  vi.stubEnv("OPENAI_API_KEY", API_KEY);
  vi.stubEnv("OPENAI_MODEL", MODEL);
  vi.stubEnv("OPENAI_TRANSCRIBE_MODEL", MODEL);
  vi.stubEnv(
    "OPENAI_BASE_URL",
    provider === "gemini"
      ? "https://generativelanguage.googleapis.com/v1beta/openai"
      : "https://stt.invalid/v1",
  );
  responseFactory = async () => providerResponse(provider, text, extra);
  const expectedUrl =
    provider === "gemini"
      ? `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`
      : "https://stt.invalid/v1/audio/transcriptions";
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    // No real fetch is saved or called. Any unexpected endpoint, retry target,
    // method or transfer policy fails even if the production core swallows it.
    if (String(input) !== expectedUrl || init?.method !== "POST" || init.redirect !== "error") {
      unexpectedNetworkAttempts += 1;
      throw new Error("unexpected network attempt in offline STT boundary test");
    }
    return responseFactory();
  });
  vi.stubGlobal("fetch", fetchMock);
}

function sentText(): string {
  return boundary.sendMessage.mock.calls.map(([message]) => String(message.text)).join("\n");
}

function assertSecretSinksClosed(fixture: SecretFixture): void {
  expect(boundary.runCheck).not.toHaveBeenCalled();
  expect(boundary.saveSession).not.toHaveBeenCalled();
  expect(__telegramCheckCacheStatsForTests().voiceTranscriptSize).toBe(0);
  expect(sentText()).toContain(fixture.title);
  expect(sentText()).toContain(fixture.action);
  expect(
    boundary.sendMessage.mock.calls.some(([message]) =>
      JSON.stringify(message.keyboard ?? []).includes("voice_correct"),
    ),
  ).toBe(true);
  const sinks = JSON.stringify({
    messages: boundary.sendMessage.mock.calls,
    sessions: boundary.saveSession.mock.calls,
    checks: boundary.runCheck.mock.calls,
    logs: logSpies.map((spy) => spy.mock.calls),
  });
  for (const value of fixture.values) expect(sinks).not.toContain(value);
  expect(sinks).not.toContain(fixture.text);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  __resetTelegramCheckCachesForTests();
  unexpectedNetworkAttempts = 0;
  boundary.getFile.mockResolvedValue({ filePath: "synthetic/voice.oga", fileSize: 128 });
  boundary.downloadFileAsDataUrl.mockResolvedValue(DATA_URL);
  boundary.runCheck.mockResolvedValue(RESULT);
  boundary.saveSession.mockResolvedValue(undefined);
  boundary.checkSharedRateLimit.mockResolvedValue({ ok: true, remaining: 4, retryAfterSec: 0 });
  boundary.consumeConsent.mockResolvedValue("consumed");
  boundary.assertTransfer.mockResolvedValue(undefined);
  logSpies = ["info", "warn", "error", "debug", "log"].map((method) =>
    vi.spyOn(console, method as "info").mockImplementation(() => undefined),
  );
  vi.stubEnv("TELEGRAM_TIMING_LOGS", "1");
  // Fail closed even if a new test forgets to configure its provider stub.
  configureProvider("compatible", "");
});

afterEach(() => {
  expect(unexpectedNetworkAttempts).toBe(0);
  expect(boundary.database).not.toHaveBeenCalled();
  __resetTelegramCheckCachesForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe.each(PROVIDERS)("actual %s STT → voice secret boundary", (provider) => {
  it.each(SECRETS)(
    "keeps $id in the class-specific local route after redaction",
    async (fixture) => {
      configureProvider(provider, fixture.text);
      await handleVoice("offline-file", context(fixture.lang), META);
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(boundary.assertTransfer).toHaveBeenCalledOnce();
      assertSecretSinksClosed(fixture);

      // Also pin the cross-layer contract: safe text plus locally derived enum
      // metadata. The provider response is never authoritative for these fields.
      const result = await transcribeVoiceCore(DATA_URL, fixture.lang, "tg:90421");
      expect(result).toEqual({ text: "••••", secretClasses: fixture.classes });
      for (const value of fixture.values) expect(JSON.stringify(result)).not.toContain(value);
    },
  );

  it.each(BENIGN)("does not manufacture a secret value for $id", async (fixture) => {
    configureProvider(provider, fixture.text, { secretClasses: ["private_key", "access_token"] });
    const result = await transcribeVoiceCore(DATA_URL, fixture.lang, "tg:90421");
    expect(result).toEqual({ text: expect.any(String), secretClasses: [] });
    await handleVoice("offline-file", context(fixture.lang), META);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sentText()).not.toMatch(
      /(?:Code|Password|Private key|Access token|Recovery phrase) hidden/,
    );
    expect(sentText()).not.toMatch(/(?:Код|Пароль|Приватный ключ|Сид-фраза) скрыт/);
    expect(sentText()).not.toMatch(/(?:Kod|Parol|Kirish tokeni|Tiklash iborasi) yashirildi/);
    expect(__telegramCheckCacheStatsForTests().voiceTranscriptSize).toBe(1);
  });

  it("ignores a provider attempt to remove locally detected code metadata", async () => {
    const fixture = SECRETS[2]!;
    configureProvider(provider, fixture.text, { secretClasses: [], safe: true });
    const result = await transcribeVoiceCore(DATA_URL, "en", "tg:90421");
    expect(result).toEqual({ text: "••••", secretClasses: ["code"] });
    await handleVoice("offline-file", context(), META);
    assertSecretSinksClosed(fixture);
  });

  it("does not cache a redacted secret-bearing recording for a later update", async () => {
    const fixture = SECRETS[2]!;
    configureProvider(provider, fixture.text);
    await handleVoice("offline-file", context(), META);
    await handleVoice("offline-file-again", context(), META);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(boundary.downloadFileAsDataUrl).toHaveBeenCalledTimes(2);
    assertSecretSinksClosed(fixture);
  });

  it("shares only the safe secret summary during one in-flight STT request", async () => {
    const fixture = SECRETS[2]!;
    configureProvider(provider, fixture.text);
    let release!: (response: Response) => void;
    responseFactory = () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      });
    const first = handleVoice("offline-file", context(), META);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const second = handleVoice("offline-file-again", context(), META);
    await vi.waitFor(() => expect(boundary.consumeConsent).toHaveBeenCalledTimes(2));
    release(providerResponse(provider, fixture.text));
    await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(boundary.downloadFileAsDataUrl).toHaveBeenCalledOnce();
    assertSecretSinksClosed(fixture);
    expect(sentText().split(fixture.title)).toHaveLength(3);
  });

  it.each(["missing", "stale", "storage"])(
    "does no download/STT with %s consent",
    async (state) => {
      configureProvider(provider, SECRETS[2]!.text);
      boundary.consumeConsent.mockResolvedValue(state);
      await handleVoice("offline-file", context(), META);
      expect(boundary.getFile).not.toHaveBeenCalled();
      expect(boundary.downloadFileAsDataUrl).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(boundary.runCheck).not.toHaveBeenCalled();
      expect(boundary.saveSession).not.toHaveBeenCalled();
    },
  );

  it("revalidates the lease at the actual provider boundary after download", async () => {
    configureProvider(provider, SECRETS[2]!.text);
    boundary.assertTransfer.mockRejectedValue(new Error("media_provider_consent_storage"));
    await expect(handleVoice("offline-file", context(), META)).rejects.toThrow(
      "media_provider_consent_storage",
    );
    expect(boundary.downloadFileAsDataUrl).toHaveBeenCalledOnce();
    expect(boundary.assertTransfer).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(boundary.runCheck).not.toHaveBeenCalled();
    expect(boundary.saveSession).not.toHaveBeenCalled();
  });
});

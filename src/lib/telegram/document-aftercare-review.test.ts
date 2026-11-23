import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Lang } from "@/lib/i18n";

const state = vi.hoisted(() => ({
  sent: [] as Array<{ text: string }>,
  answers: [] as Array<{
    results: Array<{ id: string; input_message_content: { message_text: string } }>;
  }>,
  patches: [] as Array<{ scenarioData?: { lastVictimIntent?: { kind: string } } }>,
  externalAttempts: 0,
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("Unexpected database access");
      },
    },
  ),
}));
vi.mock("@/lib/risk/shared-rate-limit.server", () => ({
  checkSharedRateLimit: async () => ({ ok: true, remaining: 9, retryAfterSec: 0 }),
}));
vi.mock("@/lib/telegram/api.server", () => ({
  sendMessage: async (message: (typeof state.sent)[number]) => {
    state.sent.push(message);
    return { ok: true };
  },
  answerInlineQuery: async (answer: (typeof state.answers)[number]) => {
    state.answers.push(answer);
    return { ok: true };
  },
  sendChatAction: async () => undefined,
  getFile: async () => {
    throw new Error("Unexpected media request");
  },
  downloadFileAsDataUrl: async () => {
    throw new Error("Unexpected media download");
  },
  escapeMarkdownV2: (text: string) => text,
}));
vi.mock("@/lib/telegram/session.server", () => ({
  saveSession: async (_userId: number, patch: (typeof state.patches)[number]) => {
    state.patches.push(patch);
    return { ok: true };
  },
  withSessionChatScope: (data: unknown, chatId: number, chatType = "private") => ({
    ...(data as Record<string, unknown>),
    chatScope: { chatId, chatType },
  }),
}));
vi.mock("@/lib/telegram/family-shield.server", () => ({
  notifyTrustedContact: async () => {
    throw new Error("Unexpected trusted-contact notification");
  },
}));
vi.mock("@/lib/telegram/public-post.server", () => ({
  buildTelegramPublicPostCheckEvidence: async () => null,
  enrichTelegramPublicPostResult: (result: unknown) => result,
}));
vi.mock("@/lib/telegram/public-metadata.server", () => ({
  enrichTelegramPublicMetadata: async (_input: string, result: unknown) => result,
}));
vi.mock("@/lib/telegram/reputation.server", () => ({
  enrichTelegramReputation: async (_input: string, result: unknown) => result,
}));
vi.mock("@/lib/risk/check-core", async (importOriginal) => {
  const core = await importOriginal<typeof import("@/lib/risk/check-core")>();
  return {
    ...core,
    // Retain the real deterministic core; forbid providers and persistence.
    runCheck: (input: Parameters<typeof core.runCheck>[0]) =>
      core.runCheck({
        ...input,
        persist: false,
        skipAi: true,
        skipUrlReputation: true,
      }),
  };
});

import { handleCheck } from "@/lib/telegram/handlers/check";
import { handleInlineQuery } from "@/lib/telegram/handlers/inline";
import {
  classifyVictimIntent,
  hasCompletedPersonalDataDisclosure,
} from "@/lib/telegram/victim-intent";

const cases: Array<{ lang: Lang; text: string; aftercare: boolean }> = [
  { lang: "ru", text: "Я вчера вечером отправила паспорт незнакомцу.", aftercare: true },
  {
    lang: "ru",
    text: "Я по глупости отправил фото паспорта незнакомому человеку.",
    aftercare: true,
  },
  { lang: "en", text: "I stupidly sent my passport photo to a stranger.", aftercare: true },
  { lang: "en", text: "I have just now sent my passport to a stranger.", aftercare: true },
  { lang: "ru", text: "Я паспорт свой отправил незнакомцу.", aftercare: true },
  { lang: "ru", text: "Мой паспорт я вчера вечером отправил незнакомцу.", aftercare: true },
  { lang: "en", text: "My passport, I accidentally sent to a stranger.", aftercare: true },
  { lang: "ru", text: "Я отправил коллеге документ с расписанием встреч.", aftercare: false },
  { lang: "ru", text: "Я загрузила рабочий документ на общий диск.", aftercare: false },
  { lang: "ru", text: "Документ я отправил коллеге.", aftercare: false },
  { lang: "en", text: "I sent the transaction ID to customer support.", aftercare: false },
  { lang: "en", text: "I sent my order ID to customer support.", aftercare: false },
  { lang: "uz", text: "Men hamkasbimga loyiha hujjatini yubordim.", aftercare: false },
  {
    lang: "ru",
    text: "Я отправил коллеге документ с расписанием встреч. Я отправил паспорт незнакомцу.",
    aftercare: true,
  },
  {
    lang: "en",
    text: "I sent the transaction ID to support. I sent my passport to a stranger.",
    aftercare: true,
  },
  {
    lang: "uz",
    text: "Men hamkasbimga loyiha hujjatini yubordim. Men pasportimni notanish odamga yubordim.",
    aftercare: true,
  },
  { lang: "ru", text: "Я отправил рабочий документ и паспорт незнакомцу.", aftercare: true },
  { lang: "en", text: "I sent the transaction ID and my passport to a stranger.", aftercare: true },
  {
    lang: "uz",
    text: "Men loyiha hujjatini va pasportimni notanish odamga yubordim.",
    aftercare: true,
  },
  { lang: "en", text: "I sent my ID to a stranger.", aftercare: true },
  { lang: "en", text: "I sent my tax ID to a stranger.", aftercare: true },
  { lang: "ru", text: "Я отправил личные документы незнакомцу.", aftercare: true },
  { lang: "uz", text: "Men shaxsiy hujjatimni notanish odamga yubordim.", aftercare: true },
  { lang: "ru", text: "Я вчера вечером не отправила паспорт незнакомцу.", aftercare: false },
  { lang: "en", text: "I almost sent my passport photo to a stranger.", aftercare: false },
  {
    lang: "en",
    text: "I have just now refused to send my passport to a stranger.",
    aftercare: false,
  },
  { lang: "ru", text: "Я по ошибке отправил не паспорт, а рабочую анкету.", aftercare: false },
  { lang: "en", text: "I accidentally sent not my passport but a blank form.", aftercare: false },
  { lang: "uz", text: "Men pasportimni emas ish hujjatini yubordim.", aftercare: false },
  { lang: "en", text: "I just now sent not only my passport but my tax ID too.", aftercare: true },
  { lang: "ru", text: "Я отправил не только паспорт, а ещё и ПИНФЛ незнакомцу.", aftercare: true },
  { lang: "ru", text: "Мой паспорт я вчера вечером не отправил незнакомцу.", aftercare: false },
  { lang: "en", text: "My passport, I almost sent to a stranger.", aftercare: false },
  {
    lang: "ru",
    text: "Незнакомец сказал, что я вчера вечером отправила паспорт.",
    aftercare: false,
  },
  { lang: "en", text: "A stranger claims that I stupidly sent my passport.", aftercare: false },
  { lang: "en", text: "If I stupidly sent my passport, what would happen?", aftercare: false },
  { lang: "uz", text: "U men shaxsiy hujjatimni yubordim deb aytyapti.", aftercare: false },
  { lang: "ru", text: "Я вчера вечером отправил отказ предоставить паспорт.", aftercare: false },
  { lang: "en", text: "I just now sent a refusal to share my passport.", aftercare: false },
  {
    lang: "ru",
    text: "Я вчера вечером загрузила паспорт через официальное приложение моего банка.",
    aftercare: false,
  },
  {
    lang: "en",
    text: "I just now uploaded my passport through my bank's official app.",
    aftercare: false,
  },
];

beforeEach(() => {
  state.sent.length = 0;
  state.answers.length = 0;
  state.patches.length = 0;
  state.externalAttempts = 0;
  globalThis.fetch = (async () => {
    state.externalAttempts += 1;
    throw new Error("External network forbidden in document review");
  }) as typeof fetch;
});

describe("bounded document aftercare review regressions", () => {
  it.each(cases)("$aftercare: $text", async ({ lang, text, aftercare }) => {
    const ctx = {
      userId: 42,
      chatId: 42,
      chatType: "private" as const,
      session: {
        telegramUserId: 42,
        lang,
        scenario: "none" as const,
        scenarioStep: 0,
        scenarioData: {},
        updatedAt: new Date(0).toISOString(),
      },
    };
    // Exercise both adapters before asserting classifier expectations so RED
    // evidence contains the actual composed routing result as well.
    await handleCheck(text, ctx);
    await handleInlineQuery(text, ctx, "document-review");
    const evidence = JSON.stringify({
      sent: state.sent,
      answers: state.answers,
      patches: state.patches,
    });
    expect(hasCompletedPersonalDataDisclosure(text), evidence).toBe(aftercare);
    expect(classifyVictimIntent(text)?.kind === "personal_data_already_shared", evidence).toBe(
      aftercare,
    );
    expect(state.answers).toHaveLength(1);
    expect(state.answers[0].results[0].id.includes("personal-data-aftercare"), evidence).toBe(
      aftercare,
    );
    expect(
      state.patches.some(
        (patch) => patch.scenarioData?.lastVictimIntent?.kind === "personal_data_already_shared",
      ),
      evidence,
    ).toBe(aftercare);
    expect(state.externalAttempts).toBe(0);
  });
});

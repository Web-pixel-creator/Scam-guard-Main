import type { Lang } from "@/lib/i18n";
import type { PanicScenarioId } from "@/lib/telegram/emergency";

type VoiceSttReplayExpectation =
  | { kind: "panic"; panicId: PanicScenarioId }
  | { kind: "normal_check" };

export interface VoiceSttProviderReplayFixture {
  id: string;
  lang: Lang;
  transcript: string;
  sourceKind: "synthetic_provider_like" | "provider_sanitized_transcript";
  expectation: VoiceSttReplayExpectation;
  note: string;
}

export type VoiceSttPanicReplayFixture = VoiceSttProviderReplayFixture & {
  expectation: { kind: "panic"; panicId: PanicScenarioId };
};

export type VoiceSttNormalReplayFixture = VoiceSttProviderReplayFixture & {
  expectation: { kind: "normal_check" };
};

export const VOICE_STT_PROVIDER_REPLAY_FIXTURES: readonly VoiceSttProviderReplayFixture[] = [
  {
    id: "ru-card-back-digits",
    lang: "ru",
    transcript: "Я продиктовала три цифры с оборота карты",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 4 },
    note: "Card back digits should route to card-data SOS, not generic unknown.",
  },
  {
    id: "ru-card-security-code",
    lang: "ru",
    transcript: "Я уже назвала код безопасности карты",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 4 },
    note: "Card security code should win before generic SMS-code routing.",
  },
  {
    id: "ru-remote-access",
    lang: "ru",
    transcript: "Я установил AnyDesk и дал доступ к экрану",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 2 },
    note: "Remote-access app plus screen permission is APK/remote-access SOS.",
  },
  {
    id: "ru-telegram-login-qr",
    lang: "ru",
    transcript: "Я отсканировала QR для входа в Telegram",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 5 },
    note: "Telegram login QR should route to account-takeover SOS.",
  },
  {
    id: "uz-card-back-digits",
    lang: "uz",
    transcript: "Men kartaning orqasidagi uch raqamni aytdim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 4 },
    note: "Uzbek card back digits should route to card-data SOS.",
  },
  {
    id: "uz-remote-access",
    lang: "uz",
    transcript: "Men AnyDesk ilovasini o'rnatdim va ekranga ruxsat berdim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 2 },
    note: "Uzbek AnyDesk/screen-access phrase should route to remote-access SOS.",
  },
  {
    id: "uz-telegram-login-qr",
    lang: "uz",
    transcript: "Men Telegram QR kodini skaner qildim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 5 },
    note: "Uzbek Telegram QR scan should route to account-takeover SOS.",
  },
  {
    id: "uz-cyrillic-sms-code",
    lang: "uz",
    transcript: "Мен SMS кодни юбордим",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 1 },
    note: "Uzbek Cyrillic already-sent SMS code should route to OTP SOS.",
  },
  {
    id: "uz-cyrillic-money-transfer",
    lang: "uz",
    transcript: "Мен пулни картага ўтказдим",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 3 },
    note: "Uzbek Cyrillic already-transferred money should route to transfer SOS.",
  },
  {
    id: "uz-cyrillic-live-call",
    lang: "uz",
    transcript: "Ҳозир менга банкдан қўнғироқ қилишяпти",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 6 },
    note: "Uzbek Cyrillic active-call wording should route to live-call SOS.",
  },
  {
    id: "en-sms-code",
    lang: "en",
    transcript: "I sent the SMS code to the caller",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 1 },
    note: "English already-sent SMS code should route to OTP SOS.",
  },
  {
    id: "en-card-back-digits",
    lang: "en",
    transcript: "I gave the three digits on the back of my card",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 4 },
    note: "English card-back wording should route to card-data SOS.",
  },
  {
    id: "en-remote-access",
    lang: "en",
    transcript: "I installed AnyDesk and allowed screen access",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 2 },
    note: "English remote-access app plus screen access should route to SOS.",
  },
  {
    id: "en-money-transfer",
    lang: "en",
    transcript: "I transferred money to their card",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 3 },
    note: "English already-transferred money should route to transfer SOS.",
  },
  {
    id: "en-telegram-login-qr",
    lang: "en",
    transcript: "I scanned the Telegram login QR code",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 5 },
    note: "English Telegram login QR should route before generic code routing.",
  },
  {
    id: "en-live-call",
    lang: "en",
    transcript: "I am on the phone with the bank caller right now",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 6 },
    note: "English active-call wording should route to live-call SOS.",
  },
  {
    id: "ru-not-sent-code",
    lang: "ru",
    transcript: "Я не отправила SMS-код",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Negated Russian code phrase must not open already-happened SOS.",
  },
  {
    id: "ru-not-card-digits",
    lang: "ru",
    transcript: "Я не продиктовал три цифры с оборота карты",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Negated Russian card phrase must not open already-happened SOS.",
  },
  {
    id: "ru-not-telegram-qr",
    lang: "ru",
    transcript: "Я не сканировал QR для входа в Telegram",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Negated Russian Telegram QR phrase must not open SOS.",
  },
  {
    id: "uz-not-sent-code",
    lang: "uz",
    transcript: "Men SMS kod yubormadim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Negated Uzbek code phrase must not open SOS.",
  },
  {
    id: "uz-cyrillic-not-sent-code",
    lang: "uz",
    transcript: "Мен SMS код юбормадим",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Negated Uzbek Cyrillic code phrase must not open already-happened SOS.",
  },
  {
    id: "en-not-sent-code",
    lang: "en",
    transcript: "I did not send the SMS code",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Negated English code phrase must not open already-happened SOS.",
  },
  {
    id: "en-not-telegram-qr",
    lang: "en",
    transcript: "I didn't scan the Telegram QR",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Negated English Telegram QR phrase must not open SOS.",
  },
  {
    id: "en-not-card-digits",
    lang: "en",
    transcript: "I have not given the three digits on the back of my card",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Negated English card phrase must not open SOS.",
  },
];

export function isVoiceSttPanicReplayFixture(
  fixture: VoiceSttProviderReplayFixture,
): fixture is VoiceSttPanicReplayFixture {
  return fixture.expectation.kind === "panic";
}

export function isVoiceSttNormalReplayFixture(
  fixture: VoiceSttProviderReplayFixture,
): fixture is VoiceSttNormalReplayFixture {
  return fixture.expectation.kind === "normal_check";
}

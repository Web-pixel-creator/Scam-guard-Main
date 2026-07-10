import type { Lang } from "@/lib/i18n";
import type { PanicScenarioId } from "@/lib/telegram/emergency";

type VoiceSttReplayExpectation =
  | { kind: "panic"; panicId: PanicScenarioId }
  | { kind: "normal_check" }
  | { kind: "negated_ack" };

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

export type VoiceSttNegatedAckReplayFixture = VoiceSttProviderReplayFixture & {
  expectation: { kind: "negated_ack" };
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
    id: "uz-live-sms-code-telegram-001",
    lang: "uz",
    transcript: "Men SMS kodni yubardim.",
    sourceKind: "provider_sanitized_transcript",
    expectation: { kind: "panic", panicId: 1 },
    note: "Captured from live Telegram human voice note through production STT provider; sanitized transcript only. Provider rendered yubordim as yubardim.",
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
    id: "en-live-call-tts-001",
    lang: "en",
    transcript: "I am on the phone with a bank caller right now.",
    sourceKind: "provider_sanitized_transcript",
    expectation: { kind: "panic", panicId: 6 },
    note: "Captured from local Windows TTS audio through production STT provider; sanitized transcript only.",
  },
  {
    id: "ru-not-sent-code",
    lang: "ru",
    transcript: "Я не отправила SMS-код",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Negated Russian code phrase must not open already-happened SOS.",
  },
  {
    id: "ru-live-not-sent-code-telegram-001",
    lang: "ru",
    transcript: "Я не отправляла SMS-код",
    sourceKind: "provider_sanitized_transcript",
    expectation: { kind: "negated_ack" },
    note: "Captured from live Telegram human voice note through production STT provider; sanitized transcript only. Negated Russian code phrase must not open SOS.",
  },
  {
    id: "ru-not-card-digits",
    lang: "ru",
    transcript: "Я не продиктовал три цифры с оборота карты",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Negated Russian card phrase must not open already-happened SOS.",
  },
  {
    id: "ru-not-telegram-qr",
    lang: "ru",
    transcript: "Я не сканировал QR для входа в Telegram",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Negated Russian Telegram QR phrase must not open SOS.",
  },
  {
    id: "uz-not-sent-code",
    lang: "uz",
    transcript: "Men SMS kod yubormadim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Negated Uzbek code phrase must not open SOS.",
  },
  {
    id: "uz-live-not-sent-code-telegram-001",
    lang: "uz",
    transcript: "Men SMS-kod yubormadim.",
    sourceKind: "provider_sanitized_transcript",
    expectation: { kind: "negated_ack" },
    note: "Captured from live Telegram human voice note through production STT provider; sanitized transcript only. Hyphenated SMS-kod plus final punctuation must stay out of already-happened SOS.",
  },
  {
    id: "uz-live-not-sent-code-telegram-002",
    lang: "uz",
    transcript: "Men esa SMS-kod yubormadim.",
    sourceKind: "provider_sanitized_transcript",
    expectation: { kind: "negated_ack" },
    note: "Captured from live Telegram human voice note through production STT provider; sanitized transcript only. Filler word `esa` must receive a calm no-code acknowledgement, not generic insufficient-data.",
  },
  {
    id: "uz-sms-code-object-first",
    lang: "uz",
    transcript: "SMS kodni aytib berdim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 1 },
    note: "Object-first Uzbek OTP wording should route to sent-code SOS.",
  },
  {
    id: "uz-telegram-code-sent",
    lang: "uz",
    transcript: "Men Telegram kodini aytdim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 1 },
    note: "Telegram code without QR wording is still an already-shared-code emergency.",
  },
  {
    id: "uz-app-sms-permission",
    lang: "uz",
    transcript: "Men ilovani o'rnatdim va SMSga ruxsat berdim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 2 },
    note: "Installed app plus SMS permission should route to remote-access/APK SOS.",
  },
  {
    id: "uz-anydesk-screen-access",
    lang: "uz",
    transcript: "Men AnyDesk uchun ekranga ruxsat berdim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 2 },
    note: "AnyDesk plus screen permission should route to remote-access SOS.",
  },
  {
    id: "uz-card-money-transfer",
    lang: "uz",
    transcript: "Men karta orqali pul o'tkazdim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 3 },
    note: "Already transferred money by card should route to transfer SOS.",
  },
  {
    id: "uz-balance-topup",
    lang: "uz",
    transcript: "Men balansga pul yubordim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 3 },
    note: "Balance top-up / money sent wording should route to transfer SOS.",
  },
  {
    id: "uz-card-number-entered",
    lang: "uz",
    transcript: "Men karta raqamini kiritdim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 4 },
    note: "Entered card number should route to card-data SOS.",
  },
  {
    id: "uz-pin-code-shared",
    lang: "uz",
    transcript: "Men PIN kodni aytib berdim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 4 },
    note: "Shared PIN code should route to card-data/PIN SOS.",
  },
  {
    id: "uz-telegram-login-qr-long",
    lang: "uz",
    transcript: "Men Telegram login QR kodini skaner qildim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 5 },
    note: "Telegram login QR should route to account-takeover SOS.",
  },
  {
    id: "uz-telegram-cannot-login",
    lang: "uz",
    transcript: "Telegram akkauntimga kira olmayapman",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 5 },
    note: "Cannot log into Telegram should route to account-takeover SOS.",
  },
  {
    id: "uz-operator-calling-now",
    lang: "uz",
    transcript: "Menga hozir operatordan qo'ng'iroq qilyapti",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 6 },
    note: "Active operator call should route to live-call SOS.",
  },
  {
    id: "uz-relative-urgent-money-call",
    lang: "uz",
    transcript: "Menga akam qo'ng'iroq qildi, shoshilinch pul so'radi",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 6 },
    note: "Short Uzbek loved-one distress call should route to live-call SOS.",
  },
  {
    id: "uz-operator-sim-block-call",
    lang: "uz",
    transcript: "Menga Beeline operatori telefon qildi, raqam bloklanadi deyapti",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 6 },
    note: "Short Uzbek operator/SIM-blocking call should route to live-call SOS.",
  },
  {
    id: "uz-government-soliq-code-call",
    lang: "uz",
    transcript: "Menga Soliqdan qo'ng'iroq qildi, SMS kod so'radi",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 6 },
    note: "Short Uzbek Soliq/government call with code request should route to live-call SOS.",
  },
  {
    id: "uz-relative-sister-car-urgent-transfer-call",
    lang: "uz",
    transcript:
      "Menga singlim qo'ng'iroq qilyapti. U mashinasi bilan muammo bo'lib qolganini aytib, zudlik bilan pul o'tkazishimni so'rayapti.",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "panic", panicId: 6 },
    note: "Longer Uzbek loved-one distress call should route to live-call SOS.",
  },
  {
    id: "uz-channel-admin-sms-code-request",
    lang: "uz",
    transcript: "Kanal administratori menga yozmoqda. U mendan SMS kodini yuborishimni so'rayapti.",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Channel admin asking for SMS code is checked by runCheck, not emergency-routing.",
  },
  {
    id: "uz-not-transfer-money",
    lang: "uz",
    transcript: "Men pul o'tkazmadim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Negated money-transfer phrase should get calm acknowledgement, not transfer SOS.",
  },
  {
    id: "uz-not-confirm-telegram-login",
    lang: "uz",
    transcript: "Men Telegram kirishini tasdiqlamadim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Negated confirmation wording should not open Telegram-account SOS.",
  },
  {
    id: "uz-will-not-send-code",
    lang: "uz",
    transcript: "Men kod yubormayman",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Future/intention negative wording should receive calm safety acknowledgement.",
  },
  {
    id: "uz-will-not-give-card-data",
    lang: "uz",
    transcript: "Men karta ma'lumotlarini bermayman",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Future/intention card-data refusal should receive calm safety acknowledgement.",
  },
  {
    id: "uz-suspicious-gift-link",
    lang: "uz",
    transcript: "Menga sovg'a yutdingiz deb havola yuborishdi",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Suspicious but not already-happened voice text should continue to runCheck.",
  },
  {
    id: "uz-delivery-card-payment-request",
    lang: "uz",
    transcript: "Dostavka uchun karta orqali to'lov qilishni so'rashyapti",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Requested payment should be scored by runCheck, not routed as already-paid SOS.",
  },
  {
    id: "uz-short-thanks",
    lang: "uz",
    transcript: "Rahmat, tushundim",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "normal_check" },
    note: "Benign conversational phrase should not route to emergency or negated-done flow.",
  },
  {
    id: "uz-cyrillic-not-sent-code",
    lang: "uz",
    transcript: "Мен SMS код юбормадим",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Negated Uzbek Cyrillic code phrase must not open already-happened SOS.",
  },
  {
    id: "en-not-sent-code",
    lang: "en",
    transcript: "I did not send the SMS code",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Negated English code phrase must not open already-happened SOS.",
  },
  {
    id: "en-not-sent-code-tts-001",
    lang: "en",
    transcript: "I did not send the SMS code.",
    sourceKind: "provider_sanitized_transcript",
    expectation: { kind: "negated_ack" },
    note: "Captured from local Windows TTS audio through production STT provider; sanitized transcript only.",
  },
  {
    id: "en-not-telegram-qr",
    lang: "en",
    transcript: "I didn't scan the Telegram QR",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
    note: "Negated English Telegram QR phrase must not open SOS.",
  },
  {
    id: "en-not-card-digits",
    lang: "en",
    transcript: "I have not given the three digits on the back of my card",
    sourceKind: "synthetic_provider_like",
    expectation: { kind: "negated_ack" },
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

export function isVoiceSttNegatedAckReplayFixture(
  fixture: VoiceSttProviderReplayFixture,
): fixture is VoiceSttNegatedAckReplayFixture {
  return fixture.expectation.kind === "negated_ack";
}

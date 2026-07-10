# UZ Voice QA Matrix

Date: 2026-07-05

Purpose: regression coverage for Uzbek Voice-in flows after live Telegram STT
language drift (`Men SMS kod yubormadim` -> `Men SMS-kort, jo, hvorfor med dem`)
and negated-code UX fixes.

The committed matrix lives in
`src/lib/telegram/voice-stt-provider-fixtures.ts` and is exercised by
`src/lib/telegram/handlers/check.voice.test.ts`.

## Scope

- UI language and spoken language are separate. Users may keep the bot UI in
  Russian while speaking Uzbek.
- Voice auto-SOS is only for immediate/already-happened situations: sent code,
  installed app/remote access, transferred money, entered/shared card data,
  scanned Telegram login QR/lost Telegram, or active suspicious call.
- Suspicious but not yet completed requests continue into `runCheck`.
- Raw audio, Telegram file IDs and provider payloads are not committed.

## Matrix

| ID                                 | Transcript                                                 |     Expected | Status | Note                                             |
| ---------------------------------- | ---------------------------------------------------------- | -----------: | ------ | ------------------------------------------------ |
| uz-live-sms-code-telegram-001      | `Men SMS kodni yubardim.`                                  |      panic:1 | Pass   | Live provider rendered `yubordim` as `yubardim`. |
| uz-sms-code-object-first           | `SMS kodni aytib berdim`                                   |      panic:1 | Pass   | Object-first OTP wording.                        |
| uz-telegram-code-sent              | `Men Telegram kodini aytdim`                               |      panic:1 | Pass   | Telegram code without QR is still code-sharing.  |
| uz-app-sms-permission              | `Men ilovani o'rnatdim va SMSga ruxsat berdim`             |      panic:2 | Pass   | Regression: must not be misrouted to panic:1.    |
| uz-anydesk-screen-access           | `Men AnyDesk uchun ekranga ruxsat berdim`                  |      panic:2 | Pass   | Remote screen access.                            |
| uz-card-money-transfer             | `Men karta orqali pul o'tkazdim`                           |      panic:3 | Pass   | Money already transferred.                       |
| uz-balance-topup                   | `Men balansga pul yubordim`                                |      panic:3 | Pass   | Balance/top-up wording.                          |
| uz-card-back-digits                | `Men kartaning orqasidagi uch raqamni aytdim`              |      panic:4 | Pass   | CVV/back-of-card wording.                        |
| uz-card-number-entered             | `Men karta raqamini kiritdim`                              |      panic:4 | Pass   | Card number entered.                             |
| uz-pin-code-shared                 | `Men PIN kodni aytib berdim`                               |      panic:4 | Pass   | PIN shared.                                      |
| uz-telegram-login-qr               | `Men Telegram QR kodini skaner qildim`                     |      panic:5 | Pass   | Telegram QR scan.                                |
| uz-telegram-login-qr-long          | `Men Telegram login QR kodini skaner qildim`               |      panic:5 | Pass   | Explicit login QR.                               |
| uz-telegram-cannot-login           | `Telegram akkauntimga kira olmayapman`                     |      panic:5 | Pass   | Account takeover/lost access.                    |
| uz-cyrillic-live-call              | Uzbek Cyrillic active-call wording                         |      panic:6 | Pass   | Cyrillic replay fixture.                         |
| uz-operator-calling-now            | `Menga hozir operatordan qo'ng'iroq qilyapti`              |      panic:6 | Pass   | Active call.                                     |
| uz-live-not-sent-code-telegram-001 | `Men SMS-kod yubormadim.`                                  |  negated_ack | Pass   | Live negated code phrase.                        |
| uz-live-not-sent-code-telegram-002 | `Men esa SMS-kod yubormadim.`                              |  negated_ack | Pass   | Filler word before object.                       |
| uz-not-transfer-money              | `Men pul o'tkazmadim`                                      |  negated_ack | Pass   | Negated transfer.                                |
| uz-not-confirm-telegram-login      | `Men Telegram kirishini tasdiqlamadim`                     |  negated_ack | Pass   | Negated confirmation.                            |
| uz-will-not-send-code              | `Men kod yubormayman`                                      |  negated_ack | Pass   | Future/intention refusal.                        |
| uz-will-not-give-card-data         | `Men karta ma'lumotlarini bermayman`                       |  negated_ack | Pass   | Future/intention refusal for card data.          |
| uz-suspicious-gift-link            | `Menga sovg'a yutdingiz deb havola yuborishdi`             | normal_check | Pass   | Not already happened; let risk engine score it.  |
| uz-delivery-card-payment-request   | `Dostavka uchun karta orqali to'lov qilishni so'rashyapti` | normal_check | Pass   | Requested payment, not already paid.             |
| uz-short-thanks                    | `Rahmat, tushundim`                                        | normal_check | Pass   | Benign speech; no emergency route.               |

## Live Retest Shortlist

Use these in production Telegram after deploy when validating real STT:

1. `Men SMS kod yubormadim`
2. `Men kod yubormayman`
3. `Men ilovani o'rnatdim va SMSga ruxsat berdim`
4. `Men karta orqali pul o'tkazdim`
5. `Men Telegram login QR kodini skaner qildim`
6. `Menga hozir operatordan qo'ng'iroq qilyapti`

Expected: no generic "not enough data" card for the first two; panic routes for
3-6.

## Residual Risk

STT still cannot be guaranteed for every Uzbek voice note. Short clips, accent,
noise, mixed Russian/Uzbek/English, and poor microphones can still produce bad
transcripts. The bot therefore keeps the "Correct text" button visible and the
replay corpus should grow from sanitized live transcripts.

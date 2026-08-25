# Real-Client Acceptance Plan — Telegram Direct/Inline (2026-08)

Status at writing: **Inline formal pack 1/51** (1 Desktop row of
17 cases × 3 platforms). This plan defines the risk-based real-client
acceptance for Telegram Desktop, Android and iOS in RU/UZ/EN. It does not
replace the automated suites (15,327 offline tests); it proves what only real
clients can prove: rendering, truncation, buttons, insertion, keyboard/voice
flows and recovery on real devices.

## How to execute

1. Use production `@scamguard_bot` on each real client, one language at a time.
2. Inline rows: generate the exact 17-case pack with
   `npm run qa:telegram-inline-client-matrix` and paste each query into the
   client's Inline field.
3. Direct rows: copy inputs from the referenced corpus/test sources listed per
   scenario (they are the exact strings proven by the offline suites). Do not
   retype from memory.
4. Record one row per (scenario × platform): pass/fail, app and OS version,
   sanitized screenshot (no real numbers, codes, usernames or links).
5. Log results in a dated file `ai_docs/CLIENT_ACCEPTANCE_RESULTS_<date>.md`;
   never commit user data.

## Inline matrix (17 cases × 3 platforms = 51 rows)

Case IDs (from `scripts/telegram-inline-client-matrix.ts`):
`INLINE-HIGH-RU`, `INLINE-SUSPICIOUS-RU`, `INLINE-LOW-RU`, `INLINE-HIGH-UZ`,
`INLINE-SUSPICIOUS-UZ`, `INLINE-LOW-UZ`, `INLINE-HIGH-EN`,
`INLINE-SUSPICIOUS-EN`, `INLINE-LOW-EN`, `INLINE-EMPTY`, `INLINE-LENGTH-1`,
`INLINE-LENGTH-255`, `INLINE-LENGTH-256-UNICODE`,
`INLINE-PRIVACY-OTP-PASSWORD`, `INLINE-PRIVACY-RECOVERY`,
`INLINE-PRIVACY-MALFORMED-URL`, `INLINE-PRIVACY-QR-LOGIN`.

Per row verify: preview renders with the safe action visible; inserted result
keeps the topic and the first action; no secret echo; no invented verdict on
low-signal rows; truncation behaves at the documented boundary.

| #   | Case IDs              | Desktop           | Android | iOS |
| --- | --------------------- | ----------------- | ------- | --- |
| 1   | HIGH-RU               | done (2026-07-14) | —       | —   |
| 2   | SUSPICIOUS-RU         | —                 | —       | —   |
| 3   | LOW-RU                | —                 | —       | —   |
| 4   | HIGH-UZ               | —                 | —       | —   |
| 5   | SUSPICIOUS-UZ         | —                 | —       | —   |
| 6   | LOW-UZ                | —                 | —       | —   |
| 7   | HIGH-EN               | —                 | —       | —   |
| 8   | SUSPICIOUS-EN         | —                 | —       | —   |
| 9   | LOW-EN                | —                 | —       | —   |
| 10  | EMPTY                 | —                 | —       | —   |
| 11  | LENGTH-1              | —                 | —       | —   |
| 12  | LENGTH-255            | —                 | —       | —   |
| 13  | LENGTH-256-UNICODE    | —                 | —       | —   |
| 14  | PRIVACY-OTP-PASSWORD  | —                 | —       | —   |
| 15  | PRIVACY-RECOVERY      | —                 | —       | —   |
| 16  | PRIVACY-MALFORMED-URL | —                 | —       | —   |
| 17  | PRIVACY-QR-LOGIN      | —                 | —       | —   |

## Direct risk-based scenarios

Expected outcome classes reference the deterministic routes (risk level,
reason family and the concrete safe action). Inputs marked "corpus" must be
copied from the referenced file; examples shown here are the verified corpus
strings.

| ID   | Lang     | Scenario (input source)                                                                                                                                        | Expected outcome                                                                                                                                                                     |
| ---- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D-01 | RU       | Completed code share — `Я уже отправил код из SMS.` (`text-panic-intent.test.ts`)                                                                              | aftercare: terminate sessions, 2FA, no blame                                                                                                                                         |
| D-02 | EN       | Completed CVV share — `I already sent my CVV.` (`text-panic-intent.test.ts`)                                                                                   | card aftercare: block, bank official number                                                                                                                                          |
| D-03 | UZ       | Completed transfer — `Men pul o'tkazdim.` (`text-panic-intent.test.ts`)                                                                                        | sent-money aftercare, bank first                                                                                                                                                     |
| D-04 | EN       | Remote access granted — `I installed AnyDesk and allowed screen access.` (`text-panic-intent.test.ts`)                                                         | uninstall, bank call, device check                                                                                                                                                   |
| D-05 | RU       | QR login scanned — `Я отсканировал QR для входа в Telegram.` (`text-panic-intent.test.ts`)                                                                     | Telegram takeover aftercare                                                                                                                                                          |
| D-06 | RU       | Live bank call pressure — `Мне сейчас звонят из банка.` (`text-panic-intent.test.ts`)                                                                          | live-call SOS: hang up, call official number                                                                                                                                         |
| D-07 | RU       | Wrong-recipient transfer — `я перевела деньги не тому человеку, можно отменить перевод?` (`victim-intent.test.ts`)                                             | accidental transfer: bank recall guidance, not scam panic                                                                                                                            |
| D-08 | RU       | Mistaken phone top-up — `По ошибке оплатила чужой номер телефона вместо своего. Можно отменить?` (`victim-intent.test.ts`)                                     | accidental top-up route                                                                                                                                                              |
| D-09 | EN       | Top-up cancel — `I topped up someone else's phone by mistake—how can I cancel it?` (`victim-intent.test.ts`)                                                   | accidental top-up route                                                                                                                                                              |
| D-10 | RU       | Money-mule bait — `мне пришли деньги по ошибке и просят вернуть их на другую карту` (`victim-intent.test.ts`)                                                  | money-mule warning: do not forward                                                                                                                                                   |
| D-11 | RU       | Balance top-up pressure — `я уже пополнил баланс` (`live-phrase-cases.ts`)                                                                                     | scam top-up route, NOT accidental-transfer guard                                                                                                                                     |
| D-12 | RU       | Safe neighbor video control — `сосед прислал обычное mp4 из галереи, мы заранее договаривались` (`victim-intent.test.ts`)                                      | safe/low: no false archive warning                                                                                                                                                   |
| D-13 | UZ       | Photo-threat negative control — `Sayohat rasmlarimni oilaviy guruhga tarqatishadi deb aytishdi.` (`victim-intent.test.ts`)                                     | no blackmail verdict without money demand                                                                                                                                            |
| D-14 | RU/UZ/EN | Active OTP request, APK push, task-scam «зарплата → налог», BNPL чужая рассрочка, OneID phishing, known-contact gift link, coercive secrecy, fine APK cashback | corpus: `adversarial-human-scenario-corpus.ts`, `victim-intent.test.ts`, `rules.false-positive-hardening.test.ts` — copy exact inputs; each must reach its named deterministic route |
| D-15 | RU/UZ/EN | Follow-up `почему?` / `что делать дальше?` / `что им сказать?` after any check above                                                                           | follow-up keeps the topic, gives next step                                                                                                                                           |
| D-16 | RU/UZ/EN | Report flow from a check result → moderation → `/appeal` link on the same client                                                                               | report accepted, appeal page opens logged-out                                                                                                                                        |
| D-17 | RU/UZ/EN | Voice-in description of a live scam + Voice-out playback                                                                                                       | STT understood, voice answer plays, no secret echo                                                                                                                                   |
| D-18 | RU/UZ/EN | Secret preflight: paste a fake OTP/card/password into a check                                                                                                  | static safe response, no echo, no persistence hint                                                                                                                                   |

Platform columns (Desktop/Android/iOS) apply to every D-row exactly like the
Inline table; keep one tracking table per scenario group in the results file.

## Priority order and exit criteria

1. P0: D-01…D-06, D-14 (high-risk families), Inline rows 1–9 — every platform.
2. P1: D-07…D-13 (aftercare and controls), Inline rows 14–17, D-15, D-16.
3. P2: D-17 (voice), D-18, Inline rows 10–13 (boundaries).

Exit criteria: P0 rows 100% pass on all three platforms, P1 ≥ 90%, P2 ≥ 75%;
every failure gets a dated issue and a regression test before the pack is
declared closed. The pack result must be recorded in `CURRENT_STATE.md` and
`OPEN_TASKS.md` when closed.

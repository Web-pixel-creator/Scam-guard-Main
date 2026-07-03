# Telegram Button QA Matrix

Date: 2026-07-03

This matrix tracks Telegram bot inline buttons by callback family. It complements
`ai_docs/TELEGRAM_BOT_QA_REPORT.md`, which is generated from current
TypeScript formatters and lists concrete rendered buttons.

## Rule

Do not live-click buttons that create external side effects without explicit
user approval at action time.

Side effects include notifying a trusted contact, creating or revoking Family
Shield links, opting a trusted contact out, submitting/retrying real reports,
and generating live TTS/voice messages when provider quota or chat noise matters.

## Callback Families

| Family | Callback examples | Risk class | Automated coverage | Live status |
| --- | --- | --- | --- | --- |
| Main menu | `check_another`, `conversation_start`, `emergency`, `family:menu`, `trainer:start`, `digest`, `safety`, `how_it_works`, `show_lang` | Safe, except `report` starts a stateful flow | `webhook.integration.test.ts`, `bot-qa-matrix.test.ts`, `start-language-buttons.test.ts` | Partially live-tested; continue safe pass |
| Language | `lang:ru`, `lang:uz`, `lang:en` | Safe but changes user preference | `webhook.integration.test.ts`, `i18n-completeness.test.ts` | Test one language switch only if we restore RU afterward |
| Result follow-up | `why`, `explain_simple`, `check_another`, `media_tips`, `emergency` | Safe | `format.test.ts`, `webhook.integration.test.ts`, `why-explanation*` | Partially live-tested |
| Asked context | `asked:code`, `asked:card`, `asked:transfer`, `asked:apk`, `asked:link_qr`, `asked:call` | Safe | `check-context-buttons.test.ts`, `format.test.ts` | Needs live spot-check |
| Image triage | `imgtriage:gift`, `imgtriage:casino`, `imgtriage:wallet`, `imgtriage:bank`, `imgtriage:telegram_profile`, `imgtriage:qr_menu` | Safe | `webhook.integration.test.ts`, `bot-qa-matrix.test.ts` | Profile fallback live-tested; remaining triage safe to spot-check |
| Conversation | `conversation_analyze`, `conversation_cancel` | Safe, but stateful session | `conversation-check.test.ts`, `webhook.integration.test.ts` | Needs controlled live run with dummy text |
| Report flow | `report`, `report_no_value`, `report_skip`, `report_retry` | Stateful; final submit not safe to spam | `handlers/report.scenario.test.ts`, `webhook.integration.test.ts` | One synthetic report live-tested; further live requires restraint |
| Panic menu | `panic:1` ... `panic:15`, `panic:more`, `panic:more2`, `panic:back`, `panic:back2` | Safe; creates guidance messages | `panic-keyboard-structure.test.ts`, `emergency-followup.test.ts`, `webhook.integration.test.ts` | Pages and representative scenarios live-tested; full 15-scenario pass pending |
| Panic follow-up | `panicctx:<id>:more`, `panicctx:<id>:contacts`, `panicctx:<id>:script`, `panicctx:<id>:full` | Safe, except keyboards may include `family:notify` | `emergency-followup.test.ts`, `webhook.integration.test.ts`, `voice-out.server.test.ts` | Needs sampled live pass |
| Live call | `livecall:hangup`, `livecall:what_to_say`, `livecall:sent_code`, `livecall:tell_family` | Safe except `tell_family` notifies trusted contact | `live-call-scenario.test.ts`, `webhook.integration.test.ts` | Hangup/what-to-say/sent-code safe; tell-family manual-only |
| Guardian Angel | `guardian:next`, `guardian:done`, `guardian:safe_call`, `guardian:full_plan` | Safe, except keyboard may include `family:notify` and `voiceout:guardian` | `guardian-angel.test.ts`, `webhook.integration.test.ts` | High-risk Guardian live-tested; follow-up button pass pending |
| Family Shield | `family:menu`, `family:codeword`, `family:invite`, `family:notify`, `family:revoke`, `family:trusted_opt_out` | `menu`/`codeword` safe; others side-effect/manual-only | `family-shield.server.test.ts`, `webhook.integration.test.ts` | `menu` and `codeword` live-tested after rename |
| Trainer | `trainer:start`, `trainer:q:*`, `trainer:a:*` | Safe | `scam-trainer.test.ts`, `webhook.integration.test.ts` | Needs live mini-run |
| Voice-out | `voiceout:panic:<id>`, `voiceout:guardian` | Provider/quota/chat-noise side effect; safe only with approval | `voice-out.server.test.ts`, `emergency-followup.test.ts` | Static voice smoke exists; full live listen-through pending |

## Manual-only Buttons

- `family:notify` / visible "Позвать близкого": sends a real trusted-contact alert.
- `livecall:tell_family`: same trusted-contact notification path.
- `family:invite`: creates a real invite and can revoke pending invites.
- `family:revoke`: can disconnect an existing Family Shield link.
- `family:trusted_opt_out`: can disable alerts for the trusted contact.
- `voiceout:*`: can consume provider quota or send audio into the real chat.
- Report final submit / retry: can notify the moderator chat and add real report rows.

## Current Live Evidence

- `/family` menu and "Как проверить голос" verified live after deploy on
  2026-07-03.
- One synthetic `/report` success path verified live earlier; moderator alert
  delivery was expected and observed.
- High-risk text checks, Guardian Angel, panic/live-call entry, image profile
  fallback and voice STT were spot-checked live earlier.

## Live Pass 2026-07-03

| Area | Live result | Notes |
| --- | --- | --- |
| Main: "Как я решаю" | Pass | Returned concrete risk-sign explanation. |
| Main: "Правила" | Pass | Returned safety rules. |
| Main: "Схемы недели" | Pass | Returned weekly schemes/digest screen. |
| Main: "Проверить новое" | Pass | Prompted for a new number/link/text. |
| Main: "Вся переписка" | Pass | Opened conversation collector. |
| Conversation cancel | Pass | "Отмена" cancelled collector state. |
| Main: "Близкий рядом" | Pass | Opened Family Shield menu. |
| Main: "Тренажёр" | Pass | Opened trainer intro. |
| Trainer start | Pass | "Начать мини-квиз" opened first trainer step. |
| Trainer answer | Not counted | Telegram Web DOM still exposed older buttons; do a visual/manual click for a real quiz answer. |
| Main: "Помощь сейчас" | Pass | Opened panic menu. |
| Main: "МНЕ ЗВОНЯТ СЕЙЧАС" | Pass | Opened live-call copilot. |
| Live call: "Я положил трубку" | Pass | Returned post-hangup safe next step. |
| Live call: "Что сказать?" | Inconclusive | Button clicked, but follow-up was overwritten by rapid subsequent test commands; retest as a single screenshot case. |
| Live call: "Я уже отправил SMS-код" | Inconclusive | Button clicked, but follow-up was overwritten by rapid subsequent test commands; retest as a single screenshot case. |
| Panic pagination | Pass | Page 1 -> page 2 -> page 3 -> back -> back worked. |
| Conversation analyze | Pass | Two dummy messages analyzed and produced a risk result. |
| Main: "Язык" | Inconclusive | DOM click opened Telegram Bot Info in this client; do manual visual click or use `/lang`, then restore RU. |
| Main: "Сообщить случай" | Skipped | Report flow is stateful and can create moderator-chat noise if completed. Covered by synthetic tests and one earlier live synthetic report. |
| Family: "Позвать близкого" | Skipped | Sends a real trusted-contact alert. Requires explicit approval at action time. |
| Family: "Создать приглашение" | Skipped | Creates/revokes real invite state. Requires explicit approval at action time. |
| Family: "Отключить" / trusted opt-out | Skipped | Can disconnect Family Shield. Requires explicit approval at action time. |
| Voice-out buttons | Skipped | Can send audio and consume provider quota. Keep as separate listen-through QA. |

## Live Pass 2026-07-03, Follow-up

| Area | Live result | Notes |
| --- | --- | --- |
| `/lang` picker | Pass | Opened language picker via command. |
| Language: English | Pass | Switched to English and returned English input guidance. |
| Language: Russian restore | Pass | Switched back to Russian and returned Russian input guidance. |
| Live call: "Что сказать?" | Pass | Visual pass: returned a ready phrase to end the call and call back via the official number. |
| Live call: "Я уже отправил SMS-код" | Pass | Visual pass: returned urgent bank/card blocking guidance. |
| Trainer answer | Pass | Question 1 answer "Положить трубку..." returned "Верно" and a safe-step explanation. |
| Image fallback setup | Pass | Deliberately unreadable QA image produced the honest unreadable-image fallback and triage keyboard. |
| Image triage: NFT/Stars/подарок | Pass | Returned cautious gift/bonus guidance; no green-safe verdict. |
| Image triage: Казино/фриспины | Pass | Returned deposit/access/card/code warning; no green-safe verdict. |
| Image triage: TON/Wallet | Pass | Returned wallet-connect/signature/seed/top-up warning; no green-safe verdict. |
| Image triage: Банк/код | Pass | Returned code/card/APK banking warning; no green-safe verdict. |
| Image triage: Профиль/чат | Pass | Returned nuanced profile/chat guidance; no account-identity claim and no green-safe verdict. |
| Image triage: Меню/QR | Pass | Returned menu/informational QR guidance with warning about payment/login/code/card/APK after opening; no green-safe verdict. |

## Next Safe Live Pass

1. Panic sampled scenarios from pages 1-3, excluding `family:notify` and
   voice-out buttons.
2. Guardian/result follow-ups: `why`, `explain_simple`, `guardian:next`,
   `guardian:done`, `guardian:safe_call`, `guardian:full_plan`.
3. Manual-only side-effect pass, only with explicit approval at action time:
   `family:notify`, `family:invite`, `family:revoke`, trusted opt-out,
   voice-out listen-through and full report submit/retry.

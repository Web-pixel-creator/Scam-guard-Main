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
| Family Shield | `family:menu`, `family:codeword`, `family:invite`, `family:notify`, `family:revoke`, `family:trusted_opt_out` | `menu`/`codeword` safe; others side-effect/manual-only | `family-shield.server.test.ts`, `webhook.integration.test.ts` | `menu`/`codeword` live-tested after rename; notify/invite/revoke side-effect paths sampled with approval |
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

## Harness Pass 2026-07-03

Live Telegram Web retry was blocked: after opening
`https://web.telegram.org/k/#@scamguard_bot`, the in-app browser tab API timed
out while reading/opening tabs. No live side-effect buttons were clicked in this
blocked retry.

Local callback-handler coverage was expanded and passed:

| Area | Harness result | Notes |
| --- | --- | --- |
| Panic scenarios `panic:1..15` | Pass | Every scenario sends a concrete response, does not edit the menu message, and stores `lastPanicId` with chat scope. |
| Guardian actions | Pass | `guardian:next`, `guardian:done`, `guardian:safe_call`, and `guardian:full_plan` answer from stored high-risk context and return the safe follow-up keyboard. |
| Guardian without context | Pass | The same Guardian callbacks degrade to no-context guidance and do not expose stale details or keyboards. |

Verification:

- `npm run test:run -- src/lib/telegram/handlers/panic-menu-flow.test.ts`
  passed: 30 tests.
- `npm run test:run -- src/lib/telegram/emergency-followup.test.ts
  src/lib/telegram/panic-keyboard-structure.test.ts
  src/lib/telegram/guardian-angel.test.ts` passed: 107 tests.
- `npm run qa:telegram-report` passed and produced no content diff.

## Live SOS Retry 2026-07-03

This retry reached the real Telegram bot before browser control became
unreliable again.

| Area | Live result | Notes |
| --- | --- | --- |
| `/panic` command | Pass | Opened the SOS menu in the real Telegram chat. |
| `panic:1` / already sent SMS code | Pass | Returned urgent guidance to call the bank, block the card/online bank, change bank/Telegram passwords from another device, and stop sending anything else. |
| `panic:4` / entered card data | Pass | Returned immediate card-blocking guidance. |
| Remaining SOS buttons | Blocked | Telegram Web switched into a narrow/mobile layout and accidental Bot Info/sidebar activation made further coordinate clicks unsafe. |
| Browser-control retry after user refresh | Blocked | The user-visible tab worked, but the automation channel timed out even on tab-list reads. No further live side-effect buttons were clicked. |

## Live SOS Full Pass 2026-07-03

After the user refreshed/reopened Telegram Web, the real bot chat became
controllable again. The safe SOS scenario buttons were tested live in the real
Telegram chat. Manual-only side-effect buttons were not clicked.

| Area | Live result | Notes |
| --- | --- | --- |
| `/panic` command | Pass | Opened the SOS menu in the real Telegram chat. |
| `panic:1` / already sent SMS code | Pass | Returned urgent bank/card blocking guidance and told the user to stop sending anything else. |
| `panic:2` / installed APK | Pass | Told the user to enable airplane mode, remove the suspicious app, block cards through the bank, and change passwords from another device. |
| `panic:3` / transferred money | Pass | Told the user to call the bank, ask to freeze the transfer, preserve evidence, and avoid a "return transfer" second-scam path. |
| `panic:4` / entered card data | Pass | Returned immediate card-blocking guidance. |
| `panic:5` / lost Telegram | Pass | Told the user to close unknown Telegram sessions, enable two-step password, and warn close contacts. |
| `panic:6` / call in progress | Pass | Opened live-call copilot guidance: end the call, call back via the official number, and do not say codes/card data/passwords. |
| `panic:7` / photo-video blackmail | Pass | Told the user not to pay or send new media, preserve screenshots/evidence, block/report after screenshots, and involve a trusted adult/close person. |
| `panic:8` / relationship money request | Pass | Told the user to pause transfers, avoid credit/debt, involve a close person, and verify the photo/story. |
| `panic:9` / publication threats | Pass | Told the user not to pay for deletion, avoid negotiation, preserve links/screenshots, and report published content to platform support. |
| `panic:10` / user under 18 | Pass | Used supportive wording, told the user they are not at fault, and directed them to a trusted adult without deleting the chat. |
| `panic:11` / close-person or AI voice | Pass | Told the user not to transfer money by voice alone, end the call/voice chat, call back via saved number, and ask a code word/personal question. |
| `panic:12` / job or easy income | Pass | Told the user not to pay for work/withdrawal, not to send passport/card/codes/photos, not to install APK or pass KYC from chat links, and to request legal company details/contract. |
| `panic:13` / delivery or top-up | Pass | Told the user not to pay through chat links, use only official app/site, avoid SMS/PIN/CVV/card-number entry, and block the card if data was entered. |
| `panic:14` / crypto TON wallet | Pass | Told the user not to connect wallet or enter seed phrase and treated NFT/Stars/TON-bonus flows as wallet-drain risk. |
| `panic:15` / government payout or grant | Pass | Told the user not to pay a payout fee, use only official app/site, avoid SMS/CVV/PIN/Telegram-code entry, and not send passport/ID into chat without source verification. |
| Telegram Web caveat | Pass with caveat | One retry opened a Telegram media/Bot Info overlay; it was closed and testing continued using DOM-grounded button clicks only. |

## Live Follow-up Pass 2026-07-03

Safe text follow-up buttons were tested live in the real Telegram chat. Buttons
that notify a trusted contact, create/revoke Family Shield state, submit a real
report, or send voice/audio were not clicked.

| Area | Live result | Notes |
| --- | --- | --- |
| Government payout: "What next" | Pass | Returned a calm one-step plan: do not pay a fee, open the service only through the official site/app, and block card/online bank if data was entered. |
| Government payout: "Official channel" | Pass | Returned official-channel guidance and useful support numbers. |
| Government payout: "Ready phrase" | Pass | Returned a reusable refusal phrase for pressure/link/payment/code requests. |
| Government payout: "All urgent steps" | Pass | Returned the full plan with bank/law-enforcement escalation guidance. |
| SMS-code scenario: "Call safely" | Pass | Told the user not to call the incoming/SMS number and to use the official bank app/card/site number. |
| Lost Telegram: "Recover my account" | Pass | Returned account-recovery steps through official Telegram flow and warned not to answer impersonation messages. |
| Photo/video blackmail: "Where to go" | Pass | Told the user to involve a trusted adult/person, preserve evidence, and seek platform/police help. |
| Close-person or AI voice: "Check voice" | Pass | Told the user to ignore the calling account/number, call back through a saved number, and use a code word/personal question. |
| Job/easy-income: "Check source" | Pass with copy note | Returned useful escalation/help guidance. Minor UX note: the answer heading reads like "Where to go", so the heading could better match the button label. |
| Crypto/TON/wallet: "Wallet safety" | Pass | Told the user to create a new wallet if seed/private key was entered, avoid withdrawal/unfreeze fees, and preserve transaction/chat evidence. |
| Risk card: "Why?" | Pass | Explained visible risk signs: SMS-code, CVV/CVC, PIN-code and suspicious link/payment pressure. |
| Risk card: "Simple words" | Pass | Reframed the risk in simple language without overclaiming hidden facts. |
| Guardian: "What next" | Pass | Returned one calm next step instead of a long checklist. |
| Guardian: "Done step" | Pass | Advanced to the next safe action after the user marked the first step done. |
| Guardian: "Call safely" | Pass | Returned official-callback instructions and verified short bank numbers. |
| Guardian: "Full plan" | Pass | Returned the full emergency plan without notifying anyone or sending audio. |

## Live Side-effect Pass 2026-07-03

These checks intentionally create external side effects and require explicit
approval at action time.

| Area | Live result | Notes |
| --- | --- | --- |
| Trusted-contact alert / "Call close person" | Pass | With explicit user approval, the latest Guardian/high-risk `Позвать близкого` button was clicked. The bot confirmed: "Я отправил близкому короткий сигнал помощи..." and reminded the user not to forward codes, PIN, CVV, passwords, card photos, or suspicious files. |
| Family Shield invite / "Create invitation" | Pass with existing-link fallback | With explicit user approval, `/family` was opened and `Создать приглашение` was clicked. Because a trusted contact was already connected, no new invite was created; the bot correctly explained that a new invitation requires disconnecting the current Family Shield link first and offered `Позвать близкого`, `Как проверить голос`, and `Отключить`. |
| Family Shield revoke / "Disconnect" | Pass | With explicit user approval, `Отключить` was clicked from the existing-link Family Shield screen. The bot confirmed: "Готово. Семейный щит отключён для этого контакта." |

## Next Safe Live Pass

1. Manual-only side-effect pass, only with explicit approval at action time:
   trusted opt-out, live-call trusted alert variant if needed, voice-out
   listen-through and full report submit/retry.
2. Optional copy polish: align the job/easy-income "Check source" response
   heading with the button label.

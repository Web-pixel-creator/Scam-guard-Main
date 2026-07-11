# Telegram Inline Client QA

Date: 2026-07-10

This checklist covers the real Telegram-client visual QA step for
`@scamguard_bot <query>` inline mode. It complements
the automated Inline handler tests and, in webhook-mode environments,
`npm run prod:telegram-inline-smoke`. Neither can render the Telegram client's
inline result list.

## Scope

Use this checklist when validating the actual Telegram UI:

- the inline result list appears while typing `@scamguard_bot ...`;
- result titles/descriptions fit in the Telegram client;
- low-signal previews still feel useful before insertion, even when Telegram
  truncates descriptions;
- inserted cards are readable and action-first;
- low-signal phone and Telegram username checks show an honest Risk Passport
  instead of a generic insufficient-data card;
- inline previews do not create `checks` rows, chat-scoped sessions or
  moderator-chat notifications.

No third Telegram chat is required. Use an existing non-moderator place where
test messages are safe, such as the main bot chat if the client offers inline
results there, Saved Messages, or a private QA chat. Do not use the moderator
chat unless the case is explicitly about report/appeal moderator delivery.

## Preconditions

- BotFather inline mode is enabled for `@scamguard_bot` with a short placeholder.
- Production Telegram delivery is healthy in its configured mode. Current
  production uses polling; an intentionally disabled webhook returning 503 is
  expected there.
- Do not paste real SMS codes, card data, passwords, document photos or private
  screenshots into inline queries.
- Store raw screenshots locally under:
  `private/telegram-inline-qa/YYYY-MM-DD/`
- Commit only sanitized screenshots if a future report explicitly needs them.

## Companion Automated Check

In a protected deployment that is intentionally in webhook mode, run:

```bash
railway run npm run prod:telegram-inline-smoke -- https://scam-guard-main-production.up.railway.app
```

Expected: the smoke passes, returns webhook `200` for all synthetic inline
updates, and confirms no `checks` or chat-scoped Telegram sessions were
persisted.

Do not run that webhook-injection script as a polling production gate: polling
mode correctly returns 503 from the webhook. For polling production, run the
non-Inline response harness and the repository Inline tests, then complete this
real-client checklist:

```bash
railway run npm run prod:telegram-polling-dispatch-smoke -- https://scam-guard-main-production.up.railway.app
npm run test:run -- src/lib/telegram/handlers/inline.test.ts src/lib/telegram/inline.mass.test.ts
```

The polling harness deliberately does not invent an `inline_query_id`; only a
real Telegram client can supply an id accepted by `answerInlineQuery` and prove
that the result list renders.

## Deferred Client Note

2026-07-06 live Telegram Web follow-up:

- Production inline backend smoke passes.
- Real bot chat text routes for unknown-contact + SMS-code, Soliq/OneID, and
  transfer-to-card phrases passed in the live Telegram chat.
- Telegram Web did not render the inline result list in the current session
  when typing `@scamguard_bot ...` inside the bot chat or Saved Messages; it
  only left a local draft. The draft was cleared.
- Treat this as deferred client visual QA, not a backend failure, until
  reproduced in Telegram Desktop/mobile or a fresh Telegram Web session.
- Next retest target: mobile Telegram or Telegram Desktop, Saved Messages or a
  private non-moderator QA chat.

## Visual Cases

| Case ID                 | Query to type                                                                | Expected inline result                                                                                                                  | Expected after insert                                                                             | Must not happen                                                                    |
| ----------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| INLINE-EMPTY            | `@scamguard_bot`                                                             | Usage/help article appears with short guidance.                                                                                         | Optional: inserted help card is calm and short.                                                   | No risk verdict, no moderator message.                                             |
| INLINE-HIGH-RU          | `@scamguard_bot Срочно назовите SMS-код от банка для отмены операции`        | High-risk result appears, title/description fit, first action is to stop sharing codes.                                                 | Inserted card is red/high-risk, action-first, and does not ask for a code.                        | No generic insufficient-data card.                                                 |
| INLINE-PHONE-UZ         | `@scamguard_bot +998 90 123 45 67`                                           | Low-signal phone result appears as a Risk Passport / number passport.                                                                   | Inserted card names country/operator limits and Ishonch Guard source/scope honestly.              | No ownership claim, no hidden external label, no generic insufficient-data card.   |
| INLINE-PHONE-SHORT      | `@scamguard_bot 12345678`                                                    | Preview title says the number is incomplete or that no reports were found, and description asks for the full number or request context. | Inserted card must not imply the number is safe.                                                  | No abstract `Паспорт номера`-only preview.                                         |
| INLINE-FREE-TEXT-LOW    | `@scamguard_bot Мне пишет мошенник`                                          | Preview says more context is needed and asks for the full message/request.                                                              | Inserted card keeps only sanitized context and asks for actionable context.                       | No cold `Недостаточно данных` preview without next step.                           |
| INLINE-LINK-BARE        | `@scamguard_bot у меня просят перейти по ссылке`                             | Preview says `Ссылка: сначала проверим` and warns not to open it yet.                                                                   | Inserted card asks for the actual URL/context without pretending a verdict exists.                | No generic `Нужно больше контекста` preview that hides the safe next step.         |
| INLINE-HUMAN-CODE       | `@scamguard_bot пришел код и просят его сказать`                             | Preview says `Код: никому не называйте`.                                                                                                | Inserted card keeps only sanitized context and asks for full context without asking for the code. | No generic insufficient-context preview while the immediate safe step is obvious.  |
| INLINE-HUMAN-SENTCODE   | `@scamguard_bot я только что передал код из СМС`                             | Preview says `Код уже отправлен: действуйте срочно`.                                                                                    | Inserted card keeps the risk level visible and tells the user to act through the bank.            | No calm `Требуется осторожность`-only preview.                                     |
| INLINE-HUMAN-GOV        | `@scamguard_bot просят войти в OneID и сказать SMS код`                      | Preview says `OneID/госуслуги: не вводите код`.                                                                                         | Inserted card keeps only sanitized context and tells the user not to use chat/SMS login links.    | No accidental classification as a crypto/investment phrase.                        |
| INLINE-HUMAN-SIM        | `@scamguard_bot оператор просит код для замены SIM карты`                    | Preview says `SIM/оператор: осторожно`.                                                                                                 | Inserted card keeps only sanitized context and tells the user to call the operator independently. | No generic insufficient-context preview.                                           |
| INLINE-HUMAN-FAMILY     | `@scamguard_bot сын попал в аварию срочно перевести деньги`                  | Preview says `Близкий в беде: перезвоните`.                                                                                             | Inserted card keeps only sanitized context and points to saved-number callback/code-word safety.  | No immediate money-transfer-only guidance that misses impersonation.               |
| INLINE-HUMAN-JOB        | `@scamguard_bot предлагают работу но просят оплатить обучение`               | Preview says `Работа: не платите взнос`.                                                                                                | Inserted card keeps only sanitized context and asks for full job terms.                           | No safe/neutral preview.                                                           |
| INLINE-HUMAN-INVEST     | `@scamguard_bot предлагают инвестировать в TON wallet с гарантией`           | Preview says `Инвестиции/крипта: осторожно`.                                                                                            | Inserted card keeps only sanitized context and warns against deposits/guaranteed returns.         | No OneID/government false positive from the substring `стир`.                      |
| INLINE-HUMAN-ROMANCE    | `@scamguard_bot новый знакомый просит деньги на билет`                       | Preview says `Отношения: деньги не отправляйте`.                                                                                        | Inserted card keeps only sanitized context and asks for the full request.                         | No generic insufficient-context preview.                                           |
| INLINE-HUMAN-UNKNOWN    | `@scamguard_bot мне пишет какой то незнакомый человек`                       | Preview says `Незнакомец: нужен текст просьбы`.                                                                                         | Inserted card asks what exactly the contact wants and warns not to send sensitive data.           | No generic insufficient-context preview.                                           |
| INLINE-HUMAN-IDENTITY   | `@scamguard_bot мне пишет одноклассник, но я не уверен что это он`           | Preview says `Личность не ясна: перезвоните`.                                                                                           | Inserted card recommends saved-number callback or a personal question.                            | No generic insufficient-context preview.                                           |
| INLINE-HUMAN-EARNING    | `@scamguard_bot меня приглашают в канал для заработка`                       | Preview says `Канал заработка: осторожно`.                                                                                              | Inserted card warns against deposits/crypto/betting/tasks before proof.                           | No generic insufficient-context preview.                                           |
| INLINE-HUMAN-BANK       | `@scamguard_bot как мне связаться с банком?`                                 | Preview says `Связаться с банком: только официальный номер`.                                                                            | Inserted card tells the user to use app/card/official site, not chat/SMS/call numbers.            | No generic insufficient-context preview.                                           |
| INLINE-HUMAN-CONCERN    | `@scamguard_bot меня пытаются обмануть`                                      | Preview says `Подозреваете обман: пришлите просьбу`.                                                                                    | Inserted card asks for the message/link/number/request instead of sounding dismissive.            | No generic insufficient-context preview.                                           |
| INLINE-HUMAN-VOTE       | `@scamguard_bot меня просят проголосовать на канале и перейти по ссылке`     | Preview says `Голосование/канал: сначала проверим`.                                                                                     | Inserted card warns not to open the link or re-login to Telegram.                                 | No generic link-only preview that misses the voting bait.                          |
| INLINE-HUMAN-NEXT       | `@scamguard_bot что мне делать дальше?`                                      | Preview says `Что делать: остановитесь и пришлите просьбу`.                                                                             | Inserted card keeps only sanitized context and asks for the factual request before advice.        | No generic insufficient-context preview.                                           |
| INLINE-HUMAN-REPLY      | `@scamguard_bot можно ли ему отвечать?`                                      | Preview says `Ответ: не раскрывайте данные`.                                                                                            | Inserted card tells the user not to reveal codes/card/money/documents.                            | No yes/no answer that implies the contact is trusted.                              |
| INLINE-HUMAN-SAFE       | `@scamguard_bot это безопасно или мошенники?`                                | Preview says `Безопасно ли: проверим по фактам`.                                                                                        | Inserted card asks for the message/link/number/screenshot and refuses to guess.                   | No invented verdict without evidence.                                              |
| INLINE-HUMAN-CHAT       | `@scamguard_bot меня зовут вступить в какой то канал`                        | Preview says `Канал/чат: сначала проверим`.                                                                                             | Inserted card asks for the invitation/link and warns against re-login bait.                       | No generic insufficient-context preview.                                           |
| INLINE-MULTILINE-CODE   | `@scamguard_bot мне пишет незнакомый человек` + newline + `Он хочет смс код` | Preview says `Код: никому не называйте`.                                                                                                | Inserted card treats the sensitive code request as more important than unknown-contact context.   | No generic unknown-contact preview when a concrete code request is present.        |
| INLINE-RATE-LIMIT       | Repeated inline queries from the same account until limited                  | Preview says `Слишком много проверок` and includes retry seconds.                                                                       | No message is sent to the chat; user understands when to retry.                                   | No raw error, stack trace, or vague wait-only copy.                                |
| INLINE-TG-USERNAME      | `@scamguard_bot @lucky_promo_qa`                                             | Low-signal Telegram username result appears as a Risk Passport.                                                                         | Inserted card explains public Bot API limits and asks what happened next.                         | No account-age or hidden-spam-history claims.                                      |
| INLINE-TG-LINK-LOW      | `@scamguard_bot https://t.me/UiWebSections`                                  | Preview says `Telegram: нужен контекст` and asks for request text, post link or screenshot.                                             | Inserted card explains that username/channel alone is not proof of safety or fraud.               | No abstract `Telegram-паспорт` preview that gets truncated before the useful part. |
| INLINE-LONG             | `@scamguard_bot ` plus a very long repeated safe phrase                      | Too-long/shorten-query result appears.                                                                                                  | If inserted, card asks to shorten the query.                                                      | No crash, no raw stack/error text.                                                 |
| INLINE-SECRET-PREFLIGHT | `@scamguard_bot мне пишет незнакомый человек 123456`                         | Unknown-contact preview appears without printing the six-digit value.                                                                   | Inserted card contains `••••`, not `123456`.                                                      | No raw OTP in title, description, message or button.                               |
| INLINE-EN               | `@scamguard_bot they ask me to install AnyDesk and read them the code`       | English high-risk remote-access result appears.                                                                                         | Inserted card warns not to install/share screen and gives one safe step.                          | No Russian-only fallback if client language is English.                            |
| INLINE-UZ               | `@scamguard_bot kodni ayting bank operatsiyasini bekor qilamiz`              | Uzbek or safe fallback high-risk OTP result appears.                                                                                    | Inserted card warns not to share the code.                                                        | No cold insufficient-data response.                                                |

Optional seeded case:

| Case ID                 | Query to type                                                                             | Expected                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INLINE-PHONE-REPUTATION | A safe test phone that has a confirmed moderated Ishonch Guard report in the QA database. | The result says reports are moderator-confirmed Ishonch Guard reports, not unverified complaints, carrier data, owner data or hidden external reputation. |

## Capture Rules

For each case, capture:

- screenshot of the inline result list before inserting;
- screenshot of the inserted card when insertion is safe;
- Telegram client name and platform;
- language shown by the bot;
- any unexpected moderator-chat message.

Redact personal chats, usernames, profile photos and unrelated messages before
sharing outside local QA. Do not upload raw private screenshots to the repo.

## Pass / Fail Checklist

- Inline result list appears within normal Telegram timing.
- Result title and description are readable on desktop and mobile Telegram.
- Preview descriptions stay within 120 characters; the inserted card contains
  the complete reason method/source and honest limitation.
- For each reason family, verify the inserted RU/UZ/EN card says what was
  actually checked (visible text, URL/domain/phone/Telegram structure,
  official directory, moderated local reports or configured external feed)
  and does not claim hidden Telegram data, owner identity or proof of fraud.
- Multi-reason fixtures show the stronger policy reason regardless of detector
  array order (for example, an external phishing hit wins over phone format).
- Low-signal preview title is immediately understandable without opening the
  full inserted card.
- High-risk cases are action-first and do not ask the user to provide secrets.
- Low-signal phone/username cases show Risk Passport content, not a generic
  insufficient-data verdict.
- No raw codes, card data, full phone numbers, private screenshots, OCR text or
  unredacted identifiers appear in public inline cards.
- Inline preview/insert does not send anything to the moderator chat. Moderator
  chat messages are expected only for explicit report/appeal flows.
- Companion production smoke still passes.

## Evidence Log Template

| Date       | Tester | Client                           | Case ID        | Result      | Screenshot path                             | Notes |
| ---------- | ------ | -------------------------------- | -------------- | ----------- | ------------------------------------------- | ----- |
| 2026-07-02 |        | Telegram Desktop / iOS / Android | INLINE-HIGH-RU | Pass / Fail | `private/telegram-inline-qa/2026-07-02/...` |       |

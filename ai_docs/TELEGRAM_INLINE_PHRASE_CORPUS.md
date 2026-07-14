# Telegram Inline Human Phrase Corpus

Date: 2026-07-05

This file tracks the seed corpus for low-signal human inline queries, such as
`@scamguard_bot мне скинули ссылку` or `@scamguard_bot просят подтвердить
операцию`. These queries are not full scam artifacts yet, so inline mode should
not invent a verdict. It should recognize the likely situation and give a short
safe next step in the preview.

## Sources Reviewed

- Davr Bank warning: bank employees do not ask for PIN, SMS confirmation codes
  or card CVV over the phone:
  https://davrbank.uz/en/news/beware-of-fraudsters
- Tenge Bank security guidance: do not disclose full card number, expiration,
  CVV, PIN, TIN/ID, SMS codes, passwords, or install third-party apps at a
  stranger's request:
  https://tengebank.uz/en/about-bank/bezopasnost
- Ipoteka Bank fraud guidance: banks, telecom operators and government agencies
  do not ask for confidential information over phone or messengers:
  https://www.ipotekabank.uz/en/blog/bezopasnost/kak-zashchititsya-ot-moshennikov/
- Group-IB on Uzbekistan credit fraud: do not share card details, passwords,
  passport information or personal information with people claiming to be bank
  or government employees via messaging services:
  https://www.group-ib.com/blog/credit-fraud-in-uzbekistan/
- Group-IB on Uzbekistan mobile malware: Telegram is used to distribute Android
  SMS stealers in Uzbekistan:
  https://www.group-ib.com/blog/mobile-malware-uzbekistan/
- Gazeta.uz on Uzbek data leaks/OneID: public reporting included OneID context
  and SMS-code social engineering:
  https://www.gazeta.uz/en/2026/02/13/data-leak/
- Beeline Uzbekistan support/security guidance: never share personal data, card
  details, expiration date, CVV, or one-time access codes:
  https://beeline.uz/en/support
- FTC SIM-swap guidance: SIM swaps can let attackers receive verification codes
  for account logins:
  https://consumer.ftc.gov/consumer-alerts/2019/10/sim-swap-scams-how-protect-yourself
- FTC romance and crypto guidance: online love interests who ask for money or
  investment/crypto help are a scam signal:
  https://consumer.ftc.gov/articles/what-know-about-romance-scams
  https://consumer.ftc.gov/articles/what-know-about-cryptocurrency-scams
- FTC job scam guidance: job offers that require money movement or upfront
  payment are scam signals:
  https://consumer.ftc.gov/articles/job-scams
- FCC package-delivery scam guidance: fake delivery texts often push tracking
  or payment links:
  https://www.fcc.gov/how-identify-and-avoid-package-delivery-scams
- CFTC/SEC digital-asset fraud guidance: high guaranteed returns and low/no risk
  claims are red flags:
  https://www.cftc.gov/LearnAndProtect/AdvisoriesAndArticles/watch_out_for_digital_fraud.html

## Implemented Intent Classes

| Intent                 | Example human query                              | Inline preview goal                                                          |
| ---------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `link_request`         | `мне скинули ссылку`, `просят перейти по ссылке` | Ask for the actual URL or full request and warn not to open it yet.          |
| `code_request`         | `пришел код и просят его сказать`                | Warn not to share SMS/OTP/PIN/passwords.                                     |
| `sent_code`            | `я только что передал код из СМС`                | Treat as urgent next-step guidance: block access/card and change password.   |
| `confirm_request`      | `просят подтвердить операцию`                    | Warn not to confirm login/transfer/card operations from a call/chat.         |
| `card_request`         | `просят данные карты`                            | Warn not to send card number, expiry, CVV/CVC, PIN or card photos.           |
| `transfer_request`     | `просят перевести деньги`                        | Ask who/where/why and warn against stranger/safe-account transfers.          |
| `app_request`          | `просят установить приложение для защиты`        | Warn not to install APK/remote-access/security apps from a chat/call.        |
| `bank_call`            | `мне звонят из банка`                            | Tell the user to hang up and call back using the official number.            |
| `personal_data`        | `просят фото паспорта`                           | Warn not to send passport, PINFL/STIR/TIN, selfie or address.                |
| `delivery_payment`     | `нужно оплатить доставку`                        | Ask for the full SMS/link and warn about delivery/customs payment links.     |
| `prize_fee`            | `выиграл приз, просят оплатить налог`            | Warn that prizes/grants/gifts do not require upfront fees.                   |
| `gov_service`          | `просят войти в OneID и сказать SMS код`         | Warn not to enter government/OneID credentials from a chat/SMS link.         |
| `sim_swap`             | `оператор просит код для замены SIM`             | Warn not to share SIM/eSIM replacement or number-transfer codes.             |
| `relative_distress`    | `сын попал в аварию, срочно деньги`              | Tell the user to call back on a saved number or use the family code word.    |
| `job_offer`            | `работа, но просят оплатить обучение`            | Warn not to prepay for jobs, training, uniforms or verification.             |
| `investment_offer`     | `TON wallet с гарантированной прибылью`          | Warn about guaranteed returns, crypto/wallet deposits and fast-profit bait.  |
| `romance_money`        | `новый знакомый просит деньги на билет`          | Warn that new relationship plus money/visa/treatment/investment is risky.    |
| `unknown_contact`      | `мне пишет какой то незнакомый человек`          | Ask for what the person is requesting and warn not to send sensitive data.   |
| `identity_uncertain`   | `одноклассник, но я не уверен что это он`        | Tell the user to verify through a saved number or personal question.         |
| `earning_channel`      | `приглашают в канал для заработка`               | Warn that earning channels often lead to deposits, crypto, betting or tasks. |
| `bank_contact`         | `как мне связаться с банком?`                    | Tell the user to use the app/card/official website, not numbers from chats.  |
| `general_scam_concern` | `меня пытаются обмануть`                         | Validate the pause and ask for the message/link/number/request.              |
| `voting_link`          | `проголосовать на канале и перейти по ссылке`    | Warn that voting links can be Telegram re-login bait.                        |
| `next_step`            | `что мне делать дальше?`                         | Tell the user to pause, send nothing yet and provide the factual request.    |
| `reply_safety`         | `можно ли ему отвечать?`                         | Allow only neutral replies and warn not to reveal sensitive data.            |
| `safety_question`      | `это безопасно или мошенники?`                   | Refuse to guess and ask for the message/link/number/screenshot.              |
| `chat_invite`          | `меня зовут вступить в какой то канал`           | Warn about suspicious channel/chat links and ask for the invitation/link.    |

## Design Rule

These classes improve the inline preview for `unknown` and `suspicious`
low-signal results. They do not raise the risk score by themselves. Full scoring
remains in the rules engine when the user sends the actual artifact: message
text, link, number, QR, screenshot or voice transcript. For `suspicious`
results, the inserted card still keeps the risk level visible.

When a query contains both social context and a concrete sensitive request, the
sensitive request wins. Example: `мне пишет незнакомый человек\nОн хочет смс код`
must show the code-sharing warning, not only the generic unknown-contact card.

## 2026-07-14 full-dialogue adaptation

`inline-adapted-dialogue-corpus.ts` reuses the complete 1,000-dialogue
perimeter for Inline without pretending that Inline has direct-bot memory:

- 2,500 individual user turns from all 1,000 dialogues;
- 930 follow-ups joined to their original risk turn in one stateless query;
- 363 mixed-clause adversarial messages;
- 12 synthetic credential-boundary messages;
- 3,805 source cases / 2,140 unique queries in total;
- RU 1,270, UZ 1,269 and EN 1,266.

The handler-level test denies external `fetch`, mocks Telegram/Supabase, forbids
database mutations and fixes `runCheck` to rules-only/no-persistence options.
This corpus is deterministic QA data. It is not training data, real chat data,
3,805 Bot API messages or a replacement for the live client checklist.

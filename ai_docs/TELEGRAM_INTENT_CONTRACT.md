# Telegram Intent Contract

Canonical Telegram intent ids use five namespaces:

- `meta.*` — questions about the bot;
- `victim.*` — first-contact human situations;
- `followup.*` — questions about a previous result;
- `panic.*` — emergency scenarios;
- `input.risk_check` — a fresh artifact or suspicious payload.

Personal-document routes distinguish timing: `victim.personal_data_request`
prevents a pending disclosure, while `victim.personal_data_already_shared`
provides post-incident containment, official bank/issuer contact and 102
guidance. Benign uploads through an explicitly official portal/app do not enter
either scam-aftercare route.

`src/lib/telegram/intent-contract.ts` is the response/action and side-effect
source of truth. Reply-only intents cannot create checks or contact another
person. Direct risk checks persist their normal check result; Inline remains
stateless. Trusted-contact delivery is limited to the existing private
high-risk policy.

`src/lib/telegram/dialogue-corpus.ts` contains the generated multi-turn QA DSL:
13 actions x 3 languages x 6 surface variants x 8 contexts = 1,872 rows. It
includes canonical/case/spacing/punctuation forms plus reviewed reply-to-bot
and common-typo phrases, and distinguishes recent, orphan, stale and
new-artifact behavior. The separate legacy live matrix contains 238
end-to-end first-contact rows.

Benign code contexts are clause-local. A genuine door, entrance, postal,
programming or dress-code clause may suppress only its own false positive; it
must never suppress a later request for an SMS, banking, login or verification
code. The inverse order is equivalent, and RU/UZ/EN punctuation and contrast
boundaries must preserve the dangerous clause.

Additional local-only perimeter suites keep authored and generated evidence
separate: 1,008 context cases, 1,000 synthetic multi-turn sequences, 540
semantically distinct everyday two-turn dialogues and 363 mixed-clause
messages. They execute production classifiers/builders with network access
denied; they are not training data or real-client evidence.

The Inline adapter replays this perimeter under a separate stateless contract:
2,500 raw user turns, 930 follow-ups combined with their original risk turn,
363 mixed-clause messages and 12 synthetic credential fixtures become 3,805
source cases / 2,140 unique queries. A raw acknowledgement or identity turn may
use concise localized Inline small talk; every other follow-up must avoid
claiming a retained or rechecked previous object. A small-talk prefix never
outranks a concrete OTP, PIN, CVV, password, APK, payment or screen-sharing
request. External fetch, Telegram delivery and persistence are denied in this
automated suite.

Intent matching uses a classifier-only normalized view that removes invisible
format controls, applies Unicode compatibility normalization and repairs only
conservative mixed-script confusables. The original text remains the source for
privacy filtering and must never be replaced in replies, persistence or logs.
Direct checks resolve RU/UZ/EN from each current message and use the stored
profile language only as a fallback; this per-turn reply choice does not mutate
the durable session language. Inline applies the same text-language resolver
without creating a Telegram session.

When a narrow human scenario is proven, both Direct and Inline must preserve
that topic in the title, explanation and first safe action. Completed-incident
aftercare remains above ordinary suspicion, while an explicitly official
portal/app handoff remains a safe control. Broad preflight scoring cannot erase
a more specific scenario such as SIM swap, police/bank impersonation, parcel,
charity, romance, loan advance fee, fake support, QR login or tax payment.
Capability questions may bypass preflight only when they are exact, single-line
questions with no concrete danger clause.

Real OTP, PIN, CVV, password, private-key and recovery/seed material is
sink-sanitized before any visible Telegram response. This includes bounded
confusable/spaced/typo labels, formatted or value-first alphanumeric codes and
canonical 12/15/18/21/24-word recovery lists. Direct and Voice guidance may
explain only the secret class and the immediate containment step; Voice does
not cache or share a raw secret transcript. Inline secret results are fully
static and never include user-derived context, even a supposedly sanitized
copy. Reply context is bounded to recent message ids and sanitized/coarse check
metadata.
Short Direct admissions after victim guidance may additionally use a 20-minute
enum-only `{ kind, askedContext?, scenario?, at }` snapshot; it contains no raw
text, amount, recipient, number, URL, file or credential, is chat-scoped, and a
new concrete artifact always bypasses it. Inline follow-ups remain query-local
and stateless.

Completed-action aftercare is selected only for an explicit first-party action
or state. Negation, an aborted action, a quoted/educational example, a
third-party action, a physical access code and an ordinary planned payment are
negative controls. An actual pasted secret stays on the private secret path;
mentioning a secret class in a sentence such as "I read out the one-time
password" may still reach urgent aftercare when no value is present.

Report callback actions are bound to the exact chat-scoped prompt message,
action and scenario for 20 minutes. Missing, malformed, future or expired
timestamps, cross-chat state and mismatched message/action/scenario fail
closed without submitting or mutating a report.

Adding an intent requires updating its typed source list; contract cardinality
tests then require a matching canonical entry. New user artifacts always bypass
follow-up helpers and enter a fresh risk check. A confidence/methodology phrase
cannot hide a later code, password, APK, screen-sharing, payment or other strong
danger request: the original full message is evaluated before a reply-only
follow-up is admitted.

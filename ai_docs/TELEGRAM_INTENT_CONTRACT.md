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

Adding an intent requires updating its typed source list; contract cardinality
tests then require a matching canonical entry. New user artifacts always bypass
follow-up helpers and enter a fresh risk check. A confidence/methodology phrase
cannot hide a later code, password, APK, screen-sharing, payment or other strong
danger request: the original full message is evaluated before a reply-only
follow-up is admitted.

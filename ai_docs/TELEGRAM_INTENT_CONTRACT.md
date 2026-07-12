# Telegram Intent Contract

Canonical Telegram intent ids use five namespaces:

- `meta.*` — questions about the bot;
- `victim.*` — first-contact human situations;
- `followup.*` — questions about a previous result;
- `panic.*` — emergency scenarios;
- `input.risk_check` — a fresh artifact or suspicious payload.

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

Adding an intent requires updating its typed source list; contract cardinality
tests then require a matching canonical entry. New user artifacts always bypass
follow-up helpers and enter a fresh risk check.

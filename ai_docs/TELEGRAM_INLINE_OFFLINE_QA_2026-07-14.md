# Telegram Inline Offline Corpus QA — 2026-07-14

## Decision

The local automated Inline sub-gate passed. The release-blocking real-client
matrix on Telegram Desktop, Android and iOS remains open.

This run reused the complete 1,000-dialogue perimeter through the production
`handleInlineQuery` entry point without sending the corpus to Telegram, an AI
provider, a reputation provider or a real database.

## Corpus

| Source | Cases |
| --- | ---: |
| Individual user turns from all 1,000 synthetic dialogues | 2,500 |
| Stateless follow-ups joined to their original risk turn | 930 |
| Mixed safe/danger clause cases | 363 |
| Synthetic credential-boundary cases | 12 |
| **Total source cases** | **3,805** |
| **Unique Inline queries** | **2,140** |

Language distribution: RU 1,270; UZ 1,269; EN 1,266. Every query is non-empty
and within Telegram's 256-character Inline-query boundary.

Inline is stateless. The 930 contextual follow-ups are therefore evaluated as
one Inline query containing the original risk turn plus the follow-up; this is
not a claim that Inline restored direct-bot session history.

## Enforced invariants

- the real Inline handler returns exactly one personal article per query;
- title, description and inserted message remain within 256/120/4096;
- every inserted message is valid MarkdownV2 and has the correct RU/UZ/EN
  continue button;
- expected risk reasons survive mixed safe prefixes and suffixes;
- safe controls remain safe or unknown, never suspicious or dangerous;
- acknowledgement and identity phrases route to concise localized small-talk
  replies, including reviewed typos and natural variants;
- a greeting, thanks or identity prefix cannot suppress a later OTP/PIN/CVV
  request;
- failure/help/rate-limit/too-long cards cannot satisfy a successful risk-case
  assertion;
- visible output is checked after MarkdownV2 de-escaping, so `\!` and `\.`
  cannot hide a leaked password or email from the test oracle;
- forward/reverse CVV, PIN and OTP punctuation variants are redacted, including
  `CVV #825`, `CVV (825)`, `614, CVV`, `825/CVV` and an unrelated number before
  the actual CVV;
- password-request wording remains available to the deterministic rules engine;
  a broad four-word passphrase regex was rejected because it could erase
  `asks_for_pin`;
- deterministic text scoring sees complete in-memory prose after embedded URLs
  are replaced with `[link]`, while AI, persistence and visible output receive
  only redacted text.

## External-sink boundary

- Telegram `answerInlineQuery` was mocked;
- Supabase was mocked and database mutations remained zero;
- global `fetch` was fail-closed and remained unused;
- every `runCheck` call used `channel=telegram`, `skipAi=true`,
  `skipUrlReputation=true` and `persist=false`;
- fixtures are synthetic and contain no user data.

This means no paid API quota was consumed. The result is not 3,805 Telegram
messages, not model training, not Bot API acceptance evidence and not proof of
client rendering or insertion.

## Verification

```text
npm run test:run
137 test files / 8,647 tests passed

npx tsc --noEmit
npm run lint
npm run build
npm audit --audit-level=moderate
```

## Deployment evidence

PR #100 passed application CI, coverage, migrations/schema/pgTAP, CodeQL,
Gitleaks and container/SBOM gates and merged as main `87c5ff5`. Railway
deployment `78dc6e9b-2464-4e3c-a6ed-c7b0f71cc432` reached `SUCCESS` with image
`sha256:78dd60cbd8b95c2d2ca84df3c917d5f997fe91bd92f6438fa65a3935afc1d057`.
`/healthz` and the protected polling-leader endpoint returned `200`.

No mass Inline corpus or AI call was made in production. This deployment proof
does not convert the local corpus into Bot API or real-client evidence.

## Remaining live gate

Complete `INL-002` on Telegram Desktop, Android and iOS in RU/UZ/EN: preview,
inserted result, 0/1/255/256/257 characters, Markdown/plaintext retry,
timeout/error UX, privacy, language and zero persistence. Do not mark
`BOT-004`, `INL-001` or `INL-002` Passed from this local run alone.

Unquoted multiword text immediately before the word “password” is inherently
ambiguous with ordinary prose. This run deliberately rejects a broad regex
that weakened risk scoring; it does not claim exhaustive free-form secret
recognition beyond the tested credential boundaries. Real-client privacy QA
must keep using synthetic credentials only.

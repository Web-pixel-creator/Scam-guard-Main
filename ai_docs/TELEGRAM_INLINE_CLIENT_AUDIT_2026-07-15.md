# Telegram Inline Client Audit — 2026-07-15

Status: all three screenshot-driven remediations are deployed; real-client
replay remains open.

## Outcome

The 41 screenshots in the owner-supplied Telegram Desktop batch are useful
pre-fix evidence. They show that the backend usually returned and inserted an
Inline article, but several responses were generic, ambiguous, stale or
incomplete. The deployed release now has specific handling and regressions for
the reproduced job, passport, link, numeric, phone/privacy, rate-limit and
delivery paths.

This audit does **not** mark the Telegram client gate Passed. All screenshots
were captured before the current fixes. PR #110 passed all application,
database and security jobs, merged as `581e71536e729253b73012baf5086241caf68e13`,
and Railway deployment `f5915159-ccaa-46bc-9e42-be8c521010be` of that exact
revision reached `SUCCESS` and passed the bounded no-AI/no-alert monitor.
Remote migration history remains current; linked dry-run reports no pending
migration and remote schema lint is clean. Direct live catalog grant/trigger
verification remains open. Desktop post-fix replay and all Android/iOS rows
remain open. Keep `INL-001` and `INL-002` outside Passed and keep `BOT-004` In
Progress.

## Batch 3 addendum

The owner supplied seven more Telegram Desktop screenshots under
`private/telegram-inline-qa/2026-07-15/desktop/user-batch-03/`. They establish a
more precise UX defect than Batch 2: changing the query did produce a fresh
result id in the backend, but most second-line questions retained the same
preview title and description. To a person typing in Telegram, the bot still
looked silent. Passport aftercare visibly changed only because it already had a
separate completed-action intent.

The affected second lines ask whether to trust the sender, whether a scheme is
fraud, whether a bank number from chat is safe, how to identify a substituted
link, and why the situation is suspicious. The seventh screenshot adds a
previously uncovered compromising-photo/blackmail phrase. The remediation
keeps the concrete first-line intent but changes the visible RU/UZ/EN title and
answer for each supported follow-up family. Compromising-photo wording now gets
action-first blackmail aftercare instead of the generic “send more context”
card.

The deployed release adds 36 localized visible-follow-up contracts, exact-title
checks across the 1,152-row generated context corpus, a regression against the
`дал`/`дальше` substring collision and a mismatch control so an unrelated
phone-number question cannot relabel a code warning. The automated cases keep
`skipAi=true`, `skipUrlReputation=true`, `persist=false`, zero external fetch
and zero database mutation. These seven screenshots remain pre-fix evidence,
not client acceptance. PR #110 deployed the remediation, but only a post-fix
client replay can close the visual acceptance rows.

## Batch 2 addendum

The second owner-supplied batch contains 30 Telegram Desktop screenshots under
`private/telegram-inline-qa/2026-07-15/desktop/user-batch-02/`. It extends the
first audit with three product-level failures:

1. Editing a useful first query by adding a concrete second line could keep the
   first result unchanged or leave the Inline list empty.
2. The preview repeated generic risk wording before the specific action, so
   Telegram truncated the part the user actually needed.
3. Safe user questions such as “what should I do now?” and ordinary words such
   as Uzbek `hozir` could distort severity instead of only preserving context.

The local branch fixes those boundaries without changing the privacy contract:
result ids now vary with the normalized query and rendered article; concrete
danger tails outrank generic context; suspicious human-intent descriptions no
longer prepend repetitive risk filler; real credentials remain masked; Inline
still uses `skipAi=true`, `skipUrlReputation=true`, `persist=false` and makes no
database mutation. Specific RU/UZ/EN contracts now cover code/sent-code,
passport request and aftercare, authority/legal pressure, earning/job, bank,
voting/link, tax, SIM replacement, family emergency, investment, unknown
contact, reply safety and next-step questions.

Representative Batch 2 evidence includes `4be66c7c…`/`6ad6eeb0…` for a changed
code query, `0a1828f4…`/`c6443a94…` for an earning-channel follow-up,
`7b8719b0…`/`6acb9087…` for official bank contact, `69c4735b…`/`278b7468…` for
voting-link context and `175a52cd…`/`3f644e12…` for the next-step wording.
These screenshots are pre-fix observations, not acceptance evidence.

## Defect-to-fix map

| Area                               | Pre-fix client evidence                                                                                | What was wrong                                                                                                                           | Remediation                                                                                                                                                                                                                                                                                                         | Live acceptance condition                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job fee                            | `644eb9ee…`, `7bb7dda5…`, `fa1b9b11…`, `038857ba…`                                                     | Inline copy was repetitive and the direct bot could answer “urgent transfer” instead of explaining the fake-job fee.                     | Job-fee intent is routed before generic transfer copy; preview is concise and inserted/direct-bot guidance is specific and action-first in RU/UZ/EN.                                                                                                                                                                | Desktop preview, insertion and direct-bot follow-up all say not to pay the employer/recruiter and do not use generic bank-transfer copy.          |
| Ambiguous number/phone             | `9eff32cd…`, `e50ec5a9…`, `9f8d6bfc…`                                                                  | “Add what they ask” did not say where; bare `12345678` could become a US/Canada phone passport.                                          | Bare 6-8 digit input gets “code or incomplete number”, never a country/owner inference; bare-phone recognition is narrowed and the prompt explicitly asks for a worded description of the other party's request.                                                                                                    | No raw short digits in preview/card; `12345678` is not classified as a phone; a full `+998…` phone still uses the phone passport.                 |
| Unknown contact and multiline link | `ff83f2f9…`, `919a0ea0…`, `bc0c81ba…`, `6ff36c70…`, `a57c4111…`, `b41934fb…`                           | Adding a second line about a received link could leave the first generic “unknown person” answer unchanged.                              | Multiline link context has explicit preflight priority unless a stronger concrete danger is present; a checked URL/APK is not falsely described as missing.                                                                                                                                                         | A changed multiline query produces a link-specific second preview and inserted card; no claim that the URL was checked when no URL is present.    |
| Code request and already-sent code | `cd9554aa…`, `3e175f39…`, `fbbf54f2…`, `6800cb57…`, `71afac64…`                                        | Preview text could truncate or duplicate generic advice; secret-order variants needed stronger masking.                                  | Code and sent-code routes remain action-first; OTP/PIN/CVV/password permutations are re-masked before presentation, including reverse order and punctuation.                                                                                                                                                        | Preview/card never echo a real code, distinguish “do not share” from “already shared”, and show the correct next action.                          |
| Rate limit while typing            | `56f87d34…`                                                                                            | The client displayed another 30-second wait after editing, which looked like a frozen or reset countdown.                                | Only guarded stateless Inline previews receive 60/minute; error/rate-limit articles use zero cache, successful articles use a short cache.                                                                                                                                                                          | Retry seconds refresh instead of reusing a cached card; ordinary human editing does not immediately hit the default 10/minute check budget.       |
| Passport request                   | `90144363…`, `d893df8c…`, `20fe272e…`                                                                  | Guidance was generic and the preview/card could be incomplete or unclear about whether to send the document to the bot or requester.     | Personal-data/passport intent gets complete action-specific copy and yields only to stronger concrete danger.                                                                                                                                                                                                       | Preview and insertion explicitly say not to send the passport/document to the requester and ask for sanitized context, never the document itself. |
| OneID/government                   | `1b788b2d…`, `07fd421e…`                                                                               | Needed confirmation that a government-login phrase would not drift into another intent.                                                  | Specific OneID/government route remains ahead of unrelated substring matches.                                                                                                                                                                                                                                       | RU/UZ/EN preview and insertion tell the user to open the official service independently and not share a login code.                               |
| SIM/operator                       | `e443dc79…`, `4330f389…`, `4a190eea…`                                                                  | Follow-up context needed a clearer independent callback action.                                                                          | Specific SIM/operator copy remains action-first and preserves the added question/context.                                                                                                                                                                                                                           | Preview/card name the SIM/eSIM risk and direct the user to the operator's independently found official number.                                    |
| Family emergency impersonation     | `5b3019f0…`, `0d3c56b6…`, `3d7eb061…`                                                                  | The first result was useful, but the follow-up needed to remain tied to identity verification rather than generic transfer advice.       | Human-intent priority and inserted copy preserve callback/code-word verification.                                                                                                                                                                                                                                   | Added “how do I know?” context keeps the saved-number callback/family code-word action.                                                           |
| Investment/romance/unknown         | `bbe39e48…`, `ba82561d…`, `3fa4480c…`, `7debf72d…`, `00e86256…`, `a12d6a0b…`, `f34b60a7…`, `a4720e0d…` | Initial previews were mostly useful; second-line context had to keep the correct intent instead of collapsing to a generic reply.        | Result-aware intent routing and stronger preflight priorities preserve investment, romance and unknown-contact semantics.                                                                                                                                                                                           | Each second query produces its own matching preview/card and avoids invented identity or safety claims.                                           |
| Visibly unchanged follow-up        | Batch 3 `01`-`04`, `06`                                                                                | The query-scoped id changed, but the preview copy did not visibly answer trust, scam, bank-number, fake-link or next-action questions.   | RU/UZ/EN follow-up families now produce a distinct visible title and answer without discarding the concrete first-line safety intent; incompatible families fall back to the safer concrete card.                                                                                                                   | Replaying each pair visibly changes the preview and inserted card while keeping the same concrete safety family and no invented verification.     |
| Photo blackmail                    | Batch 3 `07`                                                                                           | “They have compromising photos of me” stayed on a generic safety card and omitted immediate blackmail aftercare.                         | Shared victim/Inline routing recognizes compromising-photo wording and gives action-first no-pay, preserve-evidence, trusted-person, block/report and official-police guidance in RU/UZ/EN.                                                                                                                         | Desktop/Android/iOS preview and insertion show specific blackmail guidance without echoing private material or claiming the threat is verified.   |
| Safe-prefix/danger-tail bypass     | Corpus regression; the client batch motivated multiline/compound replay.                               | A neutral or safe phrase could previously suppress a dangerous sibling clause in some long/compound forms.                               | Clause-local RU/UZ/EN parsing covers punctuation, contrast/sequence and conjunction segments with their own action while preserving object lists and true negations.                                                                                                                                                | Safe-first and danger-first live samples both show the dangerous action; safety-only controls remain neutral.                                     |
| Missing/stale second result        | Owner observation plus second-query screenshots; failure branch is automated.                          | A transient `answerInlineQuery` failure could be logged and then acknowledged, so the user saw no result and the update could not retry. | Network/no-code/5xx gets one bounded immediate retry; 429 instead carries bounded `retry_after` to polling. Exhaustion keeps the lifecycle retryable. Strict Inline work may run four-wide, and different-user Inline can read ahead during one slow stateful update without crossing the acknowledgement frontier. | Two ordinary distinct queries render in order. Do not force a production outage: timeout/429/5xx exhaustion remains automated evidence.           |

The abbreviated ids above map to exact paths in the manifest below.

## Local verification

- Complete project suite on the current remediation branch: 10,172/10,172 tests
  passed across 475 test files.
- New Inline context corpus: 1,175/1,175 passed, including 1,152 RU/UZ/EN
  dialogue mutations plus privacy, safe-control and contract checks.
- Inline focus after the ambiguous-numeric change: 160/160 passed.
- Risk suite: 1,411/1,411 passed.
- Merged polling/lifecycle/API/Inline reliability focus: 234/234 passed.
- Coverage passes the repository floor: 84.87% statements, 79.06% branches,
  90.91% functions and 86.92% lines.
- TypeScript, lint with zero errors and production build passed.
- `npm audit`: zero known vulnerabilities.
- Corpus/handler checks keep AI, external URL reputation and persistence
  disabled; the local remediation did not spend a paid model API budget.

## Evidence limits

- The 41 Batch 1, 30 Batch 2 and seven Batch 3 screenshots prove pre-fix client
  behavior only. They do not prove the current production release renders
  correctly in any Telegram client.
- Local handler/API tests do not render Telegram Desktop, Android or iOS and do
  not prove Bot API acceptance of a real `inline_query_id`.
- PR #110 proves the reviewed code and exact Railway image are deployed and
  healthy. It does not prove that Telegram Desktop, Android or iOS refreshed,
  rendered or inserted the changed second result.
- PR #106 provides application/coverage CI, CodeQL, Gitleaks, container/SBOM
  and clean-database migration/schema/35-pgTAP evidence. Historical deployment
  `39cf9f6d` of the exact merge revision reached `SUCCESS`; linked production
  migration history, no-pending dry-run and remote schema lint checks passed.
- Local Docker was unavailable, so local container/Postgres evidence was not
  invented. The equivalent clean-database, pgTAP, schema, container and secret
  gates passed in CI; linked migration-history/no-pending/schema-lint checks
  passed. Direct live catalog owner, `search_path` and grant checks were not
  available and remain open.
- The transient delivery failure branch is intentionally tested with mocks. Do
  not break production networking or trigger provider limits for a screenshot.
- At-least-once processing plus fencing is preserved; this audit does not claim
  end-to-end exactly-once delivery.
- No screenshot is evidence that a person, number, domain or sender is safe or
  fraudulent. It evaluates product behavior only.

## Screenshot manifest

All files are ignored local evidence and must remain private. Paths are relative
to the repository root.

### Job and generic-transfer mismatch

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-644eb9ee-e38e-4364-a3b7-95472d10d687.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-7bb7dda5-b6e7-42b5-817e-0c56888ec7af.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-fa1b9b11-0b13-4557-8ece-6c1a3e2236ba.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-038857ba-93fc-4bac-8daf-da5dd93eee40.png`

### High-risk code preview/insertion

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-d655c2e2-964f-4ddc-9f08-c94f9d9e6b30.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-081b6631-6190-417f-8004-33d1ca35ddb1.png`

### Ambiguous number and phone passport

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-9eff32cd-4863-4b84-8a3e-fb9b1ccb22cb.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-e50ec5a9-9050-4032-b284-cb641114e29e.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-9f8d6bfc-2db8-4c9c-8dd5-2133ecbeb718.png`

### Unknown contact and multiline link context

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-ff83f2f9-13f3-4842-b57f-97251be7835b.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-919a0ea0-6a4d-4ce3-a0cb-144e5acd3b06.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-bc0c81ba-f841-4b4f-a184-fc75cfd160da.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-6ff36c70-bf1a-4767-bd68-ddf08944ac25.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-a57c4111-df46-40f9-9f3c-e1df60a17fed.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-b41934fb-d7dc-41e4-9e85-ab6197158adb.png`

### Code request, sent-code recovery and rate limit

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-cd9554aa-6a5c-4e99-ac45-47218a8f765d.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-3e175f39-41ed-4554-977e-420dc30947c4.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-fbbf54f2-d9a7-465a-a14e-f3844ef4f991.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-56f87d34-39f7-44b2-ad83-a80751291fa2.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-6800cb57-af33-436b-b10f-9a8f5756fcbc.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-71afac64-1db5-472d-9224-b8c396871fde.png`

### Passport, OneID and SIM/operator

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-90144363-d671-4042-ba18-718e9f9cc173.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-d893df8c-8faa-42d5-b20e-7941d724ea75.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-20fe272e-d7d0-4ab2-b863-591e67d6771b.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-1b788b2d-7216-41e7-ba22-bb425836b0f5.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-07fd421e-7a2e-4bf3-83af-1b6dd51fdbaa.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-e443dc79-93a6-43c5-9f67-cb6862518d04.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-4330f389-0806-4cba-808c-0d2760377eab.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-4a190eea-891f-4ce0-a015-a66d395f3f62.png`

### Family impersonation

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-5b3019f0-e1c7-4a0e-9927-5fbf1bdf705e.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-0d3c56b6-aea4-45cb-81a9-93023e2f8c2b.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-3d7eb061-03ed-4b0a-829b-ba012cf5a824.png`

### Investment, romance and unknown contact

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-bbe39e48-9e7e-4c6f-a7bc-01a04f5ae6b1.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-ba82561d-af7d-4d04-bcd4-f5b7abf87e95.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-3fa4480c-e664-48db-abe4-11a5f8a1c670.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-7debf72d-7f3a-4397-b2cf-b100cda9c8ed.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-00e86256-b74f-473a-8870-d52a016b552c.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-a12d6a0b-94ea-41dc-9b46-d1168bd31d5c.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-f34b60a7-12c2-494a-9872-dd3bb855de4e.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-a4720e0d-5ab6-4989-b7bc-b4fff3785039.png`

### Local QA case list

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-01/codex-clipboard-341637d4-a359-46d8-8930-ee1281260824.png`

Manifest total: 41 files.

### Batch 3 — visibly unchanged follow-ups and photo blackmail

- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-03/01-code-trust-followup.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-03/02-earning-scam-followup.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-03/03-bank-chat-number-followup.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-03/04-voting-fake-link-followup.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-03/05-passport-aftercare-working.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-03/06-next-step-first-line.png`
- `private/telegram-inline-qa/2026-07-15/desktop/user-batch-03/07-blackmail-followup-ignored.png`

Batch 3 total: seven files. Combined local pre-fix evidence: 78 files.

## Production release evidence

- PR #110 merged as `581e71536e729253b73012baf5086241caf68e13` after
  application lint/type/test/build, coverage, Supabase migration/schema/pgTAP,
  CodeQL, Gitleaks and container High/Critical plus SBOM jobs all passed.
- Railway deployment `f5915159-ccaa-46bc-9e42-be8c521010be` reached `SUCCESS`
  from that exact merge revision. Image digest:
  `sha256:b094e4592d2492bece73f64a21eeb802792b7ec32996370800b2fa0efbe84ddb`.
- The post-PR #110 bounded monitor passed home/health `200`, missing webhook
  secret `401`, expected polling-mode webhook `503`, Telegram `getMe`, delivery
  `mode=polling` with pending updates `0`, and protected polling leader `200`.
  AI and alerts were disabled; the check made no paid model call and sent no
  Telegram message.

- PR #108 merged as `da4c0a259a228d864432a77ccb1b3291468c52cf` after
  application lint/type/test/build, coverage, Supabase migration/schema/pgTAP,
  CodeQL, Gitleaks and container High/Critical plus SBOM jobs all passed.
- Railway deployment `a1c6eab5-a8da-4341-a7ff-387212cd3784` reached `SUCCESS`
  from that exact merge revision. Image digest:
  `sha256:9cc2da03c7e57eb29f53fadb332596a48e154ff9be372620349943eeae1155e9`.
- The post-PR #108 bounded monitor passed home/health `200`, missing webhook
  secret `401`, expected polling-mode webhook `503`, Telegram `getMe`, delivery
  `mode=polling` with pending updates `0`, and protected polling leader `200`.
  AI and monitor alerts were disabled; the check made no paid model call and
  sent no Telegram message.

- PR #106 merged at `2026-07-15T05:49:51Z` as
  `87bf181b4d4df92e438e768f83ab4c02883f1d9f`. Its final CI run passed
  application lint/type/test/build, coverage, clean-database migration apply,
  schema lint, 35 pgTAP assertions, CodeQL, Gitleaks and container
  High/Critical plus SBOM gates.
- Production Supabase now records both
  `20260712142514_reconcile_admin_role_lifecycle.sql` and
  `20260715040836_telegram_polling_stale_leader_reclaim.sql`. Local and remote
  migration histories match, a linked dry-run reports the remote database is
  up to date, and linked schema lint reports no errors.
- Railway deployment `39cf9f6d-294d-410a-9cef-972e41829561` reached `SUCCESS`
  from the exact merge revision. Image digest:
  `sha256:f289ebed30a5b96b3012904361b6aaa8a42cded15cd5fc1d75984690c5e84f11`.
- The bounded production monitor passed with AI and alerting disabled:
  home/health `200`, missing webhook secret `401`, valid secret with the
  intentionally disabled polling-mode webhook `503`, Telegram `getMe` valid,
  delivery `mode=polling`, pending updates `0`, and protected polling leader
  `200`. It sent no Telegram message and made no paid AI call.
- A one-minute local in-memory polling soak completed 600/600 updates with zero
  duplicate effects, zero lost updates, queue depth returning to zero, bounded
  memory/event-loop behavior, stale-leader rejection and offset-loss replay.
  It used no Telegram, Supabase, reputation provider or AI network call.

These facts close the migration/deployment/health preconditions for client
retest only. They do not render a Telegram result list, insert a card or turn
any pre-fix screenshot into a pass.

## Required live retest checklist

1. [x] Record the release commit, successful application/Supabase CI run,
       historical deployment identity and migration-history/no-pending/schema-lint
       evidence. Active production contains exact merge `581e715`, deployment
       `f5915159-ccaa-46bc-9e42-be8c521010be` and image
       `sha256:b094e4592d2492bece73f64a21eeb802792b7ec32996370800b2fa0efbe84ddb`.
2. [x] Confirm `/healthz`, authenticated polling-leader health and Telegram delivery
       state are green with zero unexpected pending updates.
3. [ ] On Telegram Desktop, replay the job-fee preview, insert it, open the bot and
       send the equivalent direct phrase. Confirm all three use job-specific,
       non-repetitive guidance.
4. [ ] Replay passport and multiline-link cases. Confirm the second line changes the
       preview, guidance is complete and the bot never requests the real document,
       code or private screenshot.
       Also replay all seven Batch 3 cases: the trust, scam-confirmation,
       bank-number, fake-link and next-action pairs must visibly change; the
       passport row must keep completed-action aftercare; the compromising-photo
       row must show specific no-pay blackmail guidance.
5. [ ] Replay `12345678`, a safe synthetic 6-digit value and a safe synthetic full
       `+998` number. Confirm short digits are masked/ambiguous, while only the full
       phone enters the phone passport.
6. [ ] Type a bounded sequence of ordinary, distinct Inline queries. Confirm each
       second result replaces the first and normal editing does not immediately
       show the default 30-second limiter. Do not use real credentials or spam the
       production bot.
7. [ ] Verify the rate-limit article with the controlled QA procedure only if the
       release owner approves it. Capture the countdown twice and confirm it is not
       frozen by cache. Do not force 429/5xx or break networking; mocked tests own
       that failure evidence.
8. [ ] Replay the affected RU, UZ and EN copies on Desktop, including safe-only and
       safe-prefix/danger-tail controls. Confirm specific actions, readable preview
       length and no AI-style or invented-verdict wording.
9. [ ] Repeat the 17-case bounded client matrix on Android and iOS, capturing preview
       and insertion where safe. Keep 257-character and forced timeout/error cases
       automated-only.
10. [ ] Read back count-only production evidence: no new `checks`, chat sessions or
        moderator messages from Inline; no raw query, code, phone or document value
        in logs/evidence.
11. [ ] Run the companion production smoke/monitor after the client pass. Only then
        update the workbook: `INL-001`/`INL-002` may move according to actual evidence;
        `BOT-004` remains In Progress until its wider real-client dialogue gate is
        separately complete.

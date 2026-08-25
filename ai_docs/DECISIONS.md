# Decisions

Architecture and product decisions. Prepend newest entries; keep them short and
use a new unique id.

## D-093 - Documentation-only commits may skip Railway deployment only after proof

**Status: local candidate on 2026-08-20; not active in Railway.** The proposed
`railway.toml` Watch Paths remain local until an approved configuration merge,
post-deployment manifest/read-back and a separate documentation-only proof.

Runtime source and configuration changes remain deploy-eligible. Root Markdown
and `ai_docs/**` may be excluded only after Railway confirms the merged manifest
is active. The first merge changes `railway.toml`, so it remains
deployment-eligible and is expected to create an ordinary deployment and a new
exact-release observation boundary; that deployment cannot prove the later
documentation-only skip.

After activation, one separate docs-only commit must pass its required GitHub
checks while the active Railway deployment id, commit and image remain
unchanged. Until that evidence exists, every merge to `main` is treated as
deployment-eligible.

## D-092 - Direct primary results retry only after a definitive no-effect outcome

**Status: deployed.** This policy is part of the production application
baseline recorded in `CURRENT_STATE.md`.

`sendMessage` separates three outcomes. A validated transient Bot API rejection
or a pre-fetch config/fence failure is definitive and safe to retry; Direct
first performs a context-neutral sequenced/fenced session claim, then releases
the durable update with a sanitized 1-60 second delay if the send is rejected.
The claim may preserve the resolved language but never writes `lastCheck` or
scenario context. A validated permanent rejection is drained without rollback
so an unreachable chat cannot poison the webhook/polling frontier or leave
phantom unseen context.

A timeout, network rejection or malformed post-fetch response is ambiguous:
Telegram may already have accepted the primary card. It is therefore
acknowledged without replay, keeps the saved check context and suppresses
Guardian/trusted-contact effects. Webhook returns `503` plus bounded
`Retry-After` only for the known retryable control error; polling holds the
contiguous frontier for the same delay.

Successful or ambiguous delivery performs a second session write with the same
`update_id`; the SQL `>=` guard permits this context commit. If that post-send
commit fails or becomes stale, the primary result is not replayed and secondary
effects stop. The failure remains in operator logs but does not ask the user to
repeat a possibly completed action.

This is an at-least-once containment policy, not an exactly-once outbox. A
process crash after Telegram accepts a message but before durable completion can
still lead to a duplicate after lease recovery.

## D-091 - Recurring monitoring is cost-free; provider probes require explicit bounded opt-in

**Status: deployed.** Scheduled production read-backs have confirmed the
disabled/no-request baseline; the exact current evidence is recorded in
`CURRENT_STATE.md`.

The half-hour production monitor is a baseline availability/delivery check, not
a recurring billable AI transaction. It explicitly sets
`MONITOR_CHECK_AI=false`, receives no `OPENAI_*` secrets and records the
disabled provider check as OK without invoking the request dependency. Baseline
warnings fail and alert so they cannot become green canary observations.

Provider reachability is an independent false-by-default manual workflow job.
Only the exact boolean input `check_ai_provider=true` enables one `--ai-only`
request; missing key, any non-2xx response, timeout or network failure is fatal.
The job uses GitHub status for alerting and receives no Telegram credential.
Manual runs use a separate concurrency identity and cannot cancel scheduled
observations. The broader `prod:smoke` similarly needs the explicit
`--check-ai` CLI flag, so inherited Railway keys cannot trigger spend.

Only scheduled no-AI baseline runs count toward the 144-observation canary.
Manual probes are separately approved/budgeted evidence, and a change to
monitor code, workflow or eligibility policy restarts the canary.

## D-090 - Functional recovery and automated voice checks do not close human or SLA gates

A successful logical restore, catalog/RLS checks and synthetic service flows
prove functional recoverability. They do not prove an RPO SLA or measured RTO
without snapshot-frequency basis, complete start/end and per-phase timing,
retained error classification and a named owner. Supabase Free therefore keeps
the target RPO explicitly unguaranteed.

Likewise, OGG validation, transport smoke and provider transcript replay do not
replace human listen-through of every prerecorded RU/UZ/EN asset or real-client
RU/UZ Voice-in/STT acceptance. These evidence classes remain separate release
gates.

## D-089 - Local secrets and linked database mutations require two independent controls

Git ignore prevents accidental tracking but is not filesystem access control.
Workstation secret files must be owner/admin-only. A raw `supabase ... --linked`
mutation is not an approved operator path: the repository wrapper hard-blocks
the known production ref and requires the linked ref, all staging environment
refs and an explicit manual staging-ref confirmation to agree before a fixed
list or no-change dry-run executes. The one-time repair and generic mutating
push recipes were retired after staging closeout, and the child CLI receives
only a minimized system/proxy/Supabase-CLI environment. This local guard does
not authorize a staging or production change.

## D-088 - Family alert claims expire through scheduled retention

`expires_at` plus opportunistic cleanup is insufficient for an inactive Family
Shield relationship. Metadata-only notification claims must be deleted by the
existing scheduled `private.prune_app_retention()` job when
`expires_at <= as_of`. Active relationships and future claims remain intact;
the maintenance function stays service-role/private only.

## D-087 - Dynamic response compression propagates failure and honors refusal

The dynamic Brotli/gzip wrapper must propagate upstream errors, downstream
cancellation and request abort through one stream pipeline. Strict
`Accept-Encoding` parsing must preserve `Vary` and return `406` when the client
forbids Brotli, gzip and identity. Nitro's earlier static asset handler bypasses
this wrapper, so its incomplete general `q`-weight negotiation remains an
explicit upstream/static-serving limitation rather than a falsely closed gate.

## D-086 - Admin authorization requires AAL2 at both application and RLS boundaries

An `admin` role alone is not sufficient for protected access. Admin server
functions require an AAL2 Supabase session, and direct authenticated
PostgREST/RLS policies must require the same role-plus-`aal2` predicate.
Confirmed public rows keep their ordinary public policy and service role keeps
its server-only RLS bypass. Production/Railway must explicitly configure the
application flag; missing or invalid configuration fails closed.

## D-085 - Public checking is one auto-detecting flow; admin decisions are deliberate

The homepage must not present visual tabs that do not change validation or the
server request. Phone, Telegram, URL and message values share one labelled
auto-detecting input; screenshot OCR is the separate supported upload action,
and APK is not advertised as a direct upload until that capability exists.
Prefilled verdicts are explicitly demos. Privacy copy describes masking,
non-publication and non-storage of secrets rather than claiming that no
information is ever retained.

The authenticated admin route is task-first: queue and real status appear
before educational guidance. Explicit QA/smoke records may be hidden locally in
the current view but are never deleted. Report moderation and appeal outcomes
require a second confirmation step. These UI controls do not weaken auth,
server validation, audit history or existing mutation boundaries.

## D-084 - Approved redesign wraps the production data and security boundaries

The warm-white editorial redesign is a presentation layer shared by `/` and
`/admin`. The homepage hero must use the existing `CheckInput`, OCR, result and
report paths, and all established educational, privacy, directory, trend,
emergency and community content remains present. The admin redesign must retain
real Supabase authentication, role checks, queries and moderation mutations;
visual review must never introduce a local auth bypass. The exact striped
background and reduced-motion-safe floating-points CTAs are part of the shared
system. Railway deployment is allowed only after explicit user approval and
local build, lint and responsive verification.

Localhost and deployed hosts both show the real aggregate response. Loading
states are explicit and an all-zero response remains an honest all-zero state;
the UI must not substitute a remembered production baseline.

## D-083 - Direct and Inline preserve one specific human-scenario contract

Direct chat and stateless Inline may use different transports and persistence
boundaries, but once deterministic rules prove a narrow human scam scenario
they must preserve the same topic and immediate safe action. Generic transfer,
stranger or preflight wording cannot erase stronger bank/police impersonation,
SIM swap, remote-access, parcel, tax, loan, charity, romance/extortion, support
or QR-login evidence. Completed-incident aftercare remains stronger than an
ordinary suspicion route; explicit official portal/app document submission is
the safe control.

Language is resolved from each current RU/UZ/EN message with the stored profile
used only as fallback. That reply-local choice must not mutate session language,
and Inline must not create session state. Intent matching may use NFKC,
invisible-format removal and conservative confusable repair only on a separate
classifier view; original text remains subject to sink sanitization. OTP, PIN,
CVV, password and recovery values are never repeated in visible guidance.

Direct chat may retain one recent victim-guidance intent for 20 minutes so a
short «already sent/installed» reply receives containment instead of a cold
check. The snapshot is chat-scoped and enum-only (`kind`, optional
`askedContext`/`scenario`, timestamp); it never contains raw text, amount,
recipient, phone, URL, file or credential. A concrete artifact and a negated
completion always bypass this context. Inline remains fully stateless.

A Telegram surface word cannot erase stronger bank/card code-theft evidence.
Uzbek confirmation and next-step turns must retain recent enum-only bank/code
plus emergency context. A safe-account request, including the common Russian
`безапасный счет` typo, must say directly not to transfer money and must not
collapse to generic call advice.

The release gate is deterministic and offline: the 1,080-case adversarial
matrix must pass both Direct and Inline semantic oracles, the 1,175-case Inline
context suite must preserve preview/insertion behavior, and full project gates
must pass without paid AI, production Telegram calls or deployment.

## D-082 - Polling batches preserve stateful order and a contiguous ack frontier

The single DB-fenced polling leader requests 20 updates per `getUpdates` call
by default; the Bot API wrapper clamps explicit limits to `1..100`. Before any
lease or handler side effect, the entire batch must have safe-integer, strictly
increasing `update_id` values at or above the requested offset. Message,
callback, hybrid and unsupported-shape records never reorder relative to one
another. Strict-Inline-only work runs in just-in-time lifecycle chunks of at
most four. While one stateful update is in flight, bounded read-ahead may include
only following Inline updates for known different users; same-user and
unknown-user Inline waits, and the next stateful/unsupported boundary is never
crossed. The polling-scoped same-user serialization bypass is ignored for every
stateful or webhook update.

Offset advances only through the contiguous acknowledged frontier. Work after
the first failed Inline sibling may already be durable `completed`; replay then
skips that sibling, but the local frontier never jumps over the failure.
Transient `answerInlineQuery` network/no-code and 5xx failures use the 2.5-second
Bot API deadline, get one delivery retry, then fail the lifecycle with a
sanitized error. A 429 is not immediately retried: bounded 1-60-second
`retry_after` metadata is carried through lifecycle release to polling, and
concurrent failures honor the longest required delay. Entity-parse failure gets
one plaintext retry; a permanent rejection is drained so an expired query
cannot block all later work.

A newly current polling leader may reclaim an active processing row owned by a
superseded polling leader after a 15-second drain grace, longer than the bounded
Telegram outbound-effect timeout. Reclaim increments the processing fence and
attempt count; the old worker remains fenced, while a current owner and
webhook/non-leader lease remain protected. Renewal has a five-second deadline
and conservative local expiry so an uncertain old process stops new long polls.

D-082 supersedes only the `limit=1`/one-at-a-time processing granularity in
D-072. D-072's metadata-only privacy boundary, singleton leader, lifecycle and
outbound-effect fencing, completion-before-offset recovery and at-least-once
(not exactly-once) delivery contract remain unchanged.

## D-081 - Inline release evidence follows the observable boundary

Real Telegram clients prove preview rendering, insertion, language/layout,
0/1/255/256-character input and visible privacy. Handler/API tests prove states
that clients may prevent or cannot safely force: 257-character rejection,
timeout, `{ok:false}`, entity-parse plaintext retry, zero persistence and zero
external fetch. Production networking is never broken to manufacture a client
screenshot. The bounded client pack is 17 cases on each of Desktop, Android and
iOS (51 rows); it complements rather than repeats the 3,805-case offline corpus.

## D-080 - Conversational QA is deterministic, typed and offline

Human-style dialogue corpora exercise the same production classifiers,
response builders and typed side-effect contracts, but they never train a
model and never stand in for real Telegram-client acceptance evidence. Vitest
rejects every unmocked network request, so large RU/UZ/EN corpora consume no AI,
reputation, Telegram or production quota.

Bot-capability questions use strict grammatical frames and must yield to a
concrete artifact, a direct danger request or post-action emergency context.
Likewise, confidence or methodology wording is reply-only only when the full
original message contains no strong fresh-risk reason; a later password, code,
APK, screen-sharing, payment or identity-data request returns to the check path.
Risk text is evaluated by clause: a safety/neutral fragment may suppress only
its own action, never a later unsafe clause after punctuation or a contrast
word. Cross-clause pronouns retain the preceding typed object (OTP, card,
passport, PIN or CVV) rather than becoming a generic code. Explicit requests
for passport/personal identity data carry weight 20 so the deterministic
result is at least `suspicious`; technical addresses and process/transaction
ids remain neutral.

Generated context/state permutations are reported separately from authored
core phrases and unique user utterances. Review/merge/deploy plus real
Desktop/Android/iOS and Inline rendering/insertion remain independent gates.
The reviewable everyday artifact keeps 540 distinct first phrases and a second
question/answer for each, balanced across RU/UZ/EN; repeated punctuation alone
never counts as a separate dialogue.
Emergency text classification is a shared pure module used by both the real
handler and corpus generation, so active calls and first-person already-done
events cannot be documented with a different reply family than production.
Voice asset validation and provider-sanitized replay follow the same evidence
boundary: neither closes real RU/UZ/EN client STT behavior or the required human
listen-through of prerecorded Voice-out.

## D-079 - CI security gates scan the release shape, not only source tests

Every workflow action is pinned to an immutable commit and runtime versions are
fixed. CI enforces repository coverage floors above 75–85% by metric. A separate
workflow runs JavaScript/TypeScript CodeQL, full-history Gitleaks, builds the
actual Dockerfile, fails on fixed High/Critical OS or library findings and emits
a CycloneDX image SBOM. The SBOM is evidence inventory, not signed provenance;
attestation remains open until a stable published artifact digest exists.

## D-078 - Dialogue typo handling is a reviewed exact corpus

Common RU/UZ/EN typos and reply-to-bot phrases are admitted through an exact,
normalized golden map before broad regex routing. This expands realistic
multi-turn coverage without making safety intents fuzzy enough to swallow
unrelated text. New artifacts still bypass every follow-up mapping and stale or
orphan context rules remain unchanged.

## D-077 - Production Telegram evidence must match the active delivery mode

Webhook and polling are mutually exclusive production states. In polling mode,
an authenticated webhook `503` and empty webhook URL are healthy boundaries,
not bot failures; the polling leader and dedicated dispatch harness provide
handler/delivery evidence. Synthetic Inline webhook payloads may prove shutdown
and non-persistence only. Real Inline rendering/insertion requires a genuine
Telegram client query and is never inferred from a fabricated query id.

## D-076 - Admission and entitlement changes precede side effects

Public meta-intents claim the shared check budget before embed analytics, and
Telegram report/image paths claim the shared media budget before Bot API file
metadata or download. A denied request performs no protected downstream work.
The durable `admin` role is an exact projection of current confirmed-email
allowlist eligibility: allowlist deletion, email drift or confirmation loss
revokes it in the same transaction. Per-user advisory locks serialize competing
eligibility transitions. Production-monitor secrets are visible only to the
final monitor step; checkout/tool actions use immutable SHAs and a pinned Bun.

## D-075 - Secret minimization is enforced at every durable or chat sink

`redactText` begins with one RU/UZ/EN-aware credential sanitizer for labeled
passwords/passphrases, separated OTP/PIN/CVV values, labeled recovery phrases
and private keys, then applies the established phone/card/URL masking. Reports,
appeals, check/QR input, Inline articles and plaintext retry, public-post text/
previews/buttons, sessions and moderation alerts inherit or repeat that sink
boundary. QR Wi-Fi passwords, authenticator secrets and standard labeled
mnemonics are additionally removed before structured evidence can reach a
check row. Ordinary safety prose and numeric amounts remain intact.

## D-074 - Trust evidence is exact-subject and cannot lower independent risk

An official contact badge, phone passport or Safe override requires the whole
input to be that exact standalone phone, short code or Telegram handle. An
official token embedded in unrelated content is not exposed as verified
metadata. Official/news allowlists compare a lossless WHATWG/IDNA DNS identity;
the visual/transliteration skeleton is only additive suspicious evidence.
Provider image categories may affect presentation but cannot omit a visible
destination before deterministic URL/brand scoring.

## D-073 - Telegram intents have one side-effect contract

Meta, victim, post-check, panic and fresh-risk-input identifiers are namespaced
and mapped through one typed registry. The registry describes the response
action, allowed channel, persistence boundary, trusted-contact boundary and
copy safety policy. Reply-only intents forbid both check rows and trusted-person
delivery; direct risk checks keep normal persistence and private high-risk
notification, while Inline remains stateless.

The QA corpus separates authored phrases from generated dialogue states. One
canonical phrase plus reviewed reply-to-bot and typo variants per post-check
action/language is expanded through six safe surface variants and eight context
states, producing 1,872 reproducible rows.
The older live matrix actually contains 238 rows; documentation must not round
that value up to the previously recorded 239. A new artifact always bypasses
the follow-up layer and starts a fresh check.

## D-072 - Telegram updates use a single fenced getUpdates leader

The durable successor to D-070 is a single active `getUpdates` worker backed by
a service-role-only Postgres leader lease. The worker requests `limit=1`, begins
one metadata-only update lease, dispatches it, records `completed`, and only
then advances the Telegram offset. Restart after completion but before offset
advance is safe because redelivery observes `completed` and skips dispatch.

The database stores only `update_id` and operational status/lease/fence/timing
metadata. It never stores the Telegram payload, user/chat id, username, text,
URL, phone, media, OCR or AI output. Session reads/writes and Bot API effects
are checked against the current update fence; leader-owned work also requires
the current leader fence. The design is at-least-once: a network ambiguity
after Telegram accepts an outbound effect can still cause a duplicate message,
so copy and handlers must remain retry-safe and must not claim exactly-once.

Production cutover is explicit and ordered: deploy the migration and polling
code, set `TELEGRAM_UPDATE_DELIVERY_MODE=polling`, verify the authenticated
polling-health endpoint reports an active leader, then run
`npm run telegram:switch-to-polling`. The script refuses to remove the webhook
without an active leader and always uses `drop_pending_updates=false`.

## D-071 - Inline and post-check explanations share evidence truth

Inline and direct post-check methodology must use the same canonical ranked
reason collector. It includes deterministic reason codes plus explicit
official-directory and moderated-report metadata; unknown runtime reason strings
are ignored safely. `weird_domain` describes only unusual TLD/IP/parse-format
signals, while OneID/government phishing describes a visible text/action
pattern. Neither may claim a brand-domain comparison that did not run.

A shared concrete-artifact detector recognizes URLs, bare/IDN domains, Telegram
identifiers, actual code/card/phone values and dangerous files. A new artifact
always bypasses follow-up helpers; a meta-question such as "why must I not send
a code?" remains a follow-up. Recent-context arbitration is timestamp-based, so
a newer check wins over an older panic context. High-risk next steps come from
the exhaustive reason-to-protective-action policy instead of always assuming a
bank scenario.

## D-070 - Monotonic session writes are not a durable Telegram inbox

Independent revalidation showed that `last_update_id` prevents an older late
write but cannot serialize two application instances before they read and route
the same old session. It also does not close the crash window between the
shared dedup claim and actual dispatch. At that point SG-P1-009 remained in
progress and production had to stay single-instance until a privacy-reviewed
durable update lifecycle ordered processing and distinguished
processing/completed. D-072 now supplies that local implementation; production
cutover evidence is still required. No raw Telegram payload may be persisted
without a separate retention, encryption and access-control decision.

As containment, webhook registration pins `max_connections=1` and production
monitoring fails on drift. Telegram defines this only as a simultaneous HTTPS
connection limit, so it does not close the ordering or crash-recovery finding.

## D-069 - Telegram session writes are ordered by update_id

Webhook processing is serialized per Telegram user inside one Node process and
session persistence is additionally guarded across instances by the
service-role-only `save_telegram_session_sequenced` Postgres function. The
function atomically applies a JSON patch only when the incoming Telegram
`update_id` is not older than `telegram_sessions.last_update_id`; multiple
writes from the same update remain allowed. An older cross-instance write is a
stale no-op, not a storage outage.

Telegram may choose a random next `update_id` after at least a week without
updates, so `last_update_at` starts a new numeric epoch after seven days of
inactivity. This prevents a legitimate lower post-idle id from permanently
bricking the session, but does not change D-070's distributed-ordering limit.

The current `update_id`, loaded language and session-storage failure flag live
in Node `AsyncLocalStorage`, never in user data. A read failure in webhook
context now fails closed instead of inventing a blank session; a write/RPC
failure sets the same flag without logging database messages. After dispatch
the bot sends a plain RU/UZ/EN warning that the step context was not saved.
Check and unreadable-image results persist their safe snapshot before
publication and restore the previous snapshot if Telegram explicitly rejects
the main delivery. Same-user queue ownership is retained until handler work
actually settles; a timer must not release still-running JavaScript work.

The Postgres function is intentionally described only as a monotonic last-write
guard. D-070 records the remaining distributed ordering and crash-recovery gap.

## D-068 - Post-check helpers are actions, not new checks

Natural confidence, methodology, trusted-person, recheck and disagreement
phrases are deterministic `LastCheckFollowUpAction` values in RU/UZ/EN. They
run before `runCheck` only when no new URL, number, code, card, transfer or other
concrete payload is present. A trusted-person phrase gives manual safe-contact
guidance and never sends a Family Shield notification. A recheck request is
honest about privacy: raw links, text and screenshots are not retained, so the
user must resubmit the artifact before a new verdict can exist.

`LastCheckSnapshot.provenance` stores at most three enum-only methods, source
classes and limitation classes selected with the same exhaustive reason policy
as Inline. It never stores raw evidence, URLs, identifiers, OCR, provider
payloads or narratives. Methodology answers therefore explain visible-domain,
text, Telegram, official-directory, moderated-report or external-reputation
evidence without inventing hidden owner or sender verification.

## D-067 - Inline reason explanations are exhaustive and method-bound

Inline presentation does not use a partial hand-written hint map or detector
array order. `INLINE_REASON_POLICY: Record<ReasonCode, InlineReasonPolicy>`
assigns every deterministic reason an explicit priority, evidence method and
honest limitation. The selected RU/UZ/EN explanation distinguishes visible
text/URL/domain/phone/Telegram analysis, official-directory matches, moderated
local reports and configured external reputation sources without claiming
hidden Telegram data, sender identity, ownership or proof of fraud. Equal
priorities use a deterministic reason-code tie-break. Inline descriptions are
bounded to 120 characters; inserted messages retain the complete explanation.

## D-066 - Scheduled production security checks are mandatory

The scheduled GitHub production monitor explicitly sets
`MONITOR_REQUIRE_SECRET_CHECKS=true`. A missing Telegram bot token or webhook
secret is therefore a failed check and makes the process exit non-zero even
when `MONITOR_FAIL_ON_WARN` is false. Optional local/operator runs may still
leave this flag unset and report missing secret-backed checks as warnings. The
exit decision is independent of alert delivery, so an unavailable alert route
cannot turn a required skipped check into a green workflow.

## D-065 - Moderation aggregate divergence is an explicit failure

Telegram reputation synchronization is part of the privileged moderation
integrity boundary. Count-query errors or missing/invalid exact counts must not
be interpreted as zero, and a failed aggregate upsert must not be swallowed.
The sync throws a typed stage-only error so the admin operation cannot report
success while public reputation is cleared or stale. Because report/entity and
Telegram aggregate writes are not one database transaction, a failure is
reported as retryable partial completion; telemetry records only the bounded
stage and never DB messages or target identifiers.

## D-064 - Brand comparisons canonicalize both sides under one IDNA policy

Protected-brand URL comparison must not partially normalize only the checked
host. Browser-Punycode labels are decoded, NFKC/lowercased, stripped of exactly
one terminal DNS root dot and compared with registry aliases through shared
visual-confusable and bounded Cyrillic/transliteration keys. This supports
fully Cyrillic and hybrid-script labels while preserving exact segment and
official-domain controls. Text aliases use Unicode letter/number/mark
lookarounds; ASCII `\b` is not a valid boundary for Cyrillic brands. Raw checked
URLs remain separate display/input values; comparison keys are classifier-only.

## D-063 - Every risk reason selects a protective action explicitly

Telegram urgent advice must not be inferred from incomplete category sets.
`REASON_PROTECTIVE_ACTION` exhaustively maps every `ReasonCode` to a typed
`ProtectiveActionId` or an intentional `null` for context/protective signals
that cannot create high risk alone. New reason codes therefore fail TypeScript
until product-safe action semantics are chosen. `known_reported` stops the
interaction and asks for independent official verification; external phishing
and malware feed hits use link/APK avoidance. A high-risk formatter fallback
must never ask for more evidence instead of giving an immediate safe action.

## D-062 - Model narrative is never structured evidence

AI-authored `explanation` is untrusted narrative and cannot select a Risk
Passport kind or populate canonical visible/limits/bottom-line sections. A
deterministic producer must pass structured Telegram text through the separate
typed `TelegramPassportEvidence { provenance, text }` channel; provenance never
blesses a mixed explanation field. AI output safety is evaluated per action
clause, so a legitimate negated warning cannot exempt a sibling request to
transfer money, connect/sign a wallet or install an APK. Semicolon and common
RU/UZ/EN contrast/sequence boundaries define those independent clauses.

## D-061 - Canonical build locks are audited and dev binds loopback

The Docker build uses `bun.lock`, so a clean npm graph alone is insufficient.
Both npm and Bun dependency graphs must resolve patched toolchain versions and
pass their own audit. Vite is pinned to 7.3.6, esbuild to 0.28.1, and compatible
transitive Babel/js-yaml/brace-expansion fixes are locked. The Vite development
server binds `127.0.0.1` by default; external exposure requires an explicit CLI
`--host` override on a trusted network. Nitro production `HOST=0.0.0.0` remains
a separate runtime concern. Static tests protect package/lock/config invariants.

## D-060 - Production shared-quota degradation fails closed

A deployment-wide abuse budget must not silently become one fresh allowance per
Node process during configuration drift, hashing failure, RPC outage or invalid
RPC output. Production and Railway therefore return a blocked rate-limit result
for every shared-control failure. Local fallback is permitted only outside
production and is itself bounded to 4096 validated TTL/LRU keys; capacity
overflow denies new identities, and full expiry cleanup is rate-limited. This
trades temporary feature availability for bounded provider cost, moderation
queues and process memory. Live release proof must confirm no protected sink
runs during forced failure modes.

## D-059 - Untrusted pixel decoding is isolated and admission-bounded

Per-user download throttling does not protect the Node event loop from a highly
compressed, computationally expensive PNG/JPEG. Local QR decode therefore runs
in one per-process worker with a bounded total backlog, memory limit and hard
deadline. Source bytes/pixels and downscaled QR attempts also have explicit work
budgets. Saturation, timeout, worker crash and oversized input produce no decoded
QR evidence; the existing honest unreadable-image/AI fallback handles the user
flow. Production rollout still requires legitimate-corpus smoke plus a bounded-
memory soak and worker crash/restart validation.

## D-058 - Persistent displays fail closed, including Telegram custom schemes

Prepared displays and redacted narratives are persistence boundaries, not best-
effort presentation helpers. If a URL/APK cannot be parsed, its display becomes
`[link]`; the raw malformed value must never be reused. `tg://` and
`telegram://` identifiers are redacted as complete custom-scheme values before
report/appeal writes, Telegram draft storage or moderation. Valid HTTP(S) URLs
may retain a host/path indicator, but never credentials, query secrets or raw
malformed input.

## D-057 - External URL reputation receives origin only

URL paths can contain password-reset, invite, signed-download or bearer material.
Before any optional reputation-provider call, the URL is reduced to HTTP(S)
scheme/origin; userinfo, path, query and fragment are removed. Deterministic local
rules continue to inspect the full cleaned URL, so `.apk` and other path signals
remain available without disclosing them externally. Path-specific provider
coverage is intentionally traded for a strict privacy boundary.

## D-056 - Mutable official handles expire closed

Telegram usernames can be renamed or reassigned, so a historical source note is
not permanent verification. A Telegram contact expires 30 days after `verifiedAt`
unless its authoritative source is checked again. Expired entries remain in seed
history but are excluded from risk lookup, public counts/search and action links;
they cannot show a verified badge or alter a verdict. Static phone/emergency seed
lifecycle remains a separate provenance task.

## D-055 - Verified contacts are protective evidence, never a risk override

An official phone or short code proves only that the destination appears in the
maintained directory; it does not authenticate the caller or make the surrounding
request safe. `REASON_TRUST_IMPACT` must classify every ReasonCode at compile time.
A verified match may lower a verdict to `safe` only when all reasons are explicitly
informational or protective. Any risk-classified reason, including a newly added
code, fails closed and keeps the deterministic non-Safe verdict.

## D-054 - Inline output is a privacy boundary, not a mirror

Telegram Inline results can be inserted into another person's chat, so no
preflight or fallback branch may echo raw user input. Every display is masked at
the Inline presenter even when upstream code claims it is already safe;
malformed URL displays fail closed to `[link]`. Inline typing also skips
external URL-reputation providers, keeps `persist=false`/`skipAi=true`, and is
capped at Telegram's 256-character query boundary. First-contact language uses
`inline_query.from.language_code`; saved session language remains authoritative.
Bot API `{ok:false}` is observable without logging the query/result, and only
entity-parse failures receive one retry without `parse_mode`.

## D-053 - Repeated unsafe AI output slows explanations only

If the AI explanation provider repeatedly returns text blocked by
`ai-output-safety.ts` for the same rate-limit key, the app may temporarily skip
new AI explanation calls for that key. This cooldown must not block
deterministic scoring, safe advice, redacted persistence or normal user checks;
it is only a cost and abuse brake for adversarial probing of the explanation
layer.

## D-052 - Embed iframe is not sandboxed by default

The `/embed/check` widget is first-party Ishonch Guard code. The distributed
iframe snippet and local preview do not set an iframe `sandbox` attribute,
because the browser warns on the scriptable `allow-scripts` + `allow-same-origin`
combination that the React/Vite widget needs to load correctly. Embed exposure
is controlled by the `/embed/check` CSP `frame-ancestors` allowlist, strict
referrer policy and the widget's public-only API surface. If we ever need to
host untrusted partner code in the frame, move it to a separate origin first.

## D-051 - Public rate-limit IP trust is opt-in

Public check, report and appeal rate-limit keys must ignore client-supplied
proxy IP headers unless `TRUST_PROXY_IP_HEADERS=true`. That opt-in is valid only
behind a trusted edge proxy that overwrites or strips spoofed
`CF-Connecting-IP`, `X-Real-IP` and `X-Forwarded-For` values before traffic
reaches Node. If that proxy-chain proof is missing, keep the env unset/false and
use the direct request IP fallback.

## D-050 - Public impact separates raw activity from confirmed impact

Website impact counters may show aggregate check volume and risk-alert activity
as raw service activity, but report/loss impact is a user-facing trust claim and
must include only moderator-confirmed reports. `get_check_stats()` and
`getPublicStats()` fallback queries filter report totals, report-with-loss
counts and loss sums to `reports.status='confirmed'`. Homepage copy must keep
that distinction visible.

## D-049 - Embed framing is origin-allowlisted

The public embed runtime is frameable only by the app itself, localhost
development origins and explicit HTTPS origins configured in
`EMBED_ALLOWED_FRAME_ANCESTORS`. The `partner` query parameter remains a
sanitized display label only; it is not proof of origin trust and cannot expand
the CSP. Production partner launches must add the partner origin to the
server-side allowlist before distributing the iframe snippet.

## D-048 - Duplicate report evidence is retained privately

Same-day reports for an already-seen target are accepted without revealing the
dedupe decision to the submitter. They must still create a redacted
`reports.status='duplicate'` row so independent evidence is durable for admin
review and retention/audit policy. Duplicate rows must not refresh public
`entities`, change `entities.report_count`, or be treated as moderator-approved
reputation evidence.

## D-047 - Webhook dedup failures retry before side effects

Telegram webhook retries can replay state-changing updates. The local in-memory
fast path is not enough across instances, so dispatch may start only after the
shared `telegram_webhook_updates` claim succeeds or reports a duplicate. If the
shared claim is unavailable before dispatch, the webhook returns 503 with
`Retry-After` and does not mark the update locally, allowing Telegram to retry
without losing the update or duplicating side effects.

## D-046 - Public stats are cached aggregate reads

`getPublicStats` is a public website surface backed by service-role aggregate
queries. It must return aggregate-only values, keep expensive fallback reads
bounded, and use a short server-side cache with in-flight de-duplication so
visitor refreshes cannot multiply database aggregate work one-for-one.

## D-045 - Empty quick reports are incident-only

The homepage quick-report target field is optional. When it is empty, the client
must send the incident-only sentinel with `incidentOnly: true`, and the server
must also treat blank or dash-only placeholder targets as situation-only reports.
This keeps description-only reports useful for moderation/research without
creating public entity candidates or suppressing unrelated later evidence under
a shared placeholder hash.

## D-044 - Public entity report counts are confirmed counts

`entities.report_count` is user-facing reputation evidence and must count only
moderated confirmed reports. New report submissions may create or refresh a
private moderation candidate, but they must not increase the public count until
`moderateReportCore` confirms the report. Rejections also resync the count from
remaining confirmed reports so a follow-up decision cannot inflate or erase
existing reputation incorrectly.

## D-043 - Telegram image media fetch has its own early quota

Telegram photo/video-thumbnail checks must claim a cheap per-user image-download
budget before calling Telegram `getFile` or downloading bytes. The bucket uses
the existing shared rate-limit service under a separate
`telegram-image:<tg:userId>` key so media-cost protection does not halve the
normal final check budget. Core `analyzeImageCore` and `runCheck` rate limits
remain in place as defense in depth after bytes are available.

## D-042 - Benign image categories are not enough for safe

Structured Telegram image analysis may label a screenshot as a delivery SMS,
restaurant/menu QR, generic info QR or Telegram profile card. That category can
shape the explanation, but it must not by itself force a final `safe` verdict.
The `safeIfNoReasons` override is allowed only through
`isEvidenceBackedBenignImageContext`, which requires readable supporting text,
QR/profile signals and zero risk hints. Category-only or low-information image
evidence stays `unknown`.

## D-041 - AI image inputs require an allowlisted data URL

Any path that forwards an image to an external AI vision provider must first
parse the data URL server-side, require base64 encoding, allow only `image/png`,
`image/jpeg` or `image/webp`, and enforce the decoded screenshot byte limit. Web
clients are not trusted to keep the browser file picker contract. Core image
helpers also re-check the invariant before constructing AI `image_url` payloads.

## D-040 - Telegram report drafts store prepared targets only

Telegram `/report` is a multi-step flow, so unfinished drafts can sit in
`telegram_sessions.scenario_data`. Draft state must not persist raw report
identifiers or raw user evidence. Concrete targets are converted before save to
`{ type, hash, display, incidentOnly }`; description, scam type and city text is
redacted before persistence; retry payloads reuse the sanitized draft. Existing
legacy `scenario_data.value` rows are treated as read-once migration inputs and
must be converted or reset before any new save.

## D-039 - Telegram session state is scoped to one chat

Telegram user ids are not a safe session boundary by themselves because the
same user can talk to the bot privately and in group/supergroup chats. Any
stored state that can influence a later reply (`/report`, `/check`,
`lastPanicId`, `lastCheck`, Guardian Angel context) must carry
`scenario_data.chatScope` with the originating chat id/type. The router resets
active/contextual rows when the current update does not match that scope; legacy
unscoped rows are treated as stale instead of being reused across chats.

## D-038 - Modern SOS scenarios are rescue flows, not hidden reputation

Fake job, delivery/top-up, crypto/TON/wallet and government grant panic
scenarios provide immediate safe actions and official escalation paths. They
must not claim hidden Telegram facts, provider intelligence, source identity or
"definite scam" status by themselves. The user value is stopping payment,
code-entry, wallet connection, APK install or document sharing long enough to
verify the source through an official channel or trusted person.

## D-037 - AI voice-clone SOS verifies the person, not the voice

AI voice-clone guidance must not claim that the bot can prove whether a voice is
real from a Telegram call, forwarded voice note or short transcript. The safe
action is identity verification through an independent channel: call the person
back using a saved number, ask a family code word/private question and pause all
money/code requests until identity is confirmed. Bank escalation is shown only
when money/card access is already at risk.

## D-035 - Public reputation needs a correction path

Phone, Telegram, URL and APK reputation labels must be removable through a
moderated appeal flow before wider public launch. Appeals store only hashed
targets, masked displays and redacted reasons; they do not expose raw evidence
to public clients. Removing reputation hides the public label but does not
delete original reports or audit records, preserving moderation traceability.

## D-033 - AI output is untrusted until filtered

AI explanations may be influenced by user-controlled text, OCR or STT content.
Before an AI-authored explanation reaches Telegram/web or `checks.ai_explanation`,
it passes through `ai-output-safety.ts`. Unsafe requests for codes, CVV/PIN,
passwords, card/seed data, APK installs, wallet actions or payments degrade to
`null`; deterministic score, reasons and safe advice remain available.

## D-032 - Shared rate limits use Postgres first

For the current Railway/Supabase production topology, public check/report and
Telegram throttling use a service-role-only Postgres bucket table instead of a
new Redis/KV dependency. Raw rate-limit keys are HMAC-hashed before persistence,
and the app falls back to the existing in-memory limiter if shared storage is
unavailable or unconfigured locally. Redis/KV remains a later scaling option
only if Postgres bucket writes become a bottleneck.

## D-031 - Inline checks are previews, not analytics events

Telegram inline mode fires while the user types in another chat. Inline checks
therefore run rules-only (`skipAi=true`) and non-persistent (`persist=false`):
they may use deterministic scoring, verified contacts and moderated reputation,
but they must not call AI/OCR or insert partial queries into `checks`.

## D-030 - Phone intelligence is not reputation

Phone checks may show a "passport" built from public deterministic metadata:
country/calling code, Uzbekistan prefix/operator hints, format status and
official-directory match status. This is explanatory metadata only. The bot
must not claim owner identity, hidden scam labels, Telegram-style account age,
spam history or report volume unless that claim comes from a moderated Ishonch
Guard record or a lawful external provider with source/confidence labels.

## D-029 - Emergency first cards are compressed

`/panic` first responses should pass a 5-second panic test: one urgent action,
a calm human cue and a maximum of three immediate steps. Full contacts,
evidence guidance and disclaimers remain available through explicit follow-up
buttons, especially `panicctx:full` and `panicctx:contacts`. This preserves
safety information while avoiding a wall of text for stressed users.

## D-001 - Consumer-first, Telegram-first

Local pain is consumer scams: calls, SMS, Telegram pressure and fake payment flows. Build a consumer check/report tool first; keep B2B APIs as a later path.

## D-002 - Rules decide, AI explains

The numeric risk score comes from deterministic weighted reason codes, not the LLM. AI only explains the result or performs OCR. If AI is unavailable, verdicts still work.

## D-003 - Privacy by hashing and redaction

Store only hashed identifiers plus masked display strings. Redact OTP/card/phone/passport-like data before persistence. Screenshots are OCR'd in memory and discarded.

## D-004 - Moderation gate before public exposure

Reported entities become publicly visible only after admin confirmation. This prevents doxxing and weaponized false reports.

## D-005 - Allowlist-based admin bootstrap

Admin grants are explicit via `admin_allowlist`; first-user-is-admin behavior is not safe for production.

## D-006 - Two Supabase clients

Browser code uses the publishable key under RLS. Server code uses service-role only in server-only modules.

## D-007 - RU + UZ scam patterns

Rules include Russian and Uzbek-Latin variants because local scams operate in both languages.

## D-008 - TanStack Start server functions instead of a separate API

Typed server functions keep the app single-deployable. The Telegram webhook is bound at the server entry and delegates to a testable core handler.

## D-009 - Four local-scam reason codes

Added `asks_to_scan_qr`, `relative_in_distress`, `requests_card_digits`, and `threatens_account_block` without changing score thresholds.

## D-010 - Off Lovable: self-hosted Node/Docker deploy + provider-neutral AI

Lovable was used only to author the initial UI design. Production runtime is self-hosted Node SSR via Nitro `node-server`, shippable with Docker and Railway-ready. AI uses the OpenAI-compatible env contract: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, optional `OPENAI_BASE_URL`.

## D-011 - Research feed and deterministic privacy hardening

`pressauz` is treated as a local research feed, not a raw content source. New posts should be summarized into recurring tactics, mapped to `SCAM_COVERAGE.md`, then converted into reason-code proposals or education-only guidance with RU/UZ/EN copy and tests. Privacy is reinforced: report descriptions and OCR provider output are passed through deterministic `redactText`, so user safety does not depend only on prompt compliance.

## D-012 - Research-feed scam rules and `known_reported`

Added dedicated reason codes for recurring local patterns from the research-feed process: `known_reported` (50), `fake_delivery_payment` (35), `fake_boss_request` (30), and `malicious_file_bait` (35). `payment_before_service` received concrete marketplace/prepayment patterns. Confirmed high-risk entities now use `known_reported` instead of the old APK proxy boost, so explanations and analytics describe the real reason for the verdict.

## D-013 - Direct Vite/TanStack/Nitro config

Removed the historical `@lovable.dev/vite-tanstack-config` build wrapper and replaced it with explicit Vite plugins: TanStack Start, React, Tailwind, tsconfig paths, and Nitro `node-server`. This keeps the original Lovable-authored design while removing Lovable-specific build tooling from the production path.

## D-014 - Heuristic `payment` input detector

Added `looksLikePaymentInput` in `risk/detect.ts` so payment-flow messages can be classified as `payment` instead of generic `text` or accidental `url`. The detector is conservative: pure URLs/APKs/Telegram links keep their primary type, while mixed payment text needs payment action/context plus amount, currency, card, QR or provider signals.

## D-015 - Sensitive writes only through server functions

Direct `anon`/`authenticated` inserts into `checks` and `reports` are disabled.
Those tables can contain sensitive scam evidence even after masking, so all
writes must pass through server functions that validate, redact and hash before
using the service-role client. This also prevents public stat pollution through
direct `checks` inserts.

## D-016 - Panic mode is a contextual copilot

After a user selects a `/panic` scenario, the Telegram bot stores only the
scenario id and timestamp so short follow-up questions can stay contextual
("what next?", "bank number", "what should I say?"). The router remains
conservative: URLs, phone numbers, Telegram usernames, code-like secrets and
long suspicious text still go through the risk pipeline. This gives stressed or
elderly users guided next steps without storing raw emergency evidence.

## D-017 - Telegram images use structured evidence, not raw OCR scoring

Telegram photos/screenshots now pass through `analyzeImageCore` and
`image-intelligence.ts` before `runCheck`. The model returns JSON evidence, but
the app sanitizes it, merges deterministic risk hints from visible text, and
builds a rules-safe input. Benign restaurant/menu QR and delivery pickup SMS
screenshots can be shown as safe only when no reason codes match. QR login,
QR payment, OTP, APK and card-data requests still trigger normal scoring.

## D-018 - Research feed v1 remains narrow and test-backed

Public news/Telegram feeds are research input, not product copy. The first
v1 pack adds two generalized tactics only after tests: Telegram account
deletion/"Cancel" phishing (`telegram_account_takeover_phishing`, 50) and
card/SIM/account transfer recruitment (`dropper_recruitment`, 35). The first is
high-risk because it is an account-takeover action request. The second is
suspicious by itself and uses legally soft wording about financial/legal risk.

## D-019 - Telegram public metadata is presentation-only

Public `@username` and `t.me/...` checks may call Bot API `getChat` after the
rules-first verdict. The result can improve the explanation, but it must not
change score/level/reasons and must not invent account age, hidden scam labels,
spam history or report counts. Unknown or inaccessible Telegram targets should
ask for visible evidence: message text, screenshot, URL, payment request or code
request.

## D-020 - Telegram link intelligence must not hide limits

Telegram Link & Account Intelligence v2 originally kept limitations first
because result cards truncate long explanations. Telegram Evidence Brief v1
refines this: profile-only or unavailable usernames without scam context still
show the limitation first, but when local reason codes reveal a concrete
scenario (betting, casino, giveaway, wallet urgency, account takeover or
credential request), the scenario and safe next step come first. The limitation
must still appear in the brief, and the bot still must not invent account age,
hidden scam labels, Telegram report counts or spam history.

## D-021 - Situation-only reports do not affect entity reputation

When a user reports a situation without a concrete phone, URL, Telegram username
or payment target, the report is stored as incident evidence but must not create
or increment an `entities` row. This keeps the report flow useful for scared or
elderly users while protecting unrelated people/accounts from description-only
public reputation.

## D-022 - Phone reputation is moderated evidence, not caller identity

Phone checks may show Ishonch Guard confirmed report counts only after the
existing `entities` moderation gate. The app must not infer owner, SIM age,
carrier-private data, hidden scam labels, Telegram report history or spam
history for a number. Confidence is derived only from confirmed moderated report
count until a lawful external provider is explicitly integrated.

## D-022 - Telegram reputation is app-owned and moderated

Telegram Bot API does not expose reliable account age, hidden SCAM labels,
Telegram report counts or spam-recipient history. Ishonch Guard therefore stores
its own Telegram reputation in `telegram_reputation_targets` using HMAC-hashed
targets and masked display hints. Checks may update observation timestamps, and
unverified reports may create admin-review candidates, but user-facing
reputation labels require confirmed moderated reports or a future official
source. The bot must label the source and confidence and must not present this
as a hidden Telegram-internal verdict.

## D-023 - Web3 promo funnels are contextual, not automatic guilt

Telegram/Web3 casino, NFT, Stars, task-reward, wallet and referral posts are
handled as recurring tactics from a research feed. They add deterministic reason
codes and contextual advice, but most are suspicious rather than high-risk until
paired with stronger signals such as private invite links, deposits, credential
requests, wallet signing or code/card prompts. This keeps the bot useful without
overclaiming that every promo post is definitely fraud.

## D-024 - Video thumbnails are evidence, full videos are not downloaded

Telegram video messages may expose a small preview frame. If a video has no
caption, hidden link or inline-button URL, the bot may route that thumbnail to
the same in-memory image/QR pipeline used for photos. The video file itself is
not fetched, decoded or stored. Result cards for this path must say that only
the preview frame was checked, not the full clip, and ask for speech,
description, button/link or screenshot evidence separately when needed. If
Telegram gives no usable thumbnail, the bot keeps the media-specific fallback
asking for a link, screenshot frame or short description.

## D-025 - Forwarded source context is reply-only

Telegram forwarded posts can expose a public channel/group title and username.
The bot may show that visible source in the answer to help the user understand
context. When deterministic reason codes identify a tactic, the reply should
explain the scheme, likely attacker goal and one safe next step in compact
language. It must not append source metadata to the scored input, persist it in
`checks`, or use it as reputation evidence. Hidden/private user origins stay
excluded, and the copy must keep the limitation boundary: no hidden SCAM label,
account-age, report-history or spam-history claims.

## D-026 - Unreadable images get triage, not guessed verdicts

When photo/OCR/QR analysis cannot produce usable evidence, the bot should not
invent a risk result from the image. Instead, it keeps the explicit unreadable
fallback, stores only the safe `image_unreadable` session snapshot, and offers
scenario triage buttons for common visual categories: NFT/Stars gifts,
casino/free-spins, TON/wallet, bank/code and menu/QR. Triage callbacks are
presentation-only: they provide safe next steps and ask for the next concrete
evidence, but they do not run scoring, create `checks` rows, persist image
bytes, or claim hidden Telegram reputation.

## D-027 - Telegram promo image explanations are scenario-first

When a Telegram screenshot is readable, the reply should explain the visible
mechanic instead of falling back to generic "code/card/APK" wording. Casino and
free-spins posts mention deposits/top-ups; NFT/Stars giveaways mention
captcha/voting/bot/spin/claim mechanics; wallet/DeFi posts mention
connect/sign/seed-phrase risk; TON referrals mention invite/reward loops.
Ordinary Telegram news, product posts and advertising-exchange posts remain
non-accusatory and ask for the next screen or link if a later step requests
sensitive data.

## D-028 - Telegram public post links keep the post-body boundary visible

Public links such as `t.me/channel/123` and `t.me/s/channel/123` are not the
same as forwarded posts. The bot may use Bot API `getChat` to identify the
public channel/account, and it may preserve the post id for user-facing wording,
but it must not claim that it read the body of that post through the link. For
precise analysis the reply should ask the user to forward the post, paste the
text, or send a screenshot. This keeps link checks helpful without inventing
hidden Telegram capabilities.

## D-029 - Public Telegram post web fetch is visible evidence only

The bot may fetch `https://t.me/s/<username>/<postId>` for validated public
Telegram post links before falling back to Bot API metadata. This is best-effort
visible web evidence only: extract short text, visible outbound links, link
previews and inline buttons, redact sensitive digits, score through the existing
rules-first pipeline, and clearly say that hidden SCAM labels, account age,
Telegram reports and spam history are not visible. Private invites, internal
`t.me/c/...` links and arbitrary URLs are never fetched by this feature.

## D-030 - High-risk check results are action-first

The first Telegram card for a `high_risk` check result should pass the panic
readability test: show the verdict, the safest immediate actions and a short
evidence summary. Long generic AI explanations, reporting checklists and broad
educational detail should not appear in the initial result card because they
push the action below the fold. Short visible-source briefs for forwarded
Telegram posts may remain because they explain what public evidence was used.
Reporting and emergency help remain available through inline buttons and the
emergency flow.

## D-031 - Result why buttons explain the current case

The inline `why` button under a check result should explain the latest check
when recent `lastCheck` context exists. The generic "how I check" text remains
the fallback when there is no recent check. `lastCheck` may store risk level,
input type, coarse context, timestamp and short reason codes, but it must not
store raw user text, URLs, phone numbers, OCR text, card data, codes or image
bytes. Unknown result cards should avoid surfacing weak topic-only observations
as evidence, while suspicious/high-risk cards should keep concise visible
evidence and next steps.

## D-032 - Official contacts are callback destinations, not caller-ID proof

The public website may expose `VERIFIED_CONTACTS` as a searchable official
contact directory. This directory is static public data and must not read
private reports, raw checks, OCR text or user identifiers. User-facing copy
must frame listed numbers as safe callback destinations only: caller ID can be
spoofed, so a directory match never proves that an incoming call is safe and
never overrides dangerous behavior such as SMS-code, PIN, CVV, password, APK or
transfer requests.

## D-033 - Public scheme trends describe tactics, not targets

The website may show a public scheme-trends map for Uzbekistan, but the first
version must be static/aggregate and education-only. It may use research-feed
categories, deterministic reason-code coverage and non-personal descriptions of
hooks, goals and safe steps. It must not publish raw reports, phone numbers,
Telegram usernames, URLs, screenshots, OCR text, hidden Telegram labels,
account age, spam history or unmoderated accusations. A trend is a tactic to
recognize, not a claim that a specific person, channel or number is a scammer.

## D-034 - Public impact counters must be aggregate-only

Homepage impact counters may show aggregate checks, risk-alert counts,
moderated records and user-reported loss totals. They must not expose raw
check/report rows or claim "money saved" unless the user explicitly supplies
that outcome through a privacy-reviewed survey.

## D-035 - Report screenshots are transient evidence, not stored files

Telegram `/report` may accept a screenshot while the user is describing the
incident, but the first version must not add Supabase Storage or persist raw
media. The bot downloads the image only in memory, uses the existing structured
image analysis path, stores a short redacted summary in the report draft, and
asks for a typed description when evidence is unreadable. Raw images, data
URLs, decoded QR payloads, full OCR text, phone numbers, card data, OTPs and
links must not be stored in `telegram_sessions` or `reports`.

## D-036 - Telegram username checks are passports, not accusations

Telegram username-only checks should render as a structured passport of visible
facts and hard limitations: public Bot API visibility, moderated Ishonch Guard
report count when available, what Bot API does not expose, and the next useful
evidence to send. They must not claim hidden SCAM labels, account age, Telegram
complaint history, spam history, country/DC or user creation dates. A missing
or invisible username is not proof of scam; moderated reputation and dangerous
requested actions are the evidence that can raise risk.

## D-037 - Guardian Angel is post-verdict guidance, not new evidence

Guardian Angel may continue a Telegram high-risk check with one safe step,
done confirmation, safe callback, trusted-contact help and a concise full plan.
It must not change risk scoring or invent additional evidence. Session memory
for this flow may store only risk level, input type, reason codes and timestamp;
raw user text, URLs, phone numbers, OCR text, screenshots, files, codes, card
data and passwords remain forbidden. Timed reminders such as "are you okay in
2 hours?" require a separate scheduler, opt-out and retention design, so they
are intentionally left out of v1.

## D-038 - Admin allowlist grants only after email verification

Allowlisted email is eligibility, not proof of ownership. The database signup
trigger must not grant `admin` while `auth.users.email_confirmed_at` is null.
New allowlisted accounts receive a baseline `user` role first; a separate
email-confirmation update trigger may add `admin` only after Supabase marks the
mailbox confirmed. Deployments must keep email confirmation enabled, because the
database trusts Supabase's confirmation timestamp as the ownership signal.

# Functions Map

Signatures and intent only. See file paths for source.

## Server functions

| Function                                                                                             | File                                     | Auth   | Purpose                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkInput({ input, type?, lang, embed? })`                                                         | `src/lib/check.functions.ts`             | public | Web wrapper around `runCheck`; shared rate-limited 10/min/IP. Meta-intents claim the same shared bucket before optional privacy-safe embed analytics, so denied requests create no telemetry row.                    |
| `ocrExtract({ image, lang })`                                                                        | `src/lib/check.functions.ts`             | public | Web wrapper around `ocrExtractCore`; validates png/jpeg/webp base64 data URLs before screenshot OCR + deterministic redaction.                                                                                       |
| `getPublicStats()`                                                                                   | `src/lib/check.functions.ts`             | public | Cached server-side stats wrapper; calls service-role-only `get_check_stats()` instead of browser RPC, de-duplicates aggregate work, and keeps report/loss impact confirmed-only.                                     |
| `submitReport({ value, type?, description, scamType?, city?, amountLostUzs?, incidentOnly?, lang })` | `src/lib/report.functions.ts`            | public | Prepares a target hash/masked display, inserts a redacted report, stores same-day duplicates as private `duplicate` evidence without public entity side effects, and can trigger an opt-in private moderation alert. |
| `submitReputationAppeal({ target, reason, contact?, lang })`                                         | `src/lib/reputation-appeal.functions.ts` | public | Creates a privacy-safe appeal/removal request for reputation targets; can trigger an opt-in private moderation alert.                                                                                                |
| `listReports({ status })`                                                                            | `src/lib/admin.functions.ts`             | admin  | Lists reports by status, including retained `duplicate` evidence rows.                                                                                                                                               |
| `listEntities({ status })`                                                                           | `src/lib/admin.functions.ts`             | admin  | Lists moderated/known entities.                                                                                                                                                                                      |
| `moderateReport({ reportId, decision, riskLevel })`                                                  | `src/lib/admin.functions.ts`             | admin  | Confirms/rejects a report and syncs entity reputation/counts from confirmed reports unless the report is situation-only.                                                                                             |
| `listReputationAppeals({ status })` / `resolveReputationAppeal(...)`                                 | `src/lib/admin.functions.ts`             | admin  | Reviews appeal/removal requests and can hide public reputation with audit logging.                                                                                                                                   |
| `adminStats()`                                                                                       | `src/lib/admin.functions.ts`             | admin  | Dashboard counts.                                                                                                                                                                                                    |

## Risk engine

**`src/lib/admin-role-preflight.ts`**

- `summarizeAdminRoleDrift(users, allowlistEmails, adminUserIds)` compares the
  confirmed allowlist projection with durable admin-role rows and returns only
  aggregate current/eligible/stale/missing counts. It never returns an email or
  user id, so `npm run admin-role:preflight` is safe to retain as deployment
  evidence.
- `collectCountedPages(fetchPage, pageSize?)` consumes exact-count pages and
  fails closed on missing, changing, truncated or oversized results. The live
  preflight additionally orders both PostgREST sources, rejects duplicate page
  identities and requires two identical reads before producing counts.

**`src/lib/request-ip.server.ts`**

- `publicRateLimitKey(scope)` returns `check:<ip>`, `report:<ip>` or
  `appeal:<ip>` for public server functions. It ignores client-supplied proxy
  IP headers unless `TRUST_PROXY_IP_HEADERS=true`.

**`src/lib/quick-report-payload.ts`**

- `buildQuickReportSubmitData({ value, description, lang })`: trims homepage
  quick-report input and marks empty optional targets as `incidentOnly: true`
  with the incident-only sentinel.

**`src/lib/risk/detect.ts`**

- `detectInputType(raw) -> InputType`
- `normalizePhone`, `normalizeTelegram`, `normalizeUrl`, `normalize(input, type)`
- `maskForDisplay(value, type)` returns masked phone/Telegram/URL/APK displays;
  malformed URL/APK values fail closed to `[link]` instead of returning raw
  input, while valid URLs keep only a host/path indicator.
- `redactText(s)` masks full cards, inline phones, OTP-like digit runs, ordinary
  URLs/Telegram handles and complete `tg://`/`telegram://` custom-scheme
  identifiers before narrative persistence or presentation. It first calls
  `redactSensitiveSecrets`, so labeled passwords, separated codes, recovery
  phrases and private keys cannot bypass the older digit/URL controls.

**`src/lib/risk/sensitive-text.ts`**

- `sanitizeSensitiveTextForSink(input)` returns an idempotently sanitized value
  plus bounded secret-class metadata while preserving ordinary safety prose,
  numeric amounts and phone-shaped values for the established phone masker.
- `redactSensitiveSecrets(input)` is the string-only sink helper.

**`src/lib/risk/rules.ts`**

- `ReasonCode` union + weights.
- `evaluateText`, `evaluateUrl`, `evaluatePhone`, `evaluateTelegram`.
- Text evaluation splits natural clauses and applies request, object, polarity,
  safety and neutral-context checks before direct-danger reasons. Cross-clause
  pronouns retain typed OTP/card/passport/PIN/CVV context; QR codes,
  screenshots, technical addresses/ids and safety warnings are kept out of
  unrelated sensitive-data reasons.
- Research-feed text rules include `telegram_account_takeover_phishing`, `dropper_recruitment`, `gambling_prediction_promo`, and Telegram/Web3 promo funnel codes for casino/free-spins, CAPTCHA/voting, task rewards, wallet urgency and TON referral earning.
- `REASON_TRUST_IMPACT: Record<ReasonCode, "informational" | "protective" | "risk">` is an exhaustive compile-time trust map for all 55 reason codes.
- `canVerifiedContactMarkSafe(codes)` returns true only when every reason is explicitly informational/protective; new unclassified ReasonCodes fail TypeScript.
- `scoreFromCodes(codes) -> { score, level }`; `verified_official` can produce Safe only without any risk-classified sibling code.
- `REASON_LABELS`, `ADVICE` in RU/UZ/EN.

**`src/lib/risk/mixed-clause-adversarial-corpus.ts`**

- `MIXED_CLAUSE_ADVERSARIAL_CORPUS` supplies 363 unique, language-balanced
  offline messages: 330 neutral/safety-plus-danger permutations and 33 genuine
  safety controls over 11 action families. It covers comma, colon, dash,
  semicolon and `но/lekin/but` in both clause orders so a neutral token cannot
  suppress a later unsafe request.

**`src/lib/risk/phone-intelligence.ts`**

- `buildPhoneIntelligencePassport(raw, normalized, verifiedContact)` returns honest phone metadata: country/calling code, Uzbekistan prefix/operator hint, format status, official-directory status and optional verified-contact lookalike evidence. It never infers owner, hidden scam labels, account age, spam history or report volume.

**`src/lib/risk/verified-contacts.ts`**

- `isVerifiedContactActive(contact, now?)` keeps static phone/emergency seed behavior but expires mutable Telegram handles 30 days after `verifiedAt`.
- `getActiveVerifiedContacts(now?)` and `getVerifiedContactsCount(now?)` evaluate the active directory at call time, so long-lived processes cannot keep an expired handle active; exact matching and public surfaces use these helpers.
- `findVerifiedContact(input)` matches only active entries; expired handles cannot add a badge or affect the check verdict.

**`src/lib/risk/phone-reputation.ts`**

- `buildPhoneReputationSummary(row)` exposes confirmed phone reputation only from moderated `entities` rows with positive report counts.
- `phoneReputationConfidence(count)` maps confirmed report counts to conservative `low | medium | high` confidence labels.
- `formatPhoneReputationEvidenceLine(summary, lang)`, `formatNoPhoneReputationLine(lang)` and `formatPhoneReputationScopeLine(lang)` provide shared RU/UZ/EN user-facing source/scope wording for Telegram, inline and Risk Passport surfaces.

**`src/lib/risk/url-reputation.server.ts`**

- `checkUrlReputation(urls, options)` calls optional Google Safe Browsing,
  URLhaus and PhishTank providers as additive evidence only. It short-caches
  results, de-duplicates in-flight checks and returns only
  `external_phishing_url` / `external_malware_url` reason codes.
- `normalizeUrlForReputationProvider(raw)` keeps only HTTP(S) scheme/origin and
  strips credentials, path, query and fragment before any provider call. Local
  deterministic URL rules inspect the full cleaned path separately in
  `check-core.ts`.

**`src/lib/risk/check-core.ts`**

- `runCheck(params)` is the transport-independent check pipeline. It uses the shared production limiter with a local fallback. `persist:false` is reserved for non-final previews such as Telegram inline typing and skips the `checks` insert while preserving deterministic scoring. Verified metadata, phone passport and Safe require an exact standalone contact; embedded official tokens are not trusted. Composite text/image payloads retain embedded destinations for deterministic URL/brand scoring.
- `ocrExtractCore(dataUrl, lang, rateLimitKey)` is the transport-independent OCR pipeline; it uses the same shared check limiter and rejects non-allowlisted image data URLs before building AI `image_url` messages.
- `analyzeImageCore(dataUrl, lang, rateLimitKey)` returns structured, redacted image evidence for Telegram photos/screenshots; it uses the same shared check limiter and validates png/jpeg/webp base64 data URLs before AI image analysis.
- `parseAllowedImageDataUrl(value, { maxBytes? })` in `src/lib/risk/media-data-url.ts` normalizes AI-bound image data URLs and enforces MIME/base64/decoded-size limits.
- Private AI helpers call an OpenAI-compatible Chat Completions provider, retry only transient provider failures (`429`, `500`, `502`, `503`, `504`) with bounded backoff, and degrade to `null`. User-facing AI explanations pass through `sanitizeAiExplanationWithFinding` before return or persistence, and repeated unsafe provider outputs for the same rate-limit key temporarily skip later AI explanation calls.

**`src/lib/risk/domain-normalizer.ts`**

- `normalizeDomain(rawUrl)` returns both `hostnameIdentity` (lossless WHATWG/
  IDNA DNS identity for allowlists) and `hostname` (lossy visual/transliteration
  skeleton for additive detection), plus the normalized path.
- `toDnsIdentityKey(value)` never collapses digit/letter confusables.
- `toDomainComparisonKey(value)` and `toDomainComparisonKeys(value)` apply the
  shared NFKC, visual-confusable and bounded Cyrillic/transliteration policy to
  both checked labels and registry aliases.

**`src/lib/risk/brand-matcher.ts`**

- `matchBrandInUrl(normalized, rawHostname)` compares exact host/path segments
  against all alias comparison-key alternatives and suppresses canonical
  official domains/subdomains, including DNS-absolute spellings.
- `matchBrandInText(text, urls, reasons)` uses Unicode-aware token boundaries;
  registered Cyrillic aliases can contribute deterministic impersonation
  evidence without matching inside longer Unicode words.

**`src/lib/risk/ai-output-safety.ts`**

- `findUnsafeAiOutput(text)` detects prompt-injection leakage and AI-authored requests for SMS/OTP/PIN/CVV/password/card/seed data, APK installs, wallet signing/connection or payments. Sentence fragments are subdivided at semicolon and common RU/UZ/EN contrast/sequence boundaries so safe negation applies only to its own action clause.
- `sanitizeAiExplanationWithFinding(text)` returns safe trimmed text or `null` plus the blocked finding, so callers can record repeated unsafe provider output without exposing it.
- `sanitizeAiExplanation(text)` returns safe trimmed text or `null`; legitimate negated warnings like "do not share SMS code" are preserved.
- `recordUnsafeAiExplanationBlock(rateLimitKey)` and `isUnsafeAiExplanationCooldownActive(rateLimitKey)` implement a short in-memory per-key slowdown after repeated unsafe AI explanation blocks.

**`src/lib/risk/image-intelligence.ts`**

- `sanitizeImageIntelligence(raw)` parses/clamps model JSON, sanitizes the optional AI summary, and merges deterministic risk hints.
- `fallbackImageIntelligence(text)` builds deterministic evidence when model JSON is invalid, including Telegram promo/Web3 screenshot hints. The precision pass also recognizes Stars/NFT spin/lucky-draw/777 mechanics and public voting/contest domains without turning ordinary Telegram news/product posts into scam results.
- `hasUsableImageEvidence(evidence)` rejects low-information model output such as "could not read the image" so blurry screenshots stay in the explicit fallback path.
- `mergeDecodedQrEvidence(evidence, decoded)` injects real pixel-decoded QR values into structured image evidence before scoring.
- QR merging removes Wi-Fi passwords, labeled RU/UZ/EN passwords/OTP/recovery
  phrases, authenticator/login tokens and sensitive URI values before evidence
  reaches `runCheck`; non-login secret-bearing QR adds `otp_or_secret`.
- `isEvidenceBackedBenignImageContext(evidence)` is the strict gate for final
  no-reasons `safe` image verdicts. It requires a benign category plus readable
  delivery/menu/QR/profile evidence and zero risk hints; category-only model
  labels stay `unknown`.
- `buildImageCheckInput(evidence)` converts benign/dangerous image evidence into
  a rules-safe input string. Deterministic URL/brand scoring receives every
  complete URL token independently observed in pre-redaction OCR or pixel QR
  decode; provider-only guesses and truncated-prefix substitutions are not
  evidence. Private Telegram invite tokens are masked while their risk signal
  remains. Telegram casino/free-spins, NFT/Stars giveaways, vote/captcha gates,
  task rewards, wallet urgency and TON referral screenshots feed the existing
  scam-research-feed-v2 reason codes.
- `buildImageUserExplanation(evidence, level, lang)` creates the short Telegram explanation for image results, with scenario-specific copy for casino/free-spins, NFT/Stars giveaways, task rewards, wallet/DeFi urgency, TON referrals, private invites and benign Telegram posts. QR copy now distinguishes real pixel-decoded payloads, URLs merely visible near a QR and QR codes that are visible but unreadable; Telegram login tokens and 2FA secrets stay hidden.

**`src/lib/risk/qr-decoder.ts`**

- `decodeQrFromDataUrl(dataUrl)` asynchronously decodes PNG/JPEG QR pixels in a
  single isolated worker. It enforces 4 MiB/4 MP source limits, downsizes scan
  work to 1.5 MP, caps scans at five/350 ms, caps active-plus-queued work at four
  jobs and terminates an active job after 900 ms. Unsupported, oversized,
  saturated, timed-out or crashed work returns empty evidence; values remain
  deduplicated and clamped.

**`src/lib/risk/hash.ts`**: `hashIdentifier(value)`.

**`src/lib/risk/rate-limit.ts`**

- `checkRateLimit(key, limit, windowMs)` is the non-production sliding-window
  fallback. It validates key/limit/window sizes, stores at most 4096 live
  TTL/LRU-refreshed buckets, denies new identities at capacity and rate-limits
  its bounded full expiry cleanup to once per second.
- `getRateLimitBucketCountForTests()` / `resetRateLimitBucketsForTests()` expose
  no bucket contents and exist only for deterministic cap regressions.

**`src/lib/risk/shared-rate-limit.server.ts`**

- `checkSharedRateLimit(scope, key, limit, windowMs)` HMAC-hashes the raw key,
  calls service-role-only `claim_rate_limit()` and validates the returned row.
  Production/Railway returns a blocked result on missing shared configuration,
  hash/RPC exception, RPC error or invalid response; non-production local/test
  may use the bounded in-memory fallback.
  Telegram image media fetches use a separate `telegram-image:<tg:userId>` key
  before `getFile`/download, while final image analysis and scoring keep the
  normal `tg:<userId>` check budget.

**`src/lib/meta-intent.ts`**: pure deterministic RU/UZ/EN router for questions
to the bot itself. Strict capability frames do not reinterpret past-action or
victim-emergency narration as a bot-capability question. Qualified card/order/
tracking numbers and non-Telegram bank/email/social accounts fail closed
instead of receiving misleading phone or Telegram-profile instructions.

**`src/lib/telegram/intent-contract.ts`**

- `TELEGRAM_INTENT_CONTRACTS` exhaustively maps typed meta, victim,
  post-check, panic and fresh-risk-input ids to response actions, context and
  direct/Inline side-effect boundaries.
- `getTelegramIntentContract(id)` is the fail-closed lookup; canonical id
  helpers prevent unnamespaced string construction in tests and tooling.

**`src/lib/telegram/victim-intent.ts`**

- `classifyVictimIntent(text)` gives concrete passport/document/personal-data
  requests precedence over broad scam concern and stale check follow-ups. The
  phrase may describe scammers generically; it does not need to claim that the
  current user was already asked for the document.
- Completed disclosure to an untrusted recipient uses the distinct
  `personal_data_already_shared` aftercare route; an explicitly official
  portal/app upload remains benign. Completed family payments require an
  adversarial recipient or shared SMS/OTP context before aftercare is selected.

**`src/lib/telegram/dialogue-corpus.ts`**

- `TELEGRAM_DIALOGUE_CORPUS` expands reviewed RU/UZ/EN post-check phrases into
  1,872 deterministic recent/orphan/stale/new-artifact rows.
- `FOLLOW_UP_PHRASE_SEEDS` plus `FOLLOW_UP_GOLDEN_PHRASES` are the compact
  human-review surface. The latter adds one natural reply-to-bot and one common
  typo per action/language through exact normalized lookup; generated rows are
  dialogue-state permutations, not a claim of 1,872 independent phrases.

**`src/lib/telegram/conversation-wrapper.ts`**

- `stripConversationWrappers(text)` removes up to three allowlisted harmless
  RU/UZ/EN lead-ins while preserving the actual request. Wrapper-only thanks
  remain meaningful, and callers still inspect the original text for concrete
  artifacts first.

**`src/lib/telegram/text-panic-intent.ts`**

- `classifyTextPanicIntent(text, source?)` is the shared pure emergency gate for
  typed text: forwarded/quoted third-party narration and negated actions stay
  out, first-person already-done events and active live calls keep their
  scenario, and Russian Latin-keyboard text gets the existing transliteration
  fallback.
- `classifyVoicePanicIntent`, `classifyLiveCallContext`,
  `isNegatedVoiceDoneIntent` and `normalizeVoiceIntentText` are reused by the
  Telegram handler. The module has no session, database or Bot API side effect.

**`src/lib/telegram/human-dialogue-corpus.ts`**

- `HUMAN_DIALOGUE_CORPUS` expands 336 reviewed RU/UZ/EN capability, method,
  greeting and ordinary-conversation variants over three explicit prefixes
  into 1,008 deterministic cases. The rows are offline QA, not training data,
  live transcripts or Telegram session simulation.

**`src/lib/telegram/synthetic-multiturn-dialogue-corpus.ts`**

- `SYNTHETIC_MULTITURN_DIALOGUES` contains exactly 1,000 deterministic
  two-/three-turn sequences (2,500 user turns) across scam-risk,
  post-result, capability and ordinary dialogue. Risk snapshots use the real
  deterministic evaluator and all 13 post-check actions; generation performs
  no external call and does not replace Desktop/Android/iOS acceptance QA.

**`src/lib/telegram/everyday-dialogue-corpus.ts`**

- `EVERYDAY_DIALOGUE_CORPUS` contains 540 semantically distinct two-turn
  dialogues: 180 per language and 36 per each of 15 categories. Every row keeps
  the first user phrase, its production route and reply, a natural follow-up,
  and the second production reply. Actual text routing includes meta,
  victim-guidance, retained-result, panic and fresh-risk families.
  Mixed-clause rows require a protective victim/risk outcome even when a safe
  or neutral fragment comes first.
- `EVERYDAY_DIALOGUE_STATS` reports dialogue, turn, language, category and
  first-route-family counts. Corpus construction calls no external service and
  is exported separately for human review; it does not train the model.

**`src/lib/embed-origin-analytics.server.ts`**

- `normalizeEmbedTelemetryContext(context)` sanitizes an optional embed context
  down to `partner`, `referrerOrigin` and `referrerHost`; it strips full
  referrer paths, query strings and fragments.
- `recordEmbedOriginEvent({ context, eventType, lang, result? })` inserts one
  service-role-only `embed_origin_events` row with aggregate result shape
  (`input_type`, `risk_level`, `reason_count`) and never stores raw checked
  input, redacted input, input hashes, URLs, phone numbers or Telegram ids.

## Telegram result formatting

**`src/lib/telegram/format.ts`**

- `formatCheckResult(result, lang)` renders Telegram result cards and now routes
  shallow `unknown` phone/Telegram-profile checks through a Risk Passport card
  instead of the generic unknown verdict.
- `renderRiskPassport(result, lang)` is a pure formatter helper for Telegram
  passport cards. It preserves honest boundaries: visible facts, app-owned
  reputation and official-directory data may be shown; hidden Telegram scam
  labels, account age, spam history and unmoderated complaints must not be
  claimed. Missing local reports are phrased as "confirmed complaints not
  found", not as a safety guarantee.
- `buildResultKeyboard(result, lang)` attaches contextual "what did they ask
  for?" buttons to inconclusive phone/username checks before report/new-check
  actions.

**`src/lib/telegram/advice-filter.ts`**

- `REASON_PROTECTIVE_ACTION: Record<ReasonCode, ProtectiveActionId | null>` is
  the compile-time exhaustive action policy for all 55 deterministic reasons.
- `filterAdvice(level, reasons, lang)` resolves typed actions, applies a stable
  priority, deduplicates and returns up to three RU/UZ/EN protective steps.
  Confirmed reports and external phishing/malware feeds always produce an
  immediate action for high-risk cards.

**`src/lib/telegram/inline-reason-presentation.ts`**

- `INLINE_REASON_POLICY: Record<ReasonCode, InlineReasonPolicy>` assigns all 55
  reason codes an explicit priority, evidence class and limitation class.
- `presentInlineReason(reasons, lang)` selects the strongest reason with a
  deterministic tie-break and returns RU/UZ/EN source/method plus limitation
  copy. It never infers owner identity, hidden Telegram data or proof of fraud.
- `collectResultReasonCodesForPresentation(result)` merges deterministic
  reasons with explicit official-directory and moderated-report result metadata,
  drops weak hosted-platform context when stronger evidence exists, ignores
  unknown runtime strings and returns the canonical ranked reason set shared by
  Inline and post-check.

**`src/lib/telegram/concrete-artifact.ts`**

- `hasConcreteArtifact(text)` detects independently checkable URLs, bare/IDN/
  Punycode domains, Telegram identifiers, dangerous files, phone/card values
  and actual short secret values. Meta wording about a code without a supplied
  code remains false so follow-up safety questions are not misrouted.

**`src/lib/telegram/guardian-angel.ts`**

- `buildGuardianAngelSnapshot(result, now)` creates a post-high-risk guidance
  snapshot containing only risk level, input type, reason codes and timestamp.
- `buildGuardianAngelIntro(snapshot, lang)` renders the first one-step companion
  message after a high-risk Telegram result without repeating reassurance
  boilerplate already present in the scenario card.
- `buildGuardianAngelText(action, snapshot, lang)` renders next-step,
  done-confirmation, safe-callback and full-plan responses.
- `buildGuardianAngelKeyboard(lang, snapshot?)` returns compact `guardian:*`
  action buttons plus Family Shield notify and new-check actions. When a
  snapshot is present, it suppresses bank safe-callback actions for non-bank
  contexts such as crypto, QR and Telegram recovery.
- `classifyGuardianAngelFollowUp(text, scenarioData, now)` routes short
  follow-ups such as "что дальше?", "готово" and "дай номер банка" without
  swallowing new artifacts.

**`src/lib/telegram/scam-trainer.ts`**

- `buildTrainerIntro(lang)` renders the callback-only `/trainer` intro.
- `buildTrainerQuestion(questionId, lang, score)` renders one defensive
  mini-quiz situation with three safe/unsafe choices.
- `buildTrainerAnswer(questionId, optionIndex, lang, score)` returns feedback,
  advances the callback-encoded score and offers restart/emergency help at the
  end.
- `parseTrainerCallback(data)` / `buildTrainerCallbackResponse(data, lang)`
  handle `trainer:*` callbacks without session state, persistence or `checks`
  inserts. The trainer content is defensive and avoids exact scam scripts.

**`src/lib/telegram/digest.ts`**

- `WEEKLY_SCAM_DIGEST_ENTRIES` is the manual-publish data model behind
  `/digest`: each topic has source/status/updated-at metadata, tags and
  RU/UZ/EN funnel copy.
- `getWeeklyScamDigestSnapshot(lang, { now?, entries? })` selects fresh
  manually published entries, filters drafts/archived records and falls back to
  evergreen safety guidance when fewer than three fresh topics are available.
- `formatWeeklyScamDigest(lang)` preserves the existing Telegram contract by
  returning MarkdownV2-escaped text plus the compact check/emergency/report
  keyboard without exposing source labels or raw report-shaped evidence.

**`src/lib/telegram/voice-out.server.ts`**

- `parseVoiceOutCallback(data)` accepts `voiceout:panic`,
  scenario-bound `voiceout:panic:<panicId>`, follow-up-bound
  `voiceout:panic:<panicId>:<action>` and `voiceout:guardian`.
  `parseVoiceOutPanicId(data)` and `parseVoiceOutPanicAction(data)` extract
  only valid safe panic scenario ids/actions.
- `buildPanicVoiceOutText(panicId, lang)` and
  `buildGuardianVoiceOutText(snapshot, lang)` generate short safety scripts
  from safe scenario ids / summary metadata, not from raw user evidence.
- `synthesizeVoiceOut(text, userId)` applies a separate 5/day user budget,
  strips URLs, Telegram usernames and long digit runs, refuses
  code/PIN/CVV/password-like text and calls only a configured TTS endpoint.
  Gemini TTS is preferred when `GEMINI_TTS_API_KEY` exists, OpenAI TTS remains
  a fallback, and Gemini-like chat endpoints are not used as speech providers.
- `sendVoiceOutResponse(...)` sends a Telegram audio file when TTS is
  configured and falls back to a short text message when audio is unavailable.
  It sends a best-effort `upload_voice` chat action before synthesis and
  de-duplicates repeated taps for the same user/text so retries do not burn
  provider quota; first/repeated button taps answer the callback with a short
  "preparing" or "already preparing/sent" hint instead of staying silent.

## Website embed widget

**`src/lib/embed-widget.ts`**

- `normalizeEmbedLang(value) -> Lang` falls back unsupported values to `ru`.
- `sanitizePartner(value) -> string | null` strips markup/control punctuation
  and clamps partner labels for iframe query params.
- `buildEmbedWidgetUrl(baseUrl, options) -> string` builds `/embed/check`
  URLs with language and optional partner label.
- `buildEmbedIframeSnippet(baseUrl, options) -> string` returns the copyable
  iframe with fixed height and strict-origin referrer policy. It intentionally
  does not set `sandbox`; `/embed/check` framing is controlled by CSP
  `frame-ancestors`.

**`src/lib/security/csp.ts`**

- `parseEmbedFrameAncestorAllowlist(raw) -> string[]` accepts comma/space
  separated explicit HTTPS origins for `/embed/check` CSP and rejects unsafe
  schemes or malformed entries.
- `buildEmbedCheckContentSecurityPolicy(allowedFrameAncestors) -> string` builds
  the embed CSP with `'self'`, explicit partner origins and localhost dev
  ancestors; it does not trust the iframe `partner` query label.

**`src/components/EmbedCheckWidget.tsx`**

- Compact iframe UI for number/link/Telegram/text checks.
- Calls the existing `checkInput` server function with an optional embed
  telemetry context, so shared rate limits, redaction, rules-first scoring,
  persistence and privacy-safe origin logging remain centralized.
- Shows a concise verdict, up to three reasons and up to two safe steps; meta
  intent answers render as informational text.
- `EmbedResult(...)` renders low-signal phone/Telegram checks through the shared
  compact Risk Passport presenter, suppressing duplicate generic advice so the
  partner iframe stays short. High-risk results remain action-first.

**`src/lib/risk/risk-passport.ts`**

- `detectRiskPassportKind(result) -> "phone" | "telegram" | null` recognizes
  shallow low-risk phone/Telegram checks that should be explained as context,
  not as a scam/safe verdict.
- `buildRiskPassportSummary(result, lang) -> RiskPassportSummary | null` builds
  compact localized sections for visible metadata, directory status, Ishonch
  reputation, limitations, meaning and next step. It uses already-redacted
  displays/public metadata and does not change scoring, persistence or entity
  lookups. Telegram kind selection depends on deterministic `type`; structured
  section parsing accepts only the separate typed
  `TelegramPassportEvidence { provenance, text }` field and never AI-authored
  `explanation`.

## Website trust surface

**`src/lib/trust/official-directory.ts`**

- `getOfficialDirectoryStats()` returns dynamic public counts from `getActiveVerifiedContacts()` only.
- `filterOfficialContacts(query, filter)` performs case-insensitive search across active organization names, display values, descriptions and sources.
- `getContactAction(contact)` returns no link for an expired Telegram contact even if a stale seed object is passed directly.
- `getContactAction(contact)` returns `tel:`, Telegram or email actions where appropriate.
- `isUrlSource(source)` distinguishes external source links from plain source notes.

**`src/lib/trust/scheme-trends.ts`**

- `PUBLIC_SCHEME_TRENDS` contains public, non-personal scam tactic entries for
  bank/SMS-code calls, APK, casino/free-spins, NFT/Stars, TON/wallet,
  Telegram account-takeover, delivery/payment links and dropper recruitment.
- `getSchemeTrendStats()` returns static public counts for trends, active-watch
  entries, critical scenarios, categories and linked reason codes.
- `filterSchemeTrends({ category, query })` searches public RU/UZ/EN text and
  reason-code labels without touching private checks/reports.
- `getTopSchemeTrends(limit)` returns severity-ordered homepage teaser entries.

**`src/lib/trust/scam-map-index.ts`**

- `getPrivacySafeScamMapIndex()` builds the public scam map/index from
  non-personal scheme-trend entries only: category buckets, national layer,
  active-watch/critical counts and a suppressed regional layer.
- `isRegionBucketPublishable({ moderatedReports, distinctSchemes, sourceTypes })`
  is the future dynamic-data gate. Region buckets must meet all thresholds
  before publication.
- `SCAM_MAP_FORBIDDEN_PUBLIC_FIELDS` is a regression guard list for raw reports,
  screenshots, OCR, full targets, URLs, codes, cards and user/chat ids that must
  not appear as public map fields.

**`src/lib/trust/impact-stats.ts`**

- `normalizePublicStatsRow(row, overrides?)` converts RPC/server aggregate rows
  into the public stats contract, defaulting missing fields to zero.
- `formatImpactNumber(value, lang)` formats aggregate counts for public cards.
- `formatUzsCompact(value, lang)` formats user-reported UZS loss totals without
  implying recovered or prevented money.

## Telegram

- `src/lib/telegram/webhook.server.ts`: compatibility webhook handler with fail-closed secret validation, capped body parsing and durable update lifecycle; returns 200 only after confirmed completion and 503 on handler/lease/completion uncertainty.
- `src/lib/telegram/update-lifecycle.server.ts`: strict service-role RPC boundary for polling leader leases, update processing/completion leases, failure release and current-fence checks.
- `src/lib/telegram/updates-poller.server.ts`: singleton `getUpdates(limit=1)` supervisor; advances offset only after durable completion and safely skips completion-before-offset redelivery.
- `src/lib/telegram/outbound-effect-fence.server.ts`: installs the AsyncLocalStorage-to-DB fence used before Telegram Bot API network effects.
- `src/lib/telegram/outbound-effect-guard.ts`: browser-safe guard indirection that keeps Node/DB modules out of shared API bundles.
- `src/lib/telegram/update-execution.server.ts`: `runWithTelegramUpdateExecution(updateId, work)` exposes request-local update id, loaded language and session-storage-failure state through `AsyncLocalStorage`; `currentTelegramUpdateId()`, `rememberTelegramSessionLanguage()`, `currentTelegramSessionLanguage()` and `markTelegramSessionStorageFailure()` are the narrow helpers.
- `src/lib/telegram/update-serialization.server.ts`: `serializeTelegramUserUpdate(userId, work)` orders updates for one user inside an instance while leaving different users concurrent; it retains ownership until work settles because timing out a `Promise.race` cannot cancel old JavaScript side effects.
- `src/lib/telegram/update-dispatch.server.ts`: `telegramUpdateUserId(update)` extracts the user from message/callback/inline updates; `executeTelegramUpdate(update, deps)` combines serialization, request-local state and the post-dispatch failure notifier.
- `src/server.ts`: binds `POST /api/telegram/webhook` and `/healthz` before SSR.
- `src/lib/telegram/router.ts`: parses updates and routes commands/content, including direct `/call` and `/trainer`; handles `inline_query` before chat-target extraction and passes `from.language_code` as the first-contact session hint; resets active/contextual session state when stored `scenario_data.chatScope` does not match the current chat; forwards `callback_query.id` so inline-button spinners are acknowledged; analyzes media captions before unsupported-media fallback; routes safe meta-questions before `handleCheck`; routes voice notes, short Telegram `audio` attachments and audio documents such as `.ogg`/`.m4a` through the same capped STT path while keeping non-audio documents unsupported; routes Telegram video thumbnails to the image pipeline with a `video_thumbnail` media marker when no stronger caption/link/button evidence exists; routes uncaptained images in `report_desc` to transient report screenshot evidence; attaches sanitized public forward channel/group source context to check/image actions.
- `src/lib/telegram/handlers/*`: `/start`, `/call`, `/check`, `/report`, safety/help, images, contacts, out-of-scope handling.
- `src/lib/telegram/session.server.ts`: Supabase-backed state. Durable update executions use `load_telegram_session_fenced` and `save_telegram_session_fenced`; stale update/leader fences fail closed. The monotonic sequenced RPC remains defense in depth and a legacy fallback.
- `src/lib/telegram/family-shield.server.ts`: service-role-only Family Shield helper. It creates HMAC-hashed one-use invite links, rejects duplicate active links, expires stale pending invites, sends redacted trusted-contact alerts with opt-out, provides the privacy-first family codeword guide, and revokes relationships from either guardian or trusted-contact side. The guide never asks users to send or store the actual codeword.
- `src/lib/telegram/api.server.ts`: Telegram Bot API calls, including typed `answerInlineQuery` success/failure envelopes with optional error code/description for inline-mode article results, in-memory `sendAudio` for opt-in Voice-out and `setWebhook` registration pinned to the shared one-connection containment policy.
- `src/lib/telegram/webhook-delivery-policy.ts`: exports the temporary `max_connections=1` webhook policy and the strict monitor predicate; this limits concurrency but is not treated as durable ordering evidence.
- `src/lib/telegram/emergency.ts`: `buildPanicScenarioText` now returns compact panic first cards, `buildDetailedPanicScenarioText` keeps the full checklist for `panicctx:full`, plus panic keyboard builders, live-call callback parser and Emergency Copilot helpers: `classifyEmergencyFollowUp`, `buildEmergencyFollowUpText`, `buildEmergencyFollowUpKeyboard`. First panic cards keep the urgent action first and short human guidance cues without repeating "I am nearby" in every message; follow-up answers are guided for stressed/elderly users, keep safe-callback boundaries and use scenario-specific ready phrases/contact destinations for financial, APK, Telegram takeover, live-call, romance, sextortion/photo-video blackmail, publication threats, minor-safety, AI voice-clone, fake job/easy-money, delivery/top-up, crypto/TON/wallet and government grant/benefit cases. Minor-safety and publication-threat trusted-person flows have distinct copy instead of sharing the generic blackmail branch. The panic menu is paginated through page 3 (`panic:more2` / `panic:back2`) for scenarios `12..15`.
- `src/lib/telegram/handlers/check.ts`: routes short post-panic, post-guardian, post-check and orphan helper follow-up questions before `runCheck` (regressed for live phrases like "Точно?", "Что еще посоветуешь?" and "дай номер банка"), sends Guardian Angel companion guidance after high-risk results, checks an early shared image-download budget before Telegram `getFile`/download, awaits bounded worker-isolated real-pixel QR decoding before structured image intelligence for photos and routed Telegram video thumbnails, adds an honest preview-frame note to video-thumbnail result cards, allows final no-reasons `safe` image results only through `isEvidenceBackedBenignImageContext`, transcribes capped voice notes, short Telegram audio files and routed audio documents, shows a non-message activity indicator while voice STT is slow, uses a dedicated exhausted-STT-budget copy, routes obvious already-happened voice transcripts (including first RU/UZ mixed-speech patterns) directly to matching `/panic` scenarios, stops low-signal transcripts before scoring and asks for correction, adds a transcript-correction button so users can recheck fixed text without another STT call, stores a safe `image_unreadable` last-check snapshot for OCR/QR failures, suppresses repeated album fallbacks, shortens repeated standalone image fallbacks, attaches unreadable-image triage buttons, fetches visible public Telegram post evidence before metadata-only fallback, and enriches Telegram username/link checks with best-effort public metadata plus moderated Ishonch Guard reputation and public forward-source context after scoring.
- `src/lib/telegram/media-admission.server.ts`: `claimTelegramImageDownloadBudget(userId)` claims the shared media bucket before any Bot API file metadata or body download; ordinary image and report-screenshot paths use the same boundary.
- `src/lib/telegram/handlers/report.ts`: owns the `/report` state machine, claims media admission before `getFile`, stores only prepared target hashes/masked displays plus redacted draft text, and accepts screenshots only on the description step. Report screenshots are downloaded/analyzed in memory through structured image evidence, converted to a short redacted summary, and never stored as raw images, data URLs, decoded QR payloads or full OCR text.
- `src/lib/telegram/handlers/inline.ts`: answers Telegram inline-mode queries with one compact `InlineQueryResultArticle`; empty queries show usage help, non-empty queries are capped at 256 characters and call `runCheck(skipAi:true, skipUrlReputation:true, persist:false)`. `safeInlineDisplay` masks human-preflight and upstream displays again before insertion and fails closed for malformed URLs. Low-signal phone/Telegram results reuse the shared Risk Passport summary; higher-risk results remain action-first. `answerOne` logs only a generic failure/code and retries entity-parse failures once with the retained real plain text, not MarkdownV2 escape slashes. Copy/buttons use validated `TELEGRAM_BOT_USERNAME` with a safe fallback.
- `src/lib/telegram/forward-context.ts`: sanitizes visible public Telegram forward source metadata and builds RU/UZ/EN reply-only source briefs with scheme/goal/safe-step copy when deterministic reason codes reveal a concrete tactic. It never changes scoring input and never persists source metadata.
- `src/lib/telegram/image-fallback.ts`: builds `imgtriage:*` callback data, the full unreadable-image category keyboard, compact post-category follow-up keyboards and hook/risk/safe-step copy; it is presentation-only and does not run scoring or persistence.
- `src/lib/telegram/moderation-notifier.server.ts`: sends optional private Telegram moderator alerts for new reports, reputation appeals and high-signal research items when `TELEGRAM_MODERATION_CHAT_ID` is explicitly configured. It formats only redacted targets, public scheme metadata, high-level fields and admin links; raw descriptions, screenshots, OCR, codes, card data, full phone numbers, full URLs, raw posts and user ids are never included. `buildHighSignalResearchModerationNotice()` selects active high/critical research-feed or moderated-aggregate scheme trends; `notifyHighSignalResearchModeration()` sends that review packet through the same private chat.
- `src/lib/telegram/check-followup.ts`: classifies and renders safe post-check/orphan actions, including extended confidence, methodology, trusted-person, recheck and disagreement phrases in RU/UZ/EN. Shared structural detection sends new bare domains/identifiers/values to a fresh check while code-safety wording stays a helper. Methodology uses the canonical ranked evidence collector; trusted-person free text has no notification side effect; recheck requires resubmission. A newer last check wins over older panic context, and high-risk next steps use reason-bound protective actions instead of a universal bank response.
- `src/lib/telegram/handlers/misc.ts`: handles callbacks and unsupported input; video and unsupported/oversized media fallbacks include capture instructions and next-step buttons; `guardian:*` callbacks answer with stored high-risk guidance or an honest no-context fallback; `family:codeword` shows the offline family-codeword guide without persistence; `imgtriage:*` and `asked:*` callbacks answer with scenario-specific safe steps for unreadable images or low-context username/phone checks and avoid repeating generic risk verdicts; result `why` callbacks use recent `lastCheck` context when available.
- `src/lib/telegram/check-context-buttons.ts`: presentation-only "what did they ask for?" buttons for inconclusive phone/Telegram-profile checks. It maps `asked:*` callbacks to short RU/UZ/EN safe-step responses for code, card, transfer, APK, link/QR and live-call contexts without changing scoring or persistence.
- `src/lib/telegram/public-metadata.server.ts`: extracts public Telegram targets, preserves public post ids from `t.me/username/123` and `t.me/s/username/123`, skips lookup for private/internal links, calls `getChatInfo` via an injectable lookup for public usernames with a soft metadata timeout and bounded short in-memory cache, and builds compact safe RU/UZ/EN Telegram Passport briefs. Username-only checks show visible public data, Ishonch Guard confirmed-report status, hard Bot API limitations, conservative visible username hints (random/generated, brand/support lookalike, promo wording), a Telegram Native Passport Coach that teaches users how to read Telegram-client profile signals without claiming Bot API access, and one concrete next step instead of a raw "insufficient data" dead end; missing local reports are described as not found, never as proof of safety. Slow Telegram metadata responses fall back to an honest unavailable passport instead of blocking the whole check on the full Bot API timeout. When Telegram/Web3 risk reasons exist, it renders a scenario-first evidence brief before hard Bot API limitations; profile-only checks keep limitation-first wording. Public post fallback copy says to forward/paste/screenshot the post when the public web page cannot be read. Enrichment never changes scoring.
- `src/lib/telegram/public-post.server.ts`: validates public Telegram post links, fetches only `https://t.me/s/<username>/<postId>` with timeout/body/shared rate limits, parses visible post text, outbound links, link previews and inline buttons from Telegram web HTML, sanitizes credentials in body/preview/button text, builds rules-safe check input, and prepends a source limitation brief without changing score/level/reasons.
- `src/lib/telegram/format.ts`: formats result cards; Telegram profile/invite checks use a dedicated context prompt and longer safe truncation budget so Telegram Passport limitations are not cut off, unknown phone cards render a visual Phone Passport, inconclusive phone/Telegram-profile cards add `asked:*` context buttons, unknown cards hide weak topic-only observations, suspicious cards use a compact "what noticed" evidence section, and high-risk first cards are compressed to urgent actions plus a short evidence summary instead of long generic explanation/reporting blocks. Visible-source briefs for forwarded Telegram posts remain as compact evidence.
- `src/lib/telegram/reputation.server.ts`: observes Telegram targets by HMAC hash, registers unverified Telegram report candidates, and renders source/confidence labels only for moderated reputation. `syncTelegramReputationAfterModeration` fail-closes on count query/error/shape or aggregate upsert failure and throws typed stage-only `TelegramReputationSyncError`; it never converts a failed read to zero or returns false success.
- `src/lib/telegram/handlers/commands.ts`: `/call` stores minimal panic context `6` and opens the active live-call copilot directly with the hangup-first keyboard; `/trainer` opens the callback-only scam-call mini-quiz without persistence.
- `src/lib/telegram/handlers/misc.ts`: stores minimal panic context
  (`lastPanicId`, `lastPanicAt`) and handles both scenario-bound
  `panicctx:<panicId>:<action>` / `voiceout:panic:<panicId>` callbacks and
  legacy context callbacks that fall back through the latest stored panic id;
  `trainer:*` callbacks answer mini-quiz steps without session writes.

## Auth and integration

- `requireSupabaseAuth` (`src/integrations/supabase/auth-middleware.ts`) validates Bearer tokens.
- `attachSupabaseAuth` (`src/integrations/supabase/auth-attacher.ts`) attaches the session token client-side.
- `supabase` / `supabaseAdmin`: browser RLS client vs server service-role client.

## DB functions

`private.has_role(uuid, app_role)`, legacy service-role-only `has_role(uuid, app_role)`, `handle_new_user_role()`, service-role-only `get_check_stats()`, `claim_rate_limit(text,text,int,int)`, `save_telegram_session_sequenced(bigint,bigint,jsonb)`, fenced Telegram leader/update/session lifecycle RPCs, `private.prune_app_retention(timestamptz)`, `prune_telegram_sessions()`.

## Operational scripts

- `src/lib/security/telegram-delivery-policy.ts` strictly parses `webhook` or
  `polling`, defines the expected authenticated webhook status and validates
  URL/pending/error state without duplicating mode assumptions in each smoke.

- `scripts/prod-smoke.ts`: one-shot production smoke test. Checks the public
  app, `/healthz`, Telegram webhook secret behavior, delivery-mode-specific
  update state, polling leader and the configured OpenAI-compatible AI provider.
  `--live-telegram` is available only in webhook mode; polling mode points to
  the dedicated dispatch harness instead of treating a disabled webhook as a
  failed bot.
- `scripts/prod-monitor.ts`: delivery-mode-aware production monitor for the app,
  Telegram webhook/polling state, authenticated polling-leader health and AI provider. It can
  send sanitized Telegram alerts to an operator chat without printing token,
  secret or chat id values.
- `scripts/switch-telegram-to-polling.ts`: fail-closed cutover; requires an
  active DB polling leader and calls `deleteWebhook(drop_pending_updates=false)`.
- `scripts/prod-monitor-policy.ts`: `skippedSecretMonitorCheck()` converts a
  missing secret into `fail` when that check is required, otherwise `warn`;
  `shouldFailMonitor()` makes every failed check fatal independently of the
  optional fail-on-warning policy.
- `scripts/moderation-alert-smoke.ts`: one-shot smoke test for the optional
  private moderation chat. It requires `TELEGRAM_BOT_TOKEN` and
  `TELEGRAM_MODERATION_CHAT_ID`, sends a clearly marked non-user test alert and
  never prints secrets or user evidence. Passing `-- --research` also sends the
  high-signal research review packet built only from public scheme metadata.
- `scripts/prod-family-shield-smoke.ts`: one-shot production smoke test for
  Family Shield. It creates a synthetic invite, accepts it, verifies the safe
  notification failure path, revokes the relationship and confirms no open
  synthetic rows remain.
- `scripts/prod-security-smoke.ts`: one-shot production RLS/security smoke test.
  It also fails when `TRUST_PROXY_IP_HEADERS=true` is set without
  `TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true`.
  It verifies anon cannot read/write sensitive tables, including
  `reputation_appeals`, `telegram_webhook_updates`, `rate_limit_buckets` and
  `embed_origin_events`, or execute maintenance/stat/rate-limit RPCs, while
  service-role can count required tables and execute stats/rate-limit claims.

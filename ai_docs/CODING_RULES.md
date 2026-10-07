# Coding Rules

## Privacy and security

1. Never store or log raw OTP/SMS codes, full card numbers, PINs, passwords, passport data or raw screenshot images.
2. Run `redactText` before persisting free-form user text, including report descriptions and OCR output.
3. Hash sensitive identifiers with the version-aware helpers in
   `src/lib/risk/hash.ts`; persist the hash version beside business hashes and
   store only hashes plus masked display strings. Active-only `hashIdentifier`
   is reserved for ephemeral keys such as shared rate limiting.
4. `client.server.ts` and anything `*.server.ts` must never be imported into client/browser code.
5. Public-facing data must respect RLS. Do not add public SELECT policies to `checks`, `reports`, `telegram_sessions` or unconfirmed `entities`.
6. Entities become publicly visible only after `moderation_status='confirmed'`.
7. Never name a specific person as a scammer. Use risk labels only.
8. Read secrets inside server handlers/helpers, not at module scope.
9. Telegram Direct image, Voice and `/report` screenshot bytes may reach an
   external provider only after an exact prompt-message/chat/media-kind grant
   expiring ten minutes after registration wins an atomic private-table claim
   fenced by the current update and polling-leader leases. Report screenshots
   must additionally match the active `reportFlowId`. One grant authorizes one
   provider operation; mismatch, replay, expiry, lease loss or storage
   uncertainty fails closed. Consent must never live in session JSON or store a
   file id, media bytes, OCR, transcript or provider payload; `reportFlowId` is
   only a non-secret report-generation marker. A consumed/revoked tombstone
   retains the original `expires_at`, not a fresh ten-minute lifetime, and may
   be replaced earlier only by a non-older valid prompt. Raw-media consent is
   polling-only; webhook/non-polling execution must stop before the RPC/provider
   boundary. Apply and verify the consent migration before deploying code that
   calls its RPCs. Production release must freeze other changes, disable
   delivery without dropping updates and disable raw-media provider access,
   drain the old image plus leader/update leases, apply/read back the migration,
   deploy/verify the consent-aware app while disabled, prove the old image is
   gone, then restore provider access and re-enable polling. A post-migration
   rollback may target only a consent-aware artifact.
   Within polling, local QR decoding alone is not an external transfer.
   Revalidate both update and leader leases immediately before the raw provider
   callback after any download/local-processing gap.
10. Consent RPC error, malformed result or lost response is ambiguous storage
    failure and must propagate so the polling update remains retryable. Never
    convert it to success or semantic `missing`. Register/grant/revoke may replay
    the same update idempotently; claim may produce one winner only. If a claim
    response is lost, replay must perform no provider call. Consented raw-media
    provider requests use one attempt, no fallback and `redirect: "error"`.
    Consent prompt and grant/cancel confirmation delivery retries only after a
    definitive retryable Telegram no-effect result: propagate its sanitized
    control-flow error so polling replays the same update. Ambiguous or
    non-retryable delivery is acknowledged without another send to avoid a
    duplicate visible prompt/confirmation.
11. Web OCR must require literal `externalProviderConsent=true` from an explicit
    UI action and use one provider attempt with no fallback per HTTP request.
    This is request-scoped, not durable consent or idempotency; never describe a
    client loading guard as proof that retry/re-dispatch cannot transmit again.
12. Railway public-rate-limit identity trusts a syntactically valid `X-Real-IP`
    only when `TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true`; otherwise use socket
    identity and keep the production security smoke red. Enable that gate only
    after proving that Railway's edge overwrites or strips a client-supplied
    `X-Real-IP`. Outside Railway, generic proxy identity requires both
    `TRUST_PROXY_IP_HEADERS=true` and
    `TRUST_PROXY_IP_HEADERS_EDGE_VERIFIED=true`; never enable trust from one
    flag or an unverified forwarding chain.
13. Production/Railway must accept only exact
    `REQUIRE_ADMIN_MFA_AAL2=true`; false/missing/invalid protected-runtime
    configuration must fail closed.
14. Public submission responses must not disclose whether a private moderation
    record already exists. Secret-token comparisons must use a fixed-length
    timing-safe boundary, not ordinary string equality.

## Risk engine

- Rules are deterministic and decide the score; AI only explains or OCRs.
- New scam patterns require: `ReasonCode`, weight, regex/pattern, RU/UZ/EN labels,
  an explicit `INLINE_REASON_POLICY` priority/evidence/limitation entry, advice
  if needed, tests, and a `SCAM_COVERAGE.md` update.
- Keep `scoreFromCodes` thresholds stable unless the change is explicitly documented in `DECISIONS.md`.

## AI provider

- Use the OpenAI-compatible env contract: `OPENAI_API_KEY`, optional `OPENAI_MODEL`, optional `OPENAI_BASE_URL`.
- Missing or failing AI must degrade to `null`; scoring must still work.
- User-facing AI text must pass through `sanitizeAiExplanation` or a stricter structured-output path before return/persistence.
- AI narrative fields must never be reinterpreted as canonical evidence by marker text. Structured evidence requires a separate typed value containing explicit deterministic provenance and data.
- Every new `ReasonCode` must receive an explicit `REASON_PROTECTIVE_ACTION` entry; high-risk output may not fall back to asking for more context.
- IDNA/Unicode security comparisons must canonicalize checked values and trusted registry values through the same classifier-only policy; do not use ASCII `\b` for Cyrillic token boundaries.
- Moderation synchronization must inspect every database response and propagate partial failure; never coalesce an errored count to zero or swallow a required aggregate write error.
- Never log prompts, secrets, raw screenshots or sensitive user input.

## i18n

- App language set: `ru`, `uz`, `en`.
- Every user-facing string needs all three languages.
- Default language is `ru`.

## UI / styling

- Orange = us. Red = the threat.
- Use CSS variables in `src/styles.css`; do not invent ad hoc red/orange shades.
- Use shadcn/ui primitives from `components/ui`.
- Preserve accessibility controls, aria labels and focus states.

## Routing

- File-based routing only.
- Never hand-edit `src/routeTree.gen.ts`.
- Telegram helper phrases must be typed actions before `runCheck`, must yield to
  any new concrete payload and must not imply a recheck or trigger an external
  side effect without explicit user action and the required evidence.
- Webhook-driven Telegram session writes must run inside the update execution
  context and use monotonic `update_id` sequencing. Do not publish a result that
  depends on follow-up state until its session snapshot is confirmed saved.

## Server functions

- Validate all input with zod.
- Fail gracefully without leaking internals.
- Admin functions always require `requireSupabaseAuth` + `assertAdmin`.

## Tooling

- Run TypeScript and tests before merging.
- A scheduled production monitor must explicitly require every secret-backed
  security check it claims to cover. Required missing credentials are failures,
  not warning-only skips, and must produce a non-zero exit even when alert
  delivery is unavailable.
- Do not add Lovable Cloud/runtime coupling or Lovable-specific build wrappers.
- Files marked generated should be changed at their source, not manually edited.

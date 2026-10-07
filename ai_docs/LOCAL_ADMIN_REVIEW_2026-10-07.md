# Real local admin review — 2026-10-07

Scope: application head `c67fca77e2ace2e9c54a0dcde5b01b26cdf0e772`, Draft/HOLD
PR #149. This is local fixture-based evidence, not a production login,
real-operator acceptance, or authority to merge/deploy.

## Environment and privacy

- Separate Supabase project `scam-guard-consent-proof-20261007`, PostgreSQL 17
  on 54332; real local Auth and REST on 55421. The already cleanly applied
  34-migration chain was reused. No hosted Supabase credential or link was used.
- Real SDK password sign-in, TOTP enrollment/challenge/verification produced
  a signed AAL2 admin session. An independent password sign-in was the AAL1
  admin control; a second synthetic account had no admin role. This does not
  claim that the UI password/enrollment form itself was exercised end to end.
- Two synthetic users plus three each of reports/entities/checks/appeals,
  masked targets and RU/UZ/EN descriptions. The harness handled credentials,
  TOTP secret and JWTs in memory, never printing or saving them as artifacts.
  Real local Auth persisted its normal account/factor records; those accounts
  were deleted during cleanup.
- Production-mode build/Node preview; `REQUIRE_ADMIN_MFA_AAL2=true`. No
  Telegram delivery, AI, OCR or TTS provider was enabled or invoked.
- Loopback UI at 18080 forwards the real local API under `/fixture-supabase`
  and the app to 18082. This same-origin adapter preserves the application's
  production CSP; it does not mock authentication, DB/RPC responses or guards.
- Browser requests were restricted to local origins; fixture SDK fetches
  rejected non-local destinations and ended with `externalAttempts=0`.

## Checks performed

| Check                                                                        | Observed result                                                              |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `/` and real AAL2 `/admin`                                                   | 320/375/390/768/1024/1280/1440/1920 checked                                  |
| Protected report queue                                                       | Three real synthetic reports rendered at each width                          |
| Appeals and report detail                                                    | Inspected at all eight widths; no horizontal overflow                        |
| Main title/background                                                        | Three text lines and exact approved gradient retained                        |
| Reduced motion                                                               | Emulated `reduce`; all 50 inspected CTA particles had `animation-name: none` |
| Browser exceptions/failed HTTP responses during the final main viewport pass | 0/0                                                                          |
| `adminStats`, `listReports`, `listEntities`, `listReputationAppeals`         | Four AAL2 positive controls admitted; all 12 negative combinations denied    |
| AAL1 admin UI                                                                | Redirect to `/admin-mfa`; zero protected report cards                        |
| Non-admin UI                                                                 | `Нет доступа`; zero protected report cards                                   |
| Unauthenticated UI                                                           | Redirect to `/login`; zero protected report cards                            |
| Moderation actions                                                           | Not submitted; opening/closing details was read-only                         |
| Cleanup                                                                      | Fixture rows deleted/read back zero, roles and synthetic users removed       |

The direct read-function negative controls replayed the exact successful
request format with the same-origin CSRF headers. AAL1 failures specifically
contained `MFA required`; non-admin and absent-token failures contained
`Forbidden` and `Unauthorized` respectively. TanStack serialized those logical
errors in HTTP 200 responses: checking the status alone would give the wrong
result. Positive controls succeeded with the same endpoint/payload, and
negative responses contained no fixture data. Only these four read functions
were exercised by this direct protocol probe; it is not a claim about every
admin mutation endpoint.

## Confirmed open UI finding

At **320px**, the report filter's `Подтверждено` text is approximately 79.84px
wide while its three-column button has 60.40px inner width (76.40px total).
The label exceeds its cell and crowds the adjacent filter. Source:
`src/signal-exact.css`, narrow-screen `.admin-redesign .admin-filter-group`.
This is a P2 presentation issue, not an authentication bypass. Preserve it as
a separate local layout correction/review; do not silently call the UI flawless
or deploy a design change without explicit approval. No CSS/source was changed
in this verification continuation.

## Retained evidence and unsuccessful harness attempts

Local ignored artifacts are under `output/playwright/` in
`C:\Scam-guard\security-privacy-boundaries-20260904`:

- `admin-viewport-proof-final-20261007.txt` — final 16 route/width results;
- `admin-access-negative-proof-reasons-20261007.txt` — four positive and 12
  negative read-function results, plus the three UI access controls;
- `admin-rows-review-20261007.txt` and `admin-dialog-review-20261007.txt`;
- `admin-filter-diagnostic-20261007.txt` — measured label-fit finding;
- `home-auth-review-*`, `admin-auth-*`, `admin-rows-*`, `admin-appeals-*`,
  `admin-detail-*`, `admin-access-*` PNGs, all with the `20261007` suffix;
- the corresponding local-only fixture, proxy and browser proof scripts.

These are retained one-off local artifacts, not a checked-in portable E2E
harness or a hosted browser CI run. They contain only synthetic fixture text
and non-secret observations; raw session values were never returned by the CLI.

The initial cross-port API build was blocked by the unchanged production CSP.
The first viewport script selected the wrong homepage background element;
the final script checks the actual pseudo-elements. The first direct Node
positive request lacked same-origin CSRF headers and got 403, so no negative
result from that attempt counted. The fixture-adapter/selector/protocol fixes
are harness corrections, not application/security fixes. Failed artifacts
were retained alongside the final passing results.

Own browser and 18080/18081/18082 servers were closed. The isolated Supabase
stack was stopped with its volume retained; unrelated Docker projects and
dirty worktrees were not stopped/reset/deleted. Local sign-out/deletion is
not presented as immediate cryptographic revocation of an existing JWT.
The Supabase CLI stop output also reported a timed-out PostHog telemetry
request. The zero-attempt assertion above is scoped to the fixture SDK/browser
proof, not every tool process; no claim of globally offline tool execution is
made.

## Remaining release boundary

Real Railway `X-Real-IP` overwrite/strip behavior is still **NOT VERIFIED**.
Read-only inventory found only production. The existing application has no
safe received-header probe endpoint, and the public routing diagnostic only
reported an unchanged derived IP, not the actual received header. Neither
that observation nor `/healthz` closes the trust gate. Creating an isolated
temporary service without production secrets/DB needs owner approval because
it creates external state and can cost money. No service was created, no
edge-trust flag was enabled, and production was not changed.

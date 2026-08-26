# Design: Observability Baseline (privacy-safe system metrics)

Status: **PROPOSAL — needs owner approval before implementation.** Written
2026-08-26. Target debt: the #2 architectural gap — canary verdicts currently
rest on green HTTP plus manual log grepping (e.g. the 274 `getUpdates` events
were counted by hand), and there is no queryable view of delivery outcomes,
rule-hit distribution or check latency.

## Principles

1. **Counts and classes only.** No message content, no user identifiers, no
   raw URLs/phones/usernames in metric labels. Labels come from closed sets
   (outcome classes, reason codes, input types, languages).
2. **No new infrastructure.** Railway runs one Node replica; no Prometheus,
   no external APM. Metrics live in Postgres, exposed the same way as the
   existing impact counters, read by `prod-monitor` and protected endpoints.
3. **Fail-open for the product, loud for the operator.** Metric write failures
   must never break a user check; they are counted as `metrics_write_failed`
   and surface in the monitor.

## Metric set (v1)

| metric                        | labels                                                                 | why                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `delivery_outcome_total`      | channel `direct/reply`, outcome `sent/failed_permanent/ambiguous`      | replaces log grepping; feeds the ambiguous-rate alert from the outbox design            |
| `check_duration_ms` histogram | input_type `text/phone/url/username/apk/qr/image`, language `ru/uz/en` | latency budget enforcement (p50/p95/p99) and regression detection for `rules.ts` growth |
| `rule_hit_total`              | reason_code                                                            | distribution of verdicts; detects a rule firing 0% or 100% (silent breakage)            |
| `panic_route_total`           | panic id class                                                         | SOS routing health                                                                      |
| `provider_error_total`        | provider `openai`, kind `timeout/network/429/5xx`                      | makes the known 429 degradation a trend, not an anecdote                                |
| `poller_health_total`         | kind `getUpdates_failed/lease_conflict/stale_lease`                    | replaces manual counting of provider incidents                                          |
| `metrics_write_failed_total`  | —                                                                      | observability must observe itself                                                       |

## Storage and access

- One `system_metrics` table: `(metric, labels_hash, labels jsonb, window_start, value)` with
  an atomic `INSERT ... ON CONFLICT DO UPDATE value = value + excluded.value`
  upsert per flush; in-memory buffers flush every N seconds or M events.
- Windows: 5 minutes (operational) — retention 30 days via the existing daily
  job; no per-request rows, nothing user-scoped.
- Read paths: `prod-monitor` asserts thresholds (ambiguous rate, p95 latency,
  provider error rate) — a breach fails the scheduled run, which is the alert;
  an owner-facing protected summary endpoint reuses the existing
  service-role/allowlist pattern.

## Latency budget enforcement (companion to this design)

A dedicated Vitest budget test feeds the worst-case corpus sample (long
multi-line, mixed-script, entity-dense inputs plus known pathological
repetition patterns against the transfer/card regex families) through the
deterministic pipeline and asserts **p99 per input < 50 ms** locally. This is
the ReDoS guard for `rules.ts`, which grew by ~800 regex-heavy lines in
PR #129. Budget test lands first (pure test code), the runtime histogram
lands with this design.

## Rollout plan

1. Latency budget test (no runtime change) — can merge as soon as the canary
   window allows source changes.
2. `system_metrics` migration + buffered writer + `metrics_write_failed`
   fail-open path behind a runtime flag.
3. Instrument delivery, check duration, rule hits, provider errors, poller.
4. `prod-monitor` threshold assertions + docs (`API.md`, `DATABASE.md`,
   `ON_CALL_RUNBOOK.md`).

## Open questions for the owner

- 5-minute windows with 30-day retention acceptable for the pilot?
- Any metric above considered sensitive from a privacy standpoint? The design
  deliberately excludes content and identifiers; reason codes and input types
  are closed sets already public in the repo.

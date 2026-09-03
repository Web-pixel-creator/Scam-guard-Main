# Design: 5000+ Persona Surface Simulation (offline, human-like)

Status: **DESIGN — approved to implement.** Written 2026-08-28.
Follows the proven offline harness pattern of
`src/lib/telegram/__qa__/expanded-people-simulation.test.ts` (1,308
surfaces, zero external sinks, enforced by `src/vitest.network-guard.test.ts`).

## Goal

Prove, with 5,000+ human-like inputs, that the deterministic verdicts and
aftercare hold under real-user noise: typos, fragments, slang, code-switching,
panic, multi-turn follow-ups and persona-specific anxieties — across RU/UZ/EN
and Direct/Inline. No Telegram API calls, no AI/TTS/OCR provider calls, no
network: the entire simulation runs in-process. A Telegram ban or an API bill
is structurally impossible — the harness never leaves the local process.

## Persona taxonomy (10 profiles × 3 languages)

| ID   | Persona              | Voice markers                                           |
| ---- | -------------------- | ------------------------------------------------------- |
| P-01 | Pensioner            | formal, worried, asks what to do, long polite sentences |
| P-02 | Rushed commuter      | short fragments, typos, missing punctuation             |
| P-03 | Student              | informal slang, RU/UZ code-switching                    |
| P-04 | Small-business owner | suppliers, invoices, card-to-card urgency               |
| P-05 | Mother               | school payments, children, family context               |
| P-06 | Migrant worker       | simple syntax, salary, transfers home                   |
| P-07 | IT specialist        | precise, technical, English insertions                  |
| P-08 | Already-acted victim | aftercare-heavy: sent money/code, installed app         |
| P-09 | Skeptic              | verification questions, safe-control negatives          |
| P-10 | Pressured victim     | live pressure, SOS, panic routing                       |

Each persona is crossed with scam families (OTP/code, card/CVV, APK/remote
access, task-scam, BNPL, authority impersonation, gift/prize, delivery fee,
OneID phishing, neighbor video, fine-APK cashback, money-mule, blackmail,
romance/investment, fake support) plus benign controls and completed-action
aftercare. Target budget: ~5,200 surfaces (≈520 per persona, balanced across
languages and Direct/Inline).

## Human-likeness without templates

Cases are **authored per persona voice**, not generated from a single
template: each family × persona × language cell gets hand-written seed
phrases, then deterministic persona-preserving mutations (greeting variants,
urgency markers, typo injection at ≤2 chars, punctuation stripping, dialect
synonym swaps). Every mutation must preserve the verdict class of its seed;
the oracle asserts identical expectations for seed and mutation. Corpus
integrity rules (copied from the existing harness): unique ids, unique
`lang+query` pairs, fixed provenance counters asserted in-test.

## Scale architecture (lesson from the 3,805-case timeout)

One file cannot hold 5,000+ cases: evenly sharded suite files, each
**≤ 1,200 cases with an explicit 240 s timeout** (the established convention
for the heaviest suites). Sharding: `persona-sim-surface-a.test.ts` … `-e`
(grouped by persona pairs), each self-contained with its own people array,
oracle and matrix. CI runs shards in parallel; every shard independently
asserts `externalFetchAttempts === 0`, zero DB writes, zero sessions for
Inline, and no AI/reputation calls.

## Assertion classes per case

- verdict class matches the seeded family (danger / safe / aftercare / panic);
- answer language matches the input language;
- topic preservation in both Direct replies and Inline preview/inserted pairs;
- aftercare present for every completed-action case, with the concrete next
  step and no blame;
- no secret echo and no forbidden phrases (per-case blocklists);
- panic routing takes priority for live-threat inputs.

## What it proves and what it does not

Proves: verdict robustness, aftercare coverage, language fidelity and latency
headroom under human noise at 5,000+ scale. Does not prove: real-device
rendering (see `CLIENT_ACCEPTANCE_PLAN_2026-08.md`), human comprehension of
answers, or real-network behavior — all of which stay in their own gates.

## Rollout

1. This design (docs-only, no deploy).
2. Shard A (P-01/P-02, ~1,000 surfaces) on a HOLD branch with the full local
   gate; merge only after the canary verdict allows source changes.
3. Shards B–E sequentially, same gates; each shard re-runnable alone.

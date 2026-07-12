# Tasks: Telegram Follow-up Memory v1

## Baseline

- [x] Add recent last-check and orphan helper routing before `runCheck`.
- [x] Keep new concrete artifacts on the normal risk path.
- [x] Add RU/UZ/EN confidence, next-step, contact and explanation coverage.

## Typed Post-check Hardening

- [x] Centralize confidence, methodology, trusted-person, recheck,
      disagreement and existing helper intents in `LastCheckFollowUpAction`.
- [x] Add deterministic RU/UZ/EN classifiers and response copy.
- [x] Extend `LastCheckSnapshot` with at most three ranked reason codes and
      bounded enum-only methods, source classes and limitations.
- [x] Render methodology only from retained provenance.
- [x] Keep free-text trusted-person guidance side-effect free.
- [x] Require the raw artifact to be resubmitted for recheck.
- [x] Add snapshot freshness, newer-panic arbitration and concrete-artifact
      bypass regressions.
- [x] Add handler regressions proving helper actions bypass `runCheck` only when
      no new artifact is present.

## Release Evidence

- [x] Deploy the current post-check/provenance hardening. Revision `4bd9403` is
      running as Railway deployment `8064b403`; the bounded five-action
      production dialogue smoke passed.
- [ ] Capture real RU/UZ/EN multi-turn transcripts for confidence,
      methodology, trusted-person, recheck and disagreement.
- [ ] Re-run session-loss/restart behavior after deployment.

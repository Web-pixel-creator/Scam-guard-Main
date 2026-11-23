# Open tasks

Read the [verified state](CURRENT_STATE.md) before using this release queue.

1. **Complete review and CI gating of the unified application candidate.** Review local branch `release/unified-viper-p2-20261123` (C0–C4: dependency fixes, P1/P2 security + migrations 33 → 38, Viper redesign + SSR language + SEO, Patch v4 first-action advice + stale-result guards). Keep backup R1 isolated in [PR #150](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/150). Run full GitHub CI (including clean 33 → 38 migration + pgTAP + 5 concurrency proofs) after owner approval to open the Draft PR.
2. **Verify the core journeys on real clients.** Exercise Telegram Direct, Inline and the mobile website in RU/UZ/EN across SMS-code requests, carrier dial commands, unauthorized debits, urgent family transfers, loan/task withdrawal fees and ordinary transfers. Confirm first visible action, consent gates and stale-draft protection. Do not use real credentials or messages.
3. **Restore service and execute migration-first cutover before a live pilot.** With operator approval, follow the freeze/drain/migration-33→38/deploy/read-back sequence, verify Railway `/healthz` and `Production Monitor`, and run the [canary](CANARY_72H.md) and [real-client acceptance](CLIENT_ACCEPTANCE_PLAN_2026-08.md) on the deployed SHA. A synthetic pass does not close a device check.
4. **Verify recovery separately.** [PR #150](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/150) is the separate backup R1 candidate. Independent key access, a separately accessible copy and a successful restore are required before calling production backups operational. Do not enable jobs or provision credentials as part of an application release.

The [August backlog](BACKLOG_2026-08-28.md) retains the detailed product, security and compliance items. An item not repeated above is **not** automatically closed.

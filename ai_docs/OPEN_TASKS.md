# Open tasks

Read the [verified state](CURRENT_STATE.md) before using this release queue.

1. **Select the application candidate.** Compare [main](https://github.com/Web-pixel-creator/Scam-guard-Main/commits/main/), [PR #149](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/149) and any local changes. Identify the application and migration changes that belong to the release. Keep backup and design changes separate.
2. **Check the core journeys locally.** On the selected revision, exercise Telegram Direct, Inline and the mobile website in RU/UZ/EN. Include an SMS-code request, a loan fee before disbursement, an ordinary transfer and a user who has already sent money. Check the first action the person actually sees, not just the classifier label. Do not use real credentials or messages.
3. **Restore service before a live pilot.** With operator approval, verify the deployment, migration order, monitor and delivery on the same baseline. Run the [canary](CANARY_72H.md) and [real-client acceptance](CLIENT_ACCEPTANCE_PLAN_2026-08.md) for that release. A synthetic pass does not close a device check.
4. **Verify recovery separately.** [PR #150](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/150) is the backup candidate. Independent key access, a separately accessible copy and a successful restore are required before calling production backups operational. Do not enable jobs or provision credentials as part of a documentation change.

The [August backlog](BACKLOG_2026-08-28.md) retains the detailed product, security and compliance items. An item not repeated above is **not** automatically closed.

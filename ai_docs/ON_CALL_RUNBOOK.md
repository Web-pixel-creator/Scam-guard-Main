# On-call Runbook

Operational response notes for Ishonch Guard production monitors and Telegram
operator alerts.

## Scope

This runbook covers production alerts from `scripts/prod-monitor.ts` and the
GitHub scheduled `Production Monitor` workflow. Alerts are intentionally
sanitized: they must not contain bot tokens, webhook secrets, chat ids,
Supabase keys, user content, phone numbers, URLs, screenshots or report text.

Current production target:

- Public app: `https://scam-guard-main-production.up.railway.app`
- Railway service: `Scam-guard-Main`
- Monitor command: `railway run npm run monitor:prod -- https://scam-guard-main-production.up.railway.app`

**Transition status (2026-08-02):** the cost-safe monitor policy described
below is local and unreleased. The current `origin/main` scheduled workflow
still has the historical provider-calling behavior recorded in
`CURRENT_STATE.md`. Until the patch is reviewed and merged, do not describe a
scheduled run as no-AI or count it toward the fixed-RC canary. After merge,
require one successful scheduled read-back that explicitly reports the provider
check disabled with no request before using the replacement procedure.

## Alert Meaning

The monitor checks:

- home page returns `200`;
- `/healthz` returns `200`;
- Telegram webhook rejects missing secret with `401`;
- Telegram webhook accepts the configured secret;
- Telegram Bot API token works via `getMe`;
- Telegram delivery matches `TELEGRAM_UPDATE_DELIVERY_MODE`: webhook mode has
  the expected URL/concurrency, while polling mode has an empty webhook URL and
  authenticated polling-leader health 200;
- Telegram has no pending backlog or fresh delivery error;
- after the local D-091 patch is merged and read back, the recurring baseline
  explicitly reports the AI provider check as disabled by policy and sends no
  provider request.

By default, Telegram alerts are sent only for failed checks. Warnings become
alerts only if `MONITOR_ALERT_ON_WARN=true`.

Under the replacement D-091 policy, AI-provider reachability is a separate,
explicitly budgeted manual check. After the patch is merged, select
`check_ai_provider=true` in the GitHub `Production Monitor` workflow only after
an owner approves one provider call. Its independent `--ai-only` job uses
GitHub job status as the alert channel and intentionally receives no Telegram
credentials. Missing key, `429`, `5xx`, other non-success response, timeout or
network failure is a hard failure, never a warning. The default manual action
and every scheduled run leave this boolean false only after that merge.

Private moderation alerts are separate from production monitor alerts. If
`TELEGRAM_MODERATION_CHAT_ID` is configured, new user reports and reputation
appeals can send a redacted summary plus an `/admin` link to the operator chat.
These alerts must stay opt-in and must not include raw report text, screenshots,
OCR, codes, card data, full phone numbers or full URLs.

Production Telegram user-flow smoke tests are also separate from moderation
alerts. They require `TELEGRAM_QA_CHAT_ID` and refuse to use
`TELEGRAM_MODERATION_CHAT_ID`, because those checks generate ordinary bot
replies such as risk cards, language help and Voice-out audio.

To get the chat id safely, create a private Telegram group, add
`@scamguard_bot`, send `/chatid` in that group and copy the returned `Chat ID`
into Railway as `TELEGRAM_MODERATION_CHAT_ID`.

To test the private moderation chat after setup:

```powershell
cd C:\Scam-guard\repo
railway run npm run moderation:smoke
```

The smoke alert is a non-user test message. To also verify the high-signal
research review wording, run:

```powershell
railway run npm run moderation:smoke -- --research
```

That alert uses only public scheme metadata and reason-code ids. If either
fails, confirm the bot was added to the private chat and that Railway has
`TELEGRAM_MODERATION_CHAT_ID`.

## First Five Minutes

1. Run the monitor manually:

   ```powershell
   cd C:\Scam-guard\repo
   railway run npm run monitor:prod -- https://scam-guard-main-production.up.railway.app
   ```

   This default command performs no AI-provider request. Do not inherit
   `MONITOR_CHECK_AI=true` from a shell profile.

2. Check the latest Railway deployment:

   ```powershell
   railway deployment list --json
   railway logs --latest --lines 100
   railway logs --latest --lines 100 --filter "@level:error OR error"
   ```

3. Check GitHub Actions:

   ```powershell
   gh run list --repo Web-pixel-creator/Scam-guard-Main --limit 5
   ```

4. If a recent deploy failed, inspect build/deploy logs before redeploying.
   Prefer fixing the current issue over repeatedly redeploying the same broken
   artifact.

## Triage Matrix

### App or `/healthz` Fails

Likely causes: failed Railway deploy, app crash, missing runtime env variable,
bad build artifact.

Actions:

1. Inspect latest Railway deployment and logs.
2. Run `railway run npm run prod:smoke -- https://scam-guard-main-production.up.railway.app`.
3. If the latest deploy is broken but the previous one was healthy, consider a
   Railway rollback/redeploy only after confirming the failure is deployment
   related.

### Webhook Rejects Valid Secret

Likely causes: `TELEGRAM_WEBHOOK_SECRET` mismatch between Railway and Telegram
registration, stale webhook registration, wrong public URL.

Actions:

1. Confirm Railway has `TELEGRAM_WEBHOOK_SECRET`.
2. Re-register the webhook from a shell with Railway variables:

   ```powershell
   railway run npx vite-node scripts/register-telegram-webhook.ts https://scam-guard-main-production.up.railway.app
   ```

3. Re-run `monitor:prod`.

### Webhook Accepts Missing Secret

Severity: security incident.

Expected behavior is `401` when the secret header is missing. If this check
fails, stop new public promotion until fixed.

Actions:

1. Inspect recent changes around `src/server.ts` and
   `src/lib/telegram/webhook.server.ts`.
2. Rotate `TELEGRAM_WEBHOOK_SECRET`.
3. Re-register the webhook.
4. Re-run `prod:security-smoke` and `monitor:prod`.

### Telegram `getMe` Fails

Likely causes: invalid or revoked `TELEGRAM_BOT_TOKEN`, Telegram API outage,
network issue.

Actions:

1. Confirm `TELEGRAM_BOT_TOKEN` exists in Railway and GitHub Secrets.
2. If token was leaked or revoked, create a fresh token in BotFather, update
   Railway/GitHub Secrets, then re-register the webhook.
3. Re-run `prod:smoke` and `monitor:prod`.

### Telegram Webhook Pending Updates or Fresh Error

Likely causes: app unreachable, Telegram cannot reach the webhook URL, handler
throws repeatedly, webhook URL mismatch.

Actions:

1. Inspect `railway logs --latest --lines 200`.
2. Re-run `monitor:prod`.
3. If the webhook URL is wrong, re-register it.
4. If the handler is throwing, use the latest deploy logs and CI to isolate the
   route/handler failure.

### AI Provider Fails or Returns `429`

Severity: degraded, not usually down.

The rules engine still works without AI. Natural-language explanations,
structured image analysis, OCR-like image understanding and voice STT can
degrade.

After D-091 is merged and its scheduled read-back passes, this alert can come
only from an explicitly enabled bounded probe; it is not part of the recurring
baseline and does not consume one of the 144 scheduled canary observations.

Actions:

1. Check `OPENAI_BASE_URL`, `OPENAI_MODEL` and `OPENAI_API_KEY`.
2. Check provider quota/billing.
3. Keep the bot online unless another critical check fails.
4. Consider adding or switching to a fallback provider only after verifying
   quota is the cause.

## After Fixing

Run:

```powershell
railway run npm run prod:smoke -- https://scam-guard-main-production.up.railway.app
railway run npm run monitor:prod -- https://scam-guard-main-production.up.railway.app
```

For DB/RLS/security changes, also run:

```powershell
railway run npm run prod:security-smoke
```

For Family Shield changes, also run:

```powershell
railway run npm run prod:family-smoke
```

For Telegram handler/copy changes while production is in polling mode, run:

```powershell
railway run npm run prod:telegram-polling-dispatch-smoke -- https://scam-guard-main-production.up.railway.app
```

This command sends only to `TELEGRAM_QA_CHAT_ID`, refuses the moderation chat,
does not acquire the polling leader, and cleans its messages/checks/sessions.
Do not treat it as Inline client evidence; complete
`ai_docs/TELEGRAM_INLINE_QA.md` in a real Telegram client.

For a release polling/resource gate, run the bundled non-network soak in the
Railway runtime:

```powershell
railway ssh node dist/ops/polling-resource-soak.mjs --duration-minutes=60
```

It spends no Telegram, Supabase, reputation or AI API quota and writes no
records or messages. Require `SOAK_FINAL.passed=true`, zero lost updates, zero
duplicate modeled effects and bounded queue/RSS/event-loop/latency metrics. The
offset-loss and stale-leader probes are synthetic; separately verify an actual
instance restart and polling-leader recovery with an approved QA update.

Update `ai_docs/CHANGELOG_AI.md` with the incident summary and verification
commands if the alert required a real fix.

## Boundaries

- Do not print or paste secrets into chat, logs or docs.
- Do not expose raw Telegram chat ids, phone numbers, URLs, screenshots or
  user report text in incident notes.
- Do not make public accusations from unmoderated reports.
- Do not rewrite git history or force-push as part of incident response unless
  explicitly approved for a verified secret-exposure incident.

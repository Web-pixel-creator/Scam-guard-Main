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
- configured AI provider responds.

By default, Telegram alerts are sent only for failed checks. Warnings become
alerts only if `MONITOR_ALERT_ON_WARN=true`.

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

Update `ai_docs/CHANGELOG_AI.md` with the incident summary and verification
commands if the alert required a real fix.

## Boundaries

- Do not print or paste secrets into chat, logs or docs.
- Do not expose raw Telegram chat ids, phone numbers, URLs, screenshots or
  user report text in incident notes.
- Do not make public accusations from unmoderated reports.
- Do not rewrite git history or force-push as part of incident response unless
  explicitly approved for a verified secret-exposure incident.

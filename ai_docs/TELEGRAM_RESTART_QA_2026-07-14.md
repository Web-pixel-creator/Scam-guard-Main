# Telegram restart/re-election QA — 2026-07-14

## Decision

`RES-004` is Passed. The previously completed polling and QR resource profiles
are now paired with a real Railway instance replacement, healthy polling-leader
re-election and one approved real Telegram update with no observed duplicate
reply.

This is not an exactly-once claim. Telegram delivery remains at-least-once and
the application relies on durable, bounded idempotent handling.

## Build and restart identity

- Main revision before the approved QA update:
  `128e27d2baba2afdb58f9dea52b7b87f8a19eb96`.
- Railway deployment:
  `c2b98732-bc38-4fbf-aafa-920282eea161` (`SUCCESS`).
- Runtime image:
  `sha256:b4cc9f1138528cb698ca5d26cec136b8ab1bf5c2d7ec7e111371c358564741b9`.

The deployment created a new application instance while reusing the already
verified image. After startup, `/healthz` and the authenticated polling-leader
endpoint returned `200`; `getWebhookInfo` reported polling mode, no webhook URL
and zero pending updates.

## Approved real-client update

At 15:00 Asia/Tashkent, the user sent the benign greeting `привет` to the real
Telegram bot. The supplied client screenshot shows exactly one deterministic
greeting reply. This route is rules-based and does not invoke the AI provider.

Two metadata-only server read-backs, separated by approximately 30 seconds,
were stable:

| Observation                         | Result |
| ----------------------------------- | -----: |
| Rows observed in the QA window      |      1 |
| Completed rows                      |      1 |
| Processing rows                     |      0 |
| Retried rows                        |      0 |
| Maximum attempt count               |      1 |
| Rows with a recorded failure stage  |      0 |

The read-backs selected and printed only aggregate lifecycle metadata. They did
not expose chat IDs, user IDs, Telegram update IDs, message text, tokens or
secrets. Railway logs contained no error entry or user content for the same
window.

## Post-update verification

The production smoke passed immediately after the real update:

- public application and `/healthz`: `200`;
- missing webhook secret: `401`;
- valid webhook secret while polling: expected `503`;
- Telegram delivery: `mode=polling`, empty webhook URL, pending updates `0`;
- polling leader: `200`;
- configured AI provider health: `200`.

The client-visible single reply plus two stable server read-backs prove that no
duplicate was observed in this restart/re-election test. They do not broaden
the delivery contract beyond at-least-once with idempotent processing.

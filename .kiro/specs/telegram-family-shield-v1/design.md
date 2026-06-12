# Design Document

## Overview

Family Shield v1 adds a small server-side Telegram feature around a private Supabase table. It uses Telegram deep links for consent, because a bot cannot initiate a chat with an arbitrary username or phone number. The guardian creates an invite, the trusted contact opens the bot, and only then can the bot send emergency alerts.

## Architecture

Flow:

1. Guardian taps `/family` or a Family Shield button.
2. Server generates a high-entropy token and stores only `hashIdentifier("family_" + token)`.
3. Bot sends `https://t.me/scamguard_bot?start=family_<token>` as a URL button.
4. Trusted contact opens the link. `/start family_<token>` activates the relationship.
5. High-risk and panic callbacks call `notifyTrustedContact`.

## Components and Interfaces

- `telegram_family_shield` table: private relationship state.
- `family-shield.server.ts`: server-only module for invite creation, acceptance, revocation, and notifications.
- `commands.ts`: handles `/family` and `/start family_<token>`.
- `misc.ts`: handles `family:*` callbacks and routes live-call "tell family" through Family Shield.
- `format.ts`: adds Family Shield action to high-risk result keyboards.
- `api.server.ts`: supports Telegram inline URL buttons in normal `sendMessage` keyboards.

## Data Model

`telegram_family_shield`:

- `guardian_telegram_user_id`: protected user.
- `trusted_telegram_user_id`: accepting user, nullable until accepted.
- `trusted_chat_id`: chat id for Bot API sends, nullable until accepted.
- `invite_code_hash`: HMAC-SHA256 hash of the invite token.
- `status`: `pending`, `active`, or `revoked`.
- `last_notified_at`: notification cooldown state.
- timestamps: `created_at`, `accepted_at`, `revoked_at`, `updated_at`.

## Correctness Properties

1. Raw invite tokens are never persisted.
2. A token can activate at most one relationship.
3. A user cannot link themselves as their own trusted contact.
4. Notifications never contain raw evidence.
5. Missing DB or send failures do not break check/panic flows.
6. Notification cooldown prevents repeated alert spam.

## Error Handling

All family operations return typed result objects. Command and callback handlers convert failures into user-facing fallback messages. Database errors are logged without secrets and never escape to the router.

## Testing Strategy

- Unit tests for invite creation, acceptance, self-link rejection, invalid token handling, and notification redaction.
- Handler tests for `/start family_<token>`, `/family`, `family:notify`, and `livecall:tell_family`.
- Integration smoke tests ensure existing check, panic, and result keyboard flows still include their required callbacks.

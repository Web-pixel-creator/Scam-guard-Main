# Requirements: Telegram Conversation Check v1

## Overview

Users sometimes receive a scam as a sequence: a friendly opener, trust-building
messages, pressure, then a request for a code, card data, QR login, APK install,
deposit or transfer. A single message can look harmless while the chain is risky.

Conversation Check v1 lets the bot review a short user-supplied conversation and
explain how the pressure evolves without storing the raw chat transcript.

## Requirements

1. The bot SHALL provide an explicit conversation-check mode instead of silently
   treating every ordinary text message as a multi-message session.
2. The bot SHALL let the user submit a short sequence of Telegram messages and
   then request analysis with an explicit "analyze" action.
3. The bot SHALL cap the draft at a small bounded size: no more than 8 messages,
   no more than 2,000 characters per message, and no more than 6,000 aggregate
   characters before redaction.
4. The bot SHALL expire an unfinished conversation draft after 20 minutes and
   SHALL allow the user to cancel it.
5. The bot SHALL NOT persist raw conversation text, OCR text, URLs, phone
   numbers, Telegram usernames, card data, OTP/PIN/CVV values, passwords,
   seed phrases, document identifiers or image bytes in `telegram_sessions`.
6. The bot MAY keep a privacy-safe draft snapshot in session state containing
   only message count, timestamps, coarse stage labels, risk levels, reason
   codes, and redacted feature flags.
7. The final analysis SHALL identify: scam stages, pressure escalation,
   requested action, strongest visible risk signals, and one safest next step.
8. The final analysis SHALL keep the original risk verdict conservative. It
   SHALL NOT call a person, account or organization a scammer without
   evidence-backed wording.
9. The mode SHALL work in Russian, Uzbek and English.
10. Fresh standalone artifacts outside conversation mode, such as URLs, phone
    numbers, usernames, screenshots, contacts and voice notes, SHALL continue
    through the existing check pipeline.

## Acceptance

- A chain like "hello" -> "I love you" -> "invest in USDT" is summarized as
  trust-building followed by investment pressure, even if the first message is
  harmless by itself.
- A chain that starts with a bank-like warning and ends with "say the six
  digits from SMS" highlights the code request as the decisive action.
- A user can cancel or let the draft expire without leaving raw evidence in
  session state.
- A pasted one-message transcript can be analyzed in memory, but only a safe
  final `lastCheck` snapshot is saved.
- A normal single URL or phone number sent outside conversation mode is not
  captured by the conversation collector.

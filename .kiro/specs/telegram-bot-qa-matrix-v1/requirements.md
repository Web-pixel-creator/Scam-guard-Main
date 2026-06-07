# Telegram Bot QA Matrix v1

## Overview

This spec locks the bot's most important human-facing flows with regression tests. The goal is to catch cases where a normal follow-up question, emergency question, button, media fallback, or Telegram profile check accidentally falls back to a generic risk result.

## Requirements

### Requirement 1: Main navigation remains actionable

The bot SHALL expose a compact main menu with quick actions for check, emergency help, report, safety, language, and how-it-works.

#### Acceptance Criteria

1. WHEN `/start` is rendered THEN the inline keyboard SHALL contain `check_another`, `emergency`, `report`, `safety`, `show_lang`, and `how_it_works`.
2. WHEN `/help` is rendered THEN it SHALL mention the main commands without requiring a long explanation screen.

### Requirement 2: Unsupported media fallback is useful

The bot SHALL respond to unsupported voice/audio/video with a practical next step instead of a dead-end refusal.

#### Acceptance Criteria

1. WHEN unsupported media is handled THEN the response SHALL explain that full video/audio is not analyzed yet.
2. WHEN unsupported media is handled THEN the response SHALL ask for a link, text, screenshot, QR/payment details, or a short summary of what was promised and requested.

### Requirement 3: Last-check follow-ups preserve context

The bot SHALL answer short follow-up questions about the last result without sending them back through the risk pipeline.

#### Acceptance Criteria

1. WHEN the user asks "Точно?" after a recent QR/menu check THEN the bot SHALL answer with confidence limits and QR-specific guidance.
2. WHEN the user asks "Что еще посоветуешь?" after a recent high-risk check THEN the bot SHALL return next safe steps.
3. WHEN the user asks "Дай номер банка" after a recent phone/check context THEN the bot SHALL return official callback guidance and verified short numbers.
4. WHEN the user asks "Почему так?" after a recent check THEN the bot SHALL explain visible risk signs without exposing internal weights or thresholds.
5. WHEN the follow-up contains a new URL, phone, code, APK, or payment request THEN it SHALL be treated as fresh check input.

### Requirement 4: Emergency follow-ups behave like a copilot

The bot SHALL continue the emergency scenario when the user asks for next steps, bank numbers, scripts, or help from a trusted person.

#### Acceptance Criteria

1. WHEN the last panic scenario is "installed APK" and the user asks for more advice THEN the bot SHALL keep airplane mode/removal/bank guidance.
2. WHEN the last panic scenario is "entered card details" and the user asks for bank numbers THEN the bot SHALL return official callback guidance.
3. WHEN the last panic scenario is "suspicious call" and the user asks for a close person THEN the bot SHALL return elder/stress-friendly trusted-person guidance.
4. WHEN the emergency follow-up text contains a new suspicious payload THEN it SHALL not intercept the message.

### Requirement 5: Telegram public metadata stays cautious

The bot SHALL not claim private facts about Telegram accounts/channels that the Bot API cannot know.

#### Acceptance Criteria

1. WHEN public metadata is found THEN the brief SHALL say this is not a safety guarantee.
2. WHEN public metadata is not found THEN the brief SHALL say this is not proof of scam and ask for visible context.
3. WHEN an invite/private link is sent THEN the brief SHALL explain that the bot cannot inspect closed chat contents.
4. The brief SHALL NOT claim hidden reports, spam history, scam labels, or account age unless a verified source exists.

### Requirement 6: Result cards stay mobile-readable

The bot SHALL keep result messages compact enough for mobile Telegram.

#### Acceptance Criteria

1. WHEN representative safe, unknown, suspicious, and high-risk results are formatted THEN each message SHALL be at most 4096 characters.
2. WHEN result actions are shown THEN the keyboard SHALL contain report, check-another, and why actions; high-risk results SHALL also include emergency help.
3. WHEN an unknown neutral context is formatted THEN the response SHALL be cautious and ask for the missing context instead of inventing a threat.

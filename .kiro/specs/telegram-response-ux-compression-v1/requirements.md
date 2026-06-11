# Requirements: Telegram Response UX Compression v1

## Overview

Telegram emergency replies should pass the "5 second panic test": a stressed user must immediately see one safe next action, not a long checklist. Full instructions and contacts remain available behind explicit buttons.

## Requirements

### R1. Compact First Emergency Card

1. WHEN a user selects a `panic:N` scenario, THE Bot SHALL send a compact first card with the urgent action first.
2. THE first card SHALL include at most three immediate actions before follow-up buttons.
3. THE first card SHALL avoid the full verified contact directory.
4. THE first card SHALL keep the calm human cue for the scenario.

### R2. Full Checklist On Demand

1. WHEN a user presses `panicctx:full`, THE Bot SHALL show the detailed checklist for the current scenario.
2. THE detailed checklist SHALL retain verified contacts, evidence-saving steps, and the safety disclaimer.
3. THE detailed checklist SHALL remain available for all panic scenarios.

### R3. Lighter Follow-Up Keyboard

1. Emergency follow-up keyboards SHOULD prioritize next best actions over many equal choices.
2. THE default emergency follow-up keyboard SHALL keep `panicctx:more`, `panicctx:contacts`, `panicctx:script`, `panicctx:trusted_person`, and `panicctx:full`.
3. THE default emergency follow-up keyboard SHALL NOT repeat the generic `share_advice` button after every emergency answer.
4. THE legacy `share_advice` callback SHALL remain supported for already-sent messages.

### R4. Clear Scenario Wording

1. The first SMS-code scenario button SHALL say that the user already sent the code.
2. Labels SHOULD be literal and understandable for elderly or stressed users.
3. Callback data SHALL remain stable.

### R5. Tests And Safety

1. Tests SHALL verify compact first cards are short and action-first.
2. Tests SHALL verify `panicctx:full` still returns the detailed checklist with verified contacts.
3. Tests SHALL verify legacy callbacks still work.
4. No change SHALL store new personal data or weaken existing safety boundaries.

### R6. Image Fallback Compression

1. WHEN image text/QR cannot be read, THE Bot SHALL answer with a short honest limitation, not a long generic paragraph.
2. Image triage answers SHALL use a compact "hook/risk/safe step" structure.
3. Image triage answers SHALL NOT accuse a sender or claim hidden Telegram reputation signals.

### R7. Compact Image Triage Follow-Up Keyboard

1. WHEN a user selects an image triage category, THE Bot SHALL NOT repeat the full category menu under the answer.
2. THE category answer keyboard SHALL keep only next actions: check another item, media tips, and emergency help.
3. THE initial unreadable-image fallback SHALL still show the full category menu so the user can choose the closest context.

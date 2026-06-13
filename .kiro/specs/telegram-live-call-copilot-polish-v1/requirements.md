# Requirements: Telegram Live-Call Copilot Polish v1

## Overview

Live-call copilot polish makes the "someone is calling me now" emergency flow feel like a calm assistant, not a long static checklist. The bot must lead with one immediate safe action, keep follow-up buttons context-specific, and preserve all existing safety guidance behind explicit buttons.

## Requirements

### R1. Active Call Screen

1. WHEN the user selects the live-call emergency scenario, THE bot SHALL lead with ending the call and a ready phrase.
2. The active-call keyboard SHALL NOT offer "call the bank" before the user confirms that the call is over.
3. The active-call keyboard SHALL include confirmation, ready phrase, already-sent-code, and trusted-person actions.

### R2. Post-Call Next Step

1. WHEN the user taps "I hung up", THE bot SHALL acknowledge the completed action and show only the next safe step.
2. The post-call keyboard SHALL prioritize safe callback and trusted-person support.
3. The full emergency checklist SHALL remain available only behind an explicit full-checklist button.

### R3. Context-Specific Follow-Ups

1. Ready-phrase responses SHALL return a compact keyboard focused on hangup confirmation and trusted help.
2. Safe-callback responses SHALL include official-number guidance and verified short numbers.
3. Live-call follow-up responses SHALL avoid repeating the large generic emergency keyboard unless the full checklist is requested.

### R4. Backward Compatibility

1. Existing `livecall:*` and `panicctx:*` callback data SHALL remain parseable.
2. Existing non-live emergency scenarios SHALL keep their current follow-up keyboard behavior.
3. Family Shield notification buttons SHALL continue to work from live-call flows.

### R5. Tests

1. Tests SHALL verify that the active-call keyboard excludes safe callback before hangup.
2. Tests SHALL verify that post-call responses use a compact keyboard.
3. Tests SHALL verify that the full checklist is still accessible after the live-call flow.

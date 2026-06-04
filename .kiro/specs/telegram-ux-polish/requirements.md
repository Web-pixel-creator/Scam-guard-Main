# Requirements Document

## Introduction

Telegram UX Polish — a set of improvements to the Ishonch Guard Telegram bot covering command menu localization, human-friendly explanation text, OCR/barcode false-positive reduction, panic/live-call flow redesign, and emergency text shortening. Delivered as five independent PRs to keep changes reviewable.

## Glossary

- **Bot**: The Ishonch Guard Telegram bot application (scamguard_bot)
- **Command_Menu**: The Telegram client-side command suggestions list registered via Bot API `setMyCommands`
- **Why_Explanation**: The text shown when a user taps the "❓ Как я решаю?" button after a check result
- **Card_Number_Detector**: The logic in `redactText` that identifies sequences of digits as potential card numbers for masking
- **Panic_Menu**: The inline keyboard shown in response to `/panic` or the emergency button, listing emergency scenarios
- **Live_Call_Flow**: The copilot sub-flow for scenario 6 ("I'm on a suspicious call right now")
- **Emergency_Text**: The full emergency checklist produced by `buildEmergencyText`
- **Context_Words**: Domain-specific vocabulary (e.g., "card", "karta", "CVV", "bank") whose presence near a digit sequence signals that the digits may be a card number
- **setMyCommands_Script**: A standalone script in `scripts/` that calls the Telegram Bot API `setMyCommands` method to register bot commands in all supported languages
- **Lang**: One of the three supported UI languages: `ru`, `uz`, `en`

## Requirements

### Requirement 1: Telegram Command Menu Localization

**User Story:** As a bot user, I want to see localized command descriptions in the Telegram client command menu, so that I understand each command before tapping it.

#### Acceptance Criteria

1. THE setMyCommands_Script SHALL register bot commands with the Telegram Bot API using `setMyCommands` for each supported Lang (ru, uz, en) plus a language-agnostic default scope.
2. WHEN the setMyCommands_Script is executed, THE setMyCommands_Script SHALL send one `setMyCommands` request per Lang with the `language_code` parameter set to the corresponding BCP-47 code.
3. THE setMyCommands_Script SHALL register the following commands: start, check, report, panic, safety, lang.
4. THE setMyCommands_Script SHALL use the `/report` command name (replacing any prior `/report` alias) with localized descriptions matching the existing `bot_dict` tone.
5. THE setMyCommands_Script SHALL read the bot token from the environment using the same accessor as `register-telegram-webhook.ts` and SHALL exit with a non-zero code on missing token.
6. THE setMyCommands_Script SHALL reside in the `scripts/` directory alongside `register-telegram-webhook.ts`.

### Requirement 2: Human-Friendly "How Do I Decide?" Rewrite

**User Story:** As a non-technical user, I want the "How do I decide?" explanation to be written in plain, reassuring language, so that I understand the bot's reasoning without needing technical literacy.

#### Acceptance Criteria

1. THE Bot SHALL display a rewritten `why_explanation` text in `bot_dict` that avoids numeric weights, score thresholds, and technical jargon.
2. THE Bot SHALL structure the Why_Explanation as a short numbered list of plain-language steps (no more than 5 steps) describing what the Bot looks for, without exposing internal scoring numbers.
3. THE Bot SHALL preserve the existing privacy note at the end of the Why_Explanation across all three Lang variants.
4. THE Bot SHALL keep the Why_Explanation text within 800 characters per Lang to remain readable on mobile screens.

### Requirement 3: OCR Barcode False-Positive Fix

**User Story:** As a user who sends screenshots containing barcodes or tracking numbers, I want the bot to stop incorrectly flagging long digit sequences as card numbers, so that I receive accurate risk assessments.

#### Acceptance Criteria

1. WHEN the Card_Number_Detector encounters a sequence of 13–19 consecutive digits (with optional separators), THE Card_Number_Detector SHALL flag the sequence as a potential card number only IF at least one Context_Word appears within 120 characters of the digit sequence.
2. WHEN no Context_Word is present near a digit sequence of 13–19 digits, THE Card_Number_Detector SHALL leave the digit sequence unredacted in the display output.
3. THE Card_Number_Detector SHALL recognize Context_Words in all three Lang variants: Russian ("карта", "карту", "karta", "банк", "bank", "cvv", "cvc", "pin", "пин"), Uzbek ("karta", "bank", "pin"), and English ("card", "bank", "cvv", "cvc", "pin").
4. WHEN a digit sequence passes the Luhn check AND is 16 digits long, THE Card_Number_Detector SHALL flag it as a card number regardless of Context_Word proximity.
5. THE Card_Number_Detector SHALL NOT alter the existing behavior for phone-number or OTP redaction patterns.

### Requirement 4: Panic and Live-Call Flow Redesign

**User Story:** As a user in an emergency, I want to quickly find my situation among clearly visible buttons without scrolling through all 10 options at once, so that I get help faster.

#### Acceptance Criteria

1. WHEN the user triggers the Panic_Menu, THE Bot SHALL display 6 primary scenario buttons (scenarios 1–6) plus one "Другие ситуации" / "Boshqa vaziyatlar" / "Other situations" button.
2. WHEN the user taps the "Другие ситуации" button, THE Bot SHALL edit the original message in-place (using Telegram `editMessageText`) to show buttons for scenarios 7–10 plus a "← Назад" / "← Orqaga" / "← Back" button.
3. WHEN the user taps the "← Назад" button, THE Bot SHALL edit the message back to the initial 6+1 layout.
4. THE Bot SHALL reframe scenario 6 ("Live call") with a concise header emphasizing immediate action ("ПОЛОЖИТЕ ТРУБКУ" / "GO'SHAKNI QO'YING" / "HANG UP") before presenting copilot sub-buttons.
5. WHEN the user taps a specific scenario button, THE Bot SHALL send the scenario-specific emergency steps as a new message (not edit) to preserve the menu for further interaction.
6. THE Bot SHALL keep all Panic_Menu callback_data strings prefixed with the existing `panic:` convention.

### Requirement 5: Emergency Text Shortening and Comprehensive Tests

**User Story:** As a user reading emergency steps on a small phone screen, I want shorter, more scannable text, so that I can act quickly under stress.

#### Acceptance Criteria

1. THE Emergency_Text for each scenario SHALL NOT exceed 1500 characters per Lang.
2. THE Emergency_Text SHALL begin each scenario with the single most important action in bold/uppercase.
3. THE Bot SHALL maintain the existing structure of steps (numbered list) but reduce filler phrases and redundant safety reminders already stated in other scenarios.
4. WHEN the Emergency_Text references official contacts, THE Emergency_Text SHALL continue to pull numbers dynamically from the verified-contacts module.
5. THE Bot SHALL have property-based tests (using fast-check) verifying that `buildEmergencyText` output for every Lang stays within the character limit and contains required contact numbers.
6. THE Bot SHALL have property-based tests verifying that the Card_Number_Detector correctly classifies digit sequences with and without Context_Words.
7. THE Bot SHALL have unit tests for the setMyCommands_Script verifying that it produces valid payloads for each Lang.

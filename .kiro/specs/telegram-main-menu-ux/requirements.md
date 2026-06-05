# Requirements: Telegram Main Menu UX

## Overview

Telegram's built-in command menu cannot be styled beyond command descriptions. The product needs a richer in-chat main menu for mobile users while keeping the system command menu short and predictable.

## Requirements

### R1. Main Menu Screen

1. WHEN the user sends `/start`, THE Bot SHALL send a compact main menu message.
2. WHEN the user sends `/menu`, THE Bot SHALL send the same compact main menu message.
3. THE main menu message SHALL contain a short title, one short explanation, and no dense command list.
4. THE main menu SHALL be localized for `ru`, `uz`, and `en`.

### R2. Inline Actions

1. THE main menu SHALL show six inline actions in a two-column layout:
   - Check
   - Emergency help
   - Report an incident
   - Safety rules
   - Change language
   - How it works
2. THE emergency action SHALL be visually prominent through the 🆘 emoji.
3. Existing callback data for check, report, and emergency SHALL remain unchanged.

### R3. Language Picker

1. WHEN the user taps the language action, THE Bot SHALL show `ru`, `uz`, and `en` language choices.
2. THE language callback data SHALL remain `lang:ru`, `lang:uz`, and `lang:en`.

### R4. Compatibility

1. THE system Telegram command menu SHALL remain simple and localized.
2. Existing commands `/check`, `/report`, `/panic`, `/emergency`, `/safety`, `/lang`, and `/help` SHALL continue to work.
3. THE Bot SHALL accept `/menu` even if it is not listed in the system command menu.

### R5. Testing

1. Tests SHALL verify `/start` main-menu layout.
2. Tests SHALL verify `/menu` returns the same quick-action menu.
3. Tests SHALL verify all new callbacks are acknowledged and produce a response.
4. Tests SHALL verify `/menu` is parsed as a known command.

# Design: Telegram Main Menu UX

## Overview

The feature separates two UI layers:

- Telegram system command menu: simple command list controlled by `setMyCommands`.
- In-chat main menu: a styled message with inline buttons controlled by the bot.

The in-chat menu reuses the existing `formatWelcome` function so `/start` and `/menu` stay identical.

## Architecture

1. Add `/menu` to the router command set.
2. Extend `CB` with callback values for `show_lang`, `safety`, and `how_it_works`.
3. Update `formatWelcome` to render a two-column quick-action keyboard.
4. Update command handling so `/start` and `/menu` call `formatWelcome`.
5. Update callback handling:
   - `show_lang` sends the language picker.
   - `safety` sends the existing safety rules.
   - `how_it_works` sends the existing methodology answer.

## Data Contracts

Existing callback data remains stable:

- `check_another`
- `report`
- `emergency`
- `lang:ru`
- `lang:uz`
- `lang:en`

New callback data:

- `show_lang`
- `safety`
- `how_it_works`

## Error Handling

Callback handlers keep the current best-effort behavior: they acknowledge callback queries first and use existing send helpers, which degrade without throwing on Telegram API failures.

## Testing Strategy

- Unit test `formatWelcome` layout and labels.
- Router test `/menu` command parsing.
- Webhook integration test `/start`, `/menu`, and new callbacks.

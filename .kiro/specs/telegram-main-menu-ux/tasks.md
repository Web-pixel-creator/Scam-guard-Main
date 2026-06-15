# Implementation Plan: Telegram Main Menu UX

## Tasks

- [x] 1. Add `telegram-main-menu-ux` requirements/design/tasks spec.
- [x] 2. Add `/menu` to the Telegram router command union and known-command set.
- [x] 3. Update the welcome/main-menu text for `ru`, `uz`, and `en`.
- [x] 4. Add quick-action labels for safety, language, and how-it-works.
- [x] 5. Update `formatWelcome` to render the first-row emergency action plus grouped quick actions.
- [x] 6. Make `/start` and `/menu` render the same main menu.
- [x] 7. Add callbacks for language picker, safety rules, and how-it-works.
- [x] 8. Update unit/integration tests for `/start`, `/menu`, callbacks, and command parsing.
- [x] 9. Promote emergency help as the first full-width action and clarify "new check" labels.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3", "4"] },
    { "id": 1, "tasks": ["5", "6", "7"] },
    { "id": 2, "tasks": ["8"] }
  ]
}
```

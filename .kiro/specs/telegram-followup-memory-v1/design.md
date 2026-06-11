# Design: Telegram Follow-up Memory v1

## Overview

The existing Telegram check handler already stores `scenarioData.lastCheck` after a
result and checks follow-ups before `runCheck`. The bug is in the classifier/text layer:
Russian strings must be valid UTF-8 and broader real-user phrases must be covered.

## Architecture

1. `handleCheck` receives text.
2. Empty/too-long guards run first.
3. Emergency follow-up router runs first because an active panic context is more urgent.
4. Last-check follow-up router checks recent `scenarioData.lastCheck`.
5. Orphan follow-up router catches short helper questions without recent context.
6. Only non-follow-up content reaches public-post enrichment, metadata enrichment and
   `runCheck`.

## Data Model

`LastCheckSnapshot` remains unchanged:

```ts
interface LastCheckSnapshot {
  level: RiskLevel;
  type: InputType;
  context: LastCheckContext;
  at: string;
}
```

No raw user evidence is stored.

## Classifier

The classifier uses small deterministic regular expressions:

- `confidence`: "точно?", "ты уверен?", "можно доверять?", "sure?"
- `next_steps`: "что дальше?", "что еще посоветуешь?", "что делать?"
- `contacts`: "дай номер банка", "куда звонить?", "official number"
- `explain`: "почему так?", "объясни", "why?"

`SCAM_PAYLOAD_RE` is checked first and causes a bypass to the normal risk pipeline.

## Error Handling

Classifier failures are fail-open to `runCheck`; rendering helpers are pure and do not
throw for known actions.

## Testing Strategy

- Unit tests for exact live phrases from Telegram screenshots.
- Regression test that new artifacts are not intercepted.
- Integration test at handler level to ensure `runCheck` is not called for follow-ups.
- Existing full bot matrix remains as broader coverage.

# Design: Telegram Follow-up Memory v1

## Overview

Telegram follow-up memory is a deterministic action layer between a recent
check result and the normal risk pipeline. It answers short helper phrases from
a bounded, privacy-safe snapshot. It never reconstructs or retains the raw
artifact and never lets a conversational helper hide new scam evidence.

## Architecture

1. `handleCheck` applies the empty/length and urgent emergency routes.
2. Concrete-artifact detection runs as a hard bypass for helper classifiers.
3. `classifyLastCheckFollowUp` accepts only a recent `scenarioData.lastCheck`.
4. Timestamp arbitration rejects last-check routing when an equal/newer recent
   panic context exists.
5. The typed action is rendered from the snapshot without calling `runCheck`.
6. `classifyOrphanCheckFollowUp` provides safe generic copy when no usable
   snapshot exists.
7. Content that is not a helper, or that contains a new artifact, continues to
   public-post/metadata enrichment and `runCheck`.

## Action Model

```ts
type LastCheckFollowUpAction =
  | "confidence"
  | "methodology"
  | "trusted_person"
  | "recheck"
  | "disagreement"
  | "next_steps"
  | "contacts"
  | "explain"
  | "simple_explain"
  | "ai_origin"
  | "confirmation_request"
  | "acknowledgement"
  | "identity";
```

Both recent-context and orphan classifiers use this shared union. RU/UZ/EN
phrases map to the same actions so routing and copy cannot silently diverge by
language.

## Data Model

```ts
interface LastCheckProvenance {
  methods: LastCheckEvidenceMethod[];
  sources: LastCheckEvidenceSource[];
  limitations: LastCheckEvidenceLimitation[];
}

interface LastCheckSnapshot {
  level: RiskLevel;
  type: InputType;
  context: LastCheckContext;
  reasons?: string[];
  provenance?: LastCheckProvenance;
  at: string;
}
```

`buildLastCheckSnapshot` ranks known reason codes deterministically, retains at
most three reasons and derives at most three enum-only methods, source classes
and limitations. It stores no raw message, URL, phone, username, OCR text,
screenshot, code, card data, file or provider response.

## Classification And Arbitration

- `hasConcreteArtifact(text) || NEW_SCAM_REQUEST_RE.test(text)` is checked before
  all helper patterns. A concrete artifact or explicit new-check request returns
  `null` so the caller proceeds to the risk pipeline.
- A snapshot is usable for 20 minutes.
- A recent `lastPanicAt >= lastCheck.at` prevents last-check interception.
- Classifier order is explicit for overlapping phrases: identity and AI-origin
  questions precede methodology/trusted-person/recheck/disagreement, followed
  by contacts, next steps, explanations, confidence, confirmation and
  acknowledgement.

## Rendering Boundaries

- `methodology` uses retained reason/provenance enums and states the evidence
  limitation; missing provenance produces an honest resend request.
- `trusted_person` is advice-only and does not call Family Shield.
- `recheck` asks for resubmission because raw evidence is intentionally absent.
- `disagreement` does not alter the verdict without new evidence.
- Orphan responses explain what concrete artifact is needed and keep urgent
  code/card/password/money safety guidance visible.

## Error Handling

Unknown helper text falls through to the normal pipeline. Known typed renderers
are pure for supported actions. Missing/stale context uses orphan guidance and
must not invent a previous result or methodology.

## Testing Strategy

- Unit-test every action and RU/UZ/EN phrase family.
- Regress concrete-artifact bypasses for URLs, phone/Telegram identifiers,
  secrets, payment/transfer and APK/install evidence.
- Verify timestamp arbitration and snapshot expiry.
- Verify methodology output is provenance-bound and the snapshot contains only
  bounded enum metadata.
- Verify free-text trusted-person guidance has no side effect and recheck does
  not call `runCheck` without a resubmitted artifact.
- Keep real multi-turn RU/UZ/EN Telegram transcripts as deployment evidence;
  this specification update does not mark that live QA complete.

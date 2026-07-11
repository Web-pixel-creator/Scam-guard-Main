# Telegram Intent Contract v1 Requirements

## Goal

One canonical registry SHALL describe every supported Telegram meta, victim,
post-check, panic and fresh-risk-input intent together with its response action,
channel, persistence boundary and trusted-contact boundary.

## Requirements

1. Intent identifiers SHALL be namespaced as `meta.*`, `victim.*`,
   `followup.*`, `panic.*` or `input.risk_check`.
2. Adding a value to a source intent list SHALL require a corresponding contract.
3. Meta, victim and follow-up replies SHALL forbid check rows and trusted-contact
   effects.
4. Direct risk checks SHALL require a check row and permit trusted-contact
   delivery only for the existing private high-risk policy.
5. Inline risk checks SHALL forbid persistence, session state and trusted-contact
   effects.
6. Every response SHALL be localized, non-accusatory, at most 4096 characters
   and SHALL forbid raw evidence persistence.
7. Methodology, confidence and explanation responses SHALL use only visible or
   typed evidence/source classes.
8. A generated RU/UZ/EN dialogue corpus SHALL cover every post-check action in
   recent safe/unknown/suspicious/high-risk/unreadable, orphan, stale and
   new-artifact contexts.
9. New artifacts SHALL bypass all follow-up classifiers and proceed to a fresh
   risk check.
10. The existing live phrase matrix SHALL map completely to the canonical
    contract without changing its current runtime routing.

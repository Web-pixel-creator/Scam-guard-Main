# GitHub Repository Protection Plan

Status: **OPEN / PLAN ONLY**. No GitHub repository setting or secret has been
changed by this document.

## Verified current state (2026-08-26)

- public personal repository;
- `main` is unprotected and repository rulesets are empty;
- secret scanning, push protection and Dependabot security updates are enabled;
- workflows pin third-party Actions to commit SHAs;
- one owner currently performs repository administration and review;
- the production database credential and backup decryption identity are absent
  and must remain absent until this plan's preconditions are met.

This state is adequate for public source review but not for placing a
production database credential or backup decryption identity into repository
Actions secrets.

## Safe sequence

1. Merge a dedicated infrastructure PR that fixes UTF-8 BOM/mojibake, gives
   required workflow jobs stable ASCII names and adds `CODEOWNERS` as an audit
   ownership signal. Re-run CI/Security Gates and record exact check names plus
   numeric GitHub App IDs from successful runs.
2. Restrict GitHub Actions to the reviewed allowlist and enforce full-length SHA
   pinning. Verify every existing scheduled, CI, security and recovery workflow
   still starts before tightening `main`.
3. Create a `main` ruleset with no bypass actors: require pull requests and the
   exact successful ASCII check/App-ID pairs; block force pushes and branch
   deletion. Start with `0` required approvals and
   `require_code_owner_review=false` while there is only one owner. This is an
   interim repository-integrity improvement, not a credential-enablement gate:
   the sole owner can still merge an unreviewed backup-workflow change.
4. Choose and prove one backup-credential protection path before adding any
   production database credential or backup decryption identity:
   - **independent review:** add a second independent trusted reviewer, verify
     recovery access, cover the backup workflow and related scripts with
     `CODEOWNERS`, set required approvals to at least `1`, enable dismissal of
     stale approvals on push and enable required code-owner review with no
     bypass; or
   - **manual environment gate:** scope every secret-consuming backup job and
     credential to a protected environment with required trusted manual
     approval. Enable prevent-self-review and disable bypass for this gate.
     Scheduled jobs will wait for approval, so this is not an unattended daily
     backup or automatic 24-hour RPO.
5. Prove the selected control with a harmless documentation PR, a deliberately
   failing test branch and a backup-workflow-only test change. Exact GitHub
   App numeric IDs are the only permitted non-secret identity metadata because
   required checks are bound to them; never record tokens, logins, user IDs or
   other actor identifiers.
6. Harden and stage-test the Supabase-compatible backup workflow described in
   `BACKUP_AUTOMATION.md`.
7. Only in a separately approved canary-restart window, add the minimum scoped
   production database credential and backup decryption identity and run the
   first backup/read-back/restore evidence cycle. Remove or rotate them
   immediately if workflow scope differs from the approved plan.

## Stop conditions

- No production database credential or backup decryption identity while `main`
  has no effective ruleset **or** while the sole-owner ruleset still has zero
  approvals and no protected-environment manual gate.
- No ruleset activation until required checks use stable ASCII names and exact
  numeric GitHub App IDs.
- No broad Actions wildcard, mutable tag or unreviewed bypass.
- No claim of unattended daily backup when a protected environment leaves
  scheduled runs waiting for manual approval.
- No one-owner approval policy that makes urgent repair impossible; keep backup
  disabled until one of the two explicit credential gates above is proven.

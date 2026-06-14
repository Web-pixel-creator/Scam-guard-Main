# Moderation Guidelines

Last updated: 2026-06-14.

## Principles

- Do not publish accusations from unverified reports.
- Do not infer owner identity, SIM age, Telegram account age, hidden SCAM labels or spam history.
- Treat reputation as Ishonch Guard moderated evidence, not a legal verdict.
- Keep decisions reversible and auditable.
- When evidence is unclear, prefer hiding public reputation over making a confident public accusation.

## Confirming Reports

Confirm a report only when at least one strong signal is present:

- the message asks for SMS/OTP, PIN, CVV, password, seed phrase or full card data;
- the sender asks to install APK/remote access or a "secure app";
- the sender impersonates a bank, state service, operator or support channel and pressures the user;
- the target is tied to multiple consistent reports with the same scheme;
- the proof shows a payment/deposit/fee funnel, fake giveaway, fake QR login or account takeover flow.

Reject or keep in review when:

- the report contains only "they are scammers" without context;
- the target is a normal phone/username with no suspicious request;
- the complaint is a private dispute without scam indicators;
- the evidence includes sensitive data that cannot be safely reviewed without further redaction.

## Reputation Appeals

Use `/appeal` requests to correct public reputation. An appeal can justify removal when:

- the public label was based on a false or duplicate report;
- the target is an official contact and the evidence supports that;
- the original report is stale, unsupported or outside the product scope;
- the display mask points to the wrong target after normalization.

Removing reputation means:

- set the public `entities` row to `moderation_status='rejected'` and `risk_level='unknown'`;
- disable the matching app-owned Telegram reputation target when relevant;
- keep original reports for audit/retention;
- write an `admin_actions` record.

Do not ask users to send OTP, PIN, CVV, passwords, full card numbers or document photos as appeal proof.

## Wording

User-facing labels should stay conservative:

- Good: "There are confirmed Ishonch Guard reports about this contact."
- Good: "This does not prove the person is a scammer; verify the request itself."
- Bad: "This person is definitely a scammer."
- Bad: "Telegram says this account is SCAM" unless the platform data is actually available and verified.

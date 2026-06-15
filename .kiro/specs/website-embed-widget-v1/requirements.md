# Requirements

## Introduction

Website Embed Widget v1 lets trusted media, banks, communities and public
education pages embed a compact Ishonch Guard check box with a simple iframe.
The widget must reuse the existing rules-first check pipeline, rate limits and
privacy boundaries instead of creating a separate public API.

## Requirements

### Requirement 1: Partner Embed Page

**User Story:** As a partner or site owner, I want a page that gives me a safe
iframe snippet, so that I can add Ishonch Guard checks to my own page without
custom integration work.

#### Acceptance Criteria

1. WHEN a user opens `/embed` THEN the page SHALL explain the widget value and
   show a copyable iframe snippet.
2. WHEN the partner changes language or partner label THEN the snippet and live
   preview SHALL update.
3. THE snippet SHALL use `referrerpolicy="strict-origin-when-cross-origin"` and
   a sandbox attribute.

### Requirement 2: Compact Widget Runtime

**User Story:** As an end user reading a partner site, I want to paste a number,
link, Telegram username or suspicious text into a small widget and get a short
risk answer without leaving the page.

#### Acceptance Criteria

1. WHEN the iframe loads `/embed/check` THEN it SHALL render without the normal
   site header, footer or global floating controls.
2. WHEN the user submits input THEN the widget SHALL call the existing
   `checkInput` server function.
3. WHEN the check returns a result THEN the widget SHALL show a compact verdict,
   up to three reasons and up to two safe steps.
4. WHEN the check returns a meta-intent answer THEN the widget SHALL show the
   answer without running a fake risk verdict.

### Requirement 3: Privacy and Safety Boundary

**User Story:** As a user, I want the partner site not to see my suspicious
message or number, so that I can check safely.

#### Acceptance Criteria

1. THE widget SHALL not send raw input to the parent page.
2. THE widget SHALL not include raw input in links or query params.
3. THE widget SHALL reuse existing server-side redaction, persistence and
   shared rate limits.
4. THE widget SHALL not support file upload in v1, to keep the iframe small and
   avoid partner-site storage confusion.

### Requirement 4: Documentation and Discoverability

**User Story:** As the project owner, I want this feature recorded in the AI
docs and roadmap, so that future work can build on it safely.

#### Acceptance Criteria

1. WHEN the feature ships THEN `ROADMAP.md`, `FILE_MAP.md`, `FUNCTIONS_MAP.md`
   and `CHANGELOG_AI.md` SHALL mention it.
2. WHEN tests run THEN helper-level tests SHALL verify snippet URL generation,
   language fallback and sandbox/referrer policy.

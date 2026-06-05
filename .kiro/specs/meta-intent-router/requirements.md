# Requirements Document

## Introduction

Meta Intent Router — a lightweight, deterministic classification layer that detects when a Telegram (or web) user is asking a question TO the bot itself (about its capabilities, methodology, or a prior failure) rather than submitting text for scam-risk analysis. Currently these meta-questions fall into the risk-check pipeline, producing irrelevant risk verdicts and breaking user trust. This feature intercepts meta-questions before the risk engine runs and responds with appropriate help text in the user's language. The classifier is pure synchronous TypeScript with no AI/LLM dependencies.

## Glossary

- **Meta_Intent_Classifier**: A pure, synchronous, deterministic TypeScript function that accepts user text and options, and returns either a matched Meta_Intent identifier or `null` (no match — continue to risk pipeline). No external API or LLM calls.
- **Meta_Intent**: A category of user question directed at the bot itself rather than content to be risk-checked. Supported intents: `how_to_use`, `what_can_you_do`, `how_do_you_check`, `why_failed`, `explain_risk`, `help`
- **Intent_Response_Templates**: A set of trilingual (ru/uz/en) response strings in `bot_dict` keyed by Meta_Intent, returned to the user when a meta-question is detected
- **Router**: The Telegram update dispatch module at `src/lib/telegram/router.ts` that determines how each incoming message is handled
- **Risk_Pipeline**: The `runCheck` function in `src/lib/risk/check-core.ts` that performs scam-risk scoring
- **Scam_Context_Signal**: Any indicator in the text that suggests it is content to be risk-checked rather than a meta-question. Includes: phone numbers, URLs, Telegram usernames/links, bank/payment terms (карта, CVV, PIN, OTP, SMS-код, перевод, karta, o'tkazma, transfer), APK references, forwarded message flag, or text exceeding 200 characters
- **Lang**: One of the three supported UI languages: `ru`, `uz`, `en`
- **Bot**: The Ishonch Guard Telegram bot application
- **Active_Scenario**: A multi-step conversation flow (e.g., /report steps) tracked in the user's session state

## Requirements

### Requirement 1: Meta-Intent Detection

**User Story:** As a Telegram user, I want the bot to recognize when I'm asking it a question (e.g., "как пользоваться?", "что ты умеешь?", "nima qila olasan?"), so that I get a helpful answer instead of an irrelevant risk analysis.

#### Acceptance Criteria

1. WHEN user text is received and no Scam_Context_Signal is present, THE Meta_Intent_Classifier SHALL classify the text against the following Meta_Intent categories: `how_to_use`, `what_can_you_do`, `how_do_you_check`, `why_failed`, `explain_risk`, `help`.
2. THE Meta_Intent_Classifier SHALL detect meta-questions in all three Lang variants (Russian, Uzbek Latin, English) using deterministic keyword and pattern matching.
3. WHEN the Meta_Intent_Classifier matches a Meta_Intent, THE Meta_Intent_Classifier SHALL return the matched intent identifier.
4. WHEN no Meta_Intent is matched, THE Meta_Intent_Classifier SHALL return `null` to indicate the text should proceed to the Risk_Pipeline.
5. THE Meta_Intent_Classifier SHALL be a pure, synchronous, deterministic TypeScript function with no I/O, no external API calls, and no LLM dependencies.
6. THE Meta_Intent_Classifier SHALL NOT use any AI or machine-learning model for classification; routing decisions are keyword/regex-based only.

### Requirement 2: Conservative Scam-Context Override

**User Story:** As a user forwarding a scam message that happens to contain words like "помощь" or "как пользоваться" as part of the scam text, I want the bot to still analyze it for risk, so that scam content is never accidentally treated as a meta-question.

#### Acceptance Criteria

1. WHEN the input text contains any Scam_Context_Signal (phone number, URL, Telegram username or link, bank/payment terms, APK reference, OTP/SMS-code mention, or exceeds 200 characters), THE Meta_Intent_Classifier SHALL return `null` regardless of keyword matches.
2. WHEN the message is a forwarded message (indicated by `forward_origin` presence in the Telegram update), THE Meta_Intent_Classifier SHALL return `null` regardless of content.
3. WHEN the input text contains suspicious scam wording patterns (e.g., "безопасный счёт", "не кладите трубку", "xavfsiz hisob") alongside meta-question keywords, THE Meta_Intent_Classifier SHALL return `null`.
4. THE Meta_Intent_Classifier SHALL err on the side of sending text to the Risk_Pipeline when classification is ambiguous — meta-intents SHALL NOT reduce the security coverage of the bot.
5. WHEN a short text (fewer than 4 words) matches a Meta_Intent pattern and contains no Scam_Context_Signal, THE Meta_Intent_Classifier SHALL classify it as a meta-question (e.g., "помощь", "help", "yordam" are unambiguous).

### Requirement 3: Response Generation

**User Story:** As a user asking a meta-question, I want to receive a clear, helpful answer in my language that explains the bot's capabilities or methodology, so that I trust the bot and know how to use it effectively.

#### Acceptance Criteria

1. WHEN a Meta_Intent is detected, THE Bot SHALL respond with the corresponding Intent_Response_Template in the user's current session Lang.
2. THE Intent_Response_Templates SHALL provide distinct responses for each of the six Meta_Intent categories.
3. THE Intent_Response_Templates SHALL be defined in `bot_dict` (at `src/lib/telegram/bot-i18n.ts`) with entries for all three Lang variants following the existing trilingual string pattern.
4. THE `why_failed` Intent_Response_Template SHALL explain OCR and image-processing limitations and suggest the user send text manually.
5. THE `how_do_you_check` Intent_Response_Template SHALL explain the rules-based methodology without exposing internal scoring weights or thresholds.
6. THE `explain_risk` Intent_Response_Template SHALL describe what the risk levels (safe, unknown, suspicious, high_risk) mean in practical terms.
7. WHEN the user's Lang cannot be determined (no session data available), THE Bot SHALL default to the user's Telegram `language_code` preference, falling back to `ru` if unavailable.

### Requirement 4: Strict Router Integration Priority

**User Story:** As the system, I need meta-intent detection to respect the strict routing priority so that commands, callbacks, and active scenarios are never intercepted, and suspicious content is never misrouted.

#### Acceptance Criteria

1. THE Router SHALL enforce the following strict priority order: (1) callback queries, (2) explicit commands (/start, /check, /report, /panic, /emergency, /safety, /lang, /help), (3) active scenario/session state (report flow, await_check), (4) meta-intent classification, (5) content check via handleCheck.
2. WHEN a plain-text message arrives that is not a command and not part of an Active_Scenario, THE Router SHALL invoke the Meta_Intent_Classifier before routing to `handleCheck`.
3. WHEN the Meta_Intent_Classifier returns a non-null intent, THE Router SHALL invoke a meta-intent response handler instead of `handleCheck`.
4. WHEN the Meta_Intent_Classifier returns `null`, THE Router SHALL continue with the existing `handleCheck` routing unchanged.
5. THE Router SHALL pass the `forward_origin` flag from the Telegram update to the Meta_Intent_Classifier so forwarded messages bypass meta-intent detection.
6. THE meta-intent classification step SHALL NOT intercept or interfere with any existing command, callback, or Active_Scenario handling.

### Requirement 5: Web Channel Support

**User Story:** As a user on the /check web page, I want to get a helpful answer when I type a meta-question instead of receiving a confusing risk analysis result, so that the web experience is consistent with the Telegram bot.

#### Acceptance Criteria

1. WHEN text is submitted on the /check page, THE web check handler SHALL invoke the Meta_Intent_Classifier before calling `runCheck`.
2. WHEN the Meta_Intent_Classifier returns a non-null intent on the web channel, THE web check handler SHALL return the corresponding Intent_Response_Template text instead of a risk result.
3. THE web channel SHALL use the same Meta_Intent_Classifier function as the Telegram channel.
4. WHEN text submitted on the /check page contains a URL, phone number, Telegram username, or any other Scam_Context_Signal, THE web check handler SHALL route to `runCheck` regardless of meta-question keyword matches.

### Requirement 6: Minimal Footprint and Testability

**User Story:** As a developer, I want this feature implemented as a small, focused module with comprehensive property-based tests, so that it is easy to review, maintain, and extend.

#### Acceptance Criteria

1. THE Meta_Intent_Classifier SHALL reside in a single module at `src/lib/meta-intent.ts` with no external service dependencies.
2. THE Meta_Intent_Classifier SHALL export a typed interface specifying input (text: string, options: { isForwarded?: boolean }) and output (Meta_Intent identifier string or null).
3. THE module SHALL have property-based tests (using fast-check) verifying that known meta-question patterns in all three Lang variants are correctly classified.
4. THE module SHALL have property-based tests verifying that texts containing Scam_Context_Signals (URLs, phone numbers, Telegram usernames, bank terms, long text) are never classified as meta-questions regardless of keyword presence.
5. FOR ALL valid Meta_Intent identifiers, classifying a canonical example and then looking up the response template SHALL produce a non-empty string (round-trip property between classifier and response templates).
6. THE Intent_Response_Templates SHALL each be under 1000 characters per Lang to remain readable on mobile screens.
7. THE test suite SHALL include the following specific scenarios: (a) "помогите, мне прислали ссылку https://example.com" routes to check, not help; (b) "почему это опасно?" routes to explain_risk only when no scam artifact is present; (c) "как проверить номер?" routes to how_do_you_check; (d) forwarded long scam text routes to check; (e) URL combined with help wording routes to check; (f) RU/UZ/EN examples for each of the six intents; (g) commands (/help, /start) are not intercepted by Meta_Intent_Classifier; (h) text during active report flow state is not intercepted by Meta_Intent_Classifier.

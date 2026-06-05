# Requirements Document

## Introduction

The Telegram bot's check result messages need a complete UX overhaul (Result Message UX v2). The current format uses one generic template for all risk levels, presents AI explanations as long unformatted paragraphs, and lacks clear visual hierarchy on mobile devices. This feature introduces risk-level-specific message templates, a human-readable verdict line, shortened AI explanations, context-aware advice, emoji-anchored section headers, visual separators, inline action buttons, and strict mobile readability constraints. All changes must preserve MarkdownV2 compliance and trilingual (ru, uz, en) support.

## Glossary

- **Formatter**: The module (`src/lib/telegram/format.ts`) responsible for constructing the MarkdownV2 reply text from check result data
- **Result_Message**: The MarkdownV2 formatted message sent to the user after a risk check is performed
- **Section_Header**: A line of text consisting of an emoji followed by a bold localized title (max 15 characters) that introduces a logical content block
- **Section_Separator**: A thin visual line character sequence used to divide logical blocks within a single message
- **Verdict_Line**: A one-line human-readable summary that appears immediately after the risk level label, before any explanation
- **Risk_Level**: One of four levels: safe, unknown, suspicious, high_risk
- **Template**: A risk-level-specific layout defining section order, tone, and content structure
- **i18n_Module**: The internationalization modules (`src/lib/i18n.ts` and `src/lib/telegram/bot-i18n.ts`) holding trilingual string definitions
- **Risk_Header**: The top-most block showing risk level emoji, bold label, and thick separator line (━━━━)
- **Lang**: One of the three supported language codes: ru, uz, en
- **Inline_Buttons**: Telegram InlineKeyboardMarkup buttons appended below the Result_Message
- **AI_Summary**: A condensed version of the AI explanation limited to 3–5 short lines for mobile readability

## Requirements

### Requirement 1: Human-Readable Verdict Line

**User Story:** As a mobile user, I want the result to start with a single clear verdict sentence, so that I immediately understand the outcome without reading the full explanation.

#### Acceptance Criteria

1. WHEN Risk_Level is safe, THE Formatter SHALL render the Verdict_Line as "⚪ Явных признаков скама не найдено" (ru) / "Aniq firibgarlik belgilari topilmadi" (uz) / "No obvious scam signs found" (en) immediately after the Risk_Header
2. WHEN Risk_Level is unknown, THE Formatter SHALL render the Verdict_Line as "🟡 Недостаточно данных для точной оценки" (ru) / "Aniq baho berish uchun ma'lumot yetarli emas" (uz) / "Not enough data for a precise assessment" (en) immediately after the Risk_Header
3. WHEN Risk_Level is suspicious, THE Formatter SHALL render the Verdict_Line as "⚠️ Есть подозрительные признаки" (ru) / "Shubhali belgilar mavjud" (uz) / "Suspicious signs found" (en) immediately after the Risk_Header
4. WHEN Risk_Level is high_risk, THE Formatter SHALL render the Verdict_Line as "🚨 Высокий риск мошенничества" (ru) / "Firibgarlik xavfi yuqori" (uz) / "High fraud risk" (en) immediately after the Risk_Header
5. THE i18n_Module SHALL define Verdict_Line strings for all four Risk_Level values in all three languages (ru, uz, en)

### Requirement 2: AI Explanation Length Control

**User Story:** As a mobile user on a small screen, I want AI explanations kept short, so that I can read the assessment without scrolling through long paragraphs.

#### Acceptance Criteria

1. WHEN the AI returns an explanation longer than 5 short lines (approximately 280 characters), THE Formatter SHALL truncate or summarize the explanation to a maximum of 5 lines
2. THE Formatter SHALL preserve the first complete sentence of the AI explanation when truncating
3. THE Formatter SHALL NOT display paragraphs exceeding 5 lines in the Result_Message AI_Summary section
4. WHEN truncation occurs, THE Formatter SHALL append an ellipsis indicator ("…") at the end of the AI_Summary
5. THE Formatter SHALL apply the same length limit for all three languages (ru, uz, en)

### Requirement 3: Risk-Level-Specific Message Templates

**User Story:** As a user receiving a check result, I want the message format to match the severity of the risk, so that high-risk results feel urgent and low-risk results feel calm.

#### Acceptance Criteria

1. WHEN Risk_Level is safe, THE Formatter SHALL use a neutral, reassuring tone and the section order: Risk_Header → Verdict_Line → 💡 Brief summary → 📌 What was noticed → ✅ What to do
2. WHEN Risk_Level is unknown, THE Formatter SHALL use a cautious neutral tone, the section order: Risk_Header → Verdict_Line → 💡 Brief summary → 📌 What was noticed → ✅ What to do, and include a prompt asking the user to send more context (link, number, or message text)
3. WHEN Risk_Level is suspicious, THE Formatter SHALL use a warning tone, show detected reasons, and use the section order: Risk_Header → Verdict_Line → ⚠️ Reasons → 🛡 Safe next steps
4. WHEN Risk_Level is high_risk, THE Formatter SHALL use an action-first structure with the section order: Risk_Header → Verdict_Line → 🚨 What to do NOW → 📌 Why it's dangerous → 🧾 What to save / where to report
5. THE Formatter SHALL NOT use a single generic template for all Risk_Level values

### Requirement 4: Section Order Varies by Risk Level

**User Story:** As a user in danger, I want the most important action steps shown first, so that I can act immediately without reading through explanations.

#### Acceptance Criteria

1. WHEN Risk_Level is safe or unknown, THE Formatter SHALL render sections in this order: Risk_Header → Verdict_Line → 💡 Кратко (ru) / Qisqacha (uz) / Brief (en) → 📌 Что заметил (ru) / Nimani payqadim (uz) / What I noticed (en) → ✅ Что делать (ru) / Nima qilish (uz) / What to do (en)
2. WHEN Risk_Level is high_risk, THE Formatter SHALL render sections in this order: Risk_Header → Verdict_Line → 🚨 Что сделать (ru) / Nima qilish (uz) / What to do (en) → 📌 Почему опасно (ru) / Nima uchun xavfli (uz) / Why dangerous (en) → 🧾 Куда обратиться (ru) / Kimga murojaat (uz) / Where to report (en)
3. WHEN Risk_Level is suspicious, THE Formatter SHALL render sections in this order: Risk_Header → Verdict_Line → ⚠️ Причины (ru) / Sabablar (uz) / Reasons (en) → 🛡 Что делать (ru) / Nima qilish (uz) / What to do (en)

### Requirement 5: Short Section Titles

**User Story:** As a mobile user reading on a small screen, I want ultra-short section titles, so that headers occupy minimal space and the message stays compact.

#### Acceptance Criteria

1. THE i18n_Module SHALL define section titles with a maximum length of 15 characters in any Lang
2. THE i18n_Module SHALL use emotionally appropriate titles per Risk_Level (e.g., neutral titles for safe, urgent titles for high_risk)
3. WHEN rendering a Section_Header, THE Formatter SHALL use the shortened localized title from the i18n_Module
4. THE i18n_Module SHALL provide titles in all three languages (ru, uz, en) for every section used across all Risk_Level templates
5. THE i18n_Module SHALL use titles such as "Кратко", "Почему", "Причины", "Что делать", "Контакты", "Жалоба" (ru equivalents) that are concise and scannable

### Requirement 6: Context-Aware Advice

**User Story:** As a user who submitted a vague query, I want advice that matches my specific situation, so that I do not receive irrelevant generic warnings.

#### Acceptance Criteria

1. THE Formatter SHALL NOT include generic safety advice (e.g., "не отправляйте SMS-коды") in safe or unknown Risk_Level results unless the detected reason codes specifically relate to SMS/OTP/code sharing
2. WHEN Risk_Level is unknown and the only detected context is a topic (e.g., crypto, investment) with no URL, phone, payment request, or contact, THE Formatter SHALL render a context-specific message stating that the topic was identified but precise assessment requires more data
3. THE Formatter SHALL match advice items to the detected reason codes from the risk evaluation
4. THE i18n_Module SHALL provide context-specific advice strings for common topic-only scenarios (crypto/investment without actionable indicators) in all three languages (ru, uz, en)
5. WHEN Risk_Level is suspicious or high_risk, THE Formatter SHALL include only advice items relevant to the specific detected reasons

### Requirement 7: Section Headers with Emoji Anchors

**User Story:** As a mobile user, I want each section of the check result message to start with a distinctive emoji, so that I can quickly scan and locate the information I need.

#### Acceptance Criteria

1. THE Formatter SHALL render each Section_Header as an emoji followed by a bold localized title
2. THE Formatter SHALL use distinct emojis for each section type: 💡 for brief summary, 📌 for observations/reasons, ✅ for safe actions, 🚨 for urgent actions, 🛡 for safe next steps, 🧾 for reporting/saving info
3. THE Formatter SHALL preserve the existing Risk_Header format (risk-level emoji + bold label + thick separator) without modification
4. WHEN rendering Section_Headers, THE Formatter SHALL produce the same emoji assignments across all three languages (ru, uz, en)

### Requirement 8: Visual Separators Between Sections

**User Story:** As a mobile user, I want clear visual boundaries between message sections, so that I can distinguish one block of content from the next at a glance.

#### Acceptance Criteria

1. THE Formatter SHALL insert a Section_Separator line between each logical block of the Result_Message
2. THE Formatter SHALL use a thin separator character (such as ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈) that is visually distinct from the thick Risk_Header separator (━━━━━━━━━━━━━━━━━━━━)
3. THE Formatter SHALL place the Section_Separator on its own line between consecutive content blocks
4. THE Formatter SHALL NOT insert a Section_Separator above the first content block or below the last content block

### Requirement 9: Mobile Readability

**User Story:** As a user on a small phone screen, I want the formatted message to be compact and scannable, so that I can understand the risk assessment in one screen without scrolling.

#### Acceptance Criteria

1. THE Formatter SHALL keep the total Result_Message length (excluding inline keyboard markup) below Telegram's 4096 character limit
2. THE Formatter SHALL limit each bullet-list section to a maximum of 3 bullet items
3. THE Formatter SHALL insert exactly one empty line between sections (Section_Separator included)
4. THE Formatter SHALL NOT render dense paragraphs (more than 3 consecutive lines without a break)
5. THE Formatter SHALL produce Result_Messages that fit within one screen on a standard mobile device (target: fewer than 25 lines of visible text for safe/unknown levels)
6. THE Formatter SHALL use short lines (each line fitting within 40 characters on average where possible)

### Requirement 10: MarkdownV2 Compliance and Testing

**User Story:** As a developer, I want the visually polished messages to remain valid MarkdownV2 across all languages, so that Telegram renders them correctly without parse errors.

#### Acceptance Criteria

1. THE Formatter SHALL escape all user-facing text via the existing escapeMarkdownV2 function before injecting markup characters
2. THE Formatter SHALL produce only valid Telegram MarkdownV2 output (bold markers applied outside escaped content)
3. THE Formatter SHALL NOT introduce any MarkdownV2 special characters in Section_Separator strings that could break parsing
4. WHEN emoji characters are used in Section_Headers, THE Formatter SHALL place emojis outside of bold markers to avoid MarkdownV2 escaping conflicts
5. THE Formatter SHALL pass snapshot tests verifying correct MarkdownV2 rendering for all four Risk_Level values in all three languages (ru, uz, en) — 12 snapshot combinations total
6. IF a MarkdownV2 parsing error is detected during testing, THEN THE Formatter SHALL have a fallback that strips bold markers and sends plain text

### Requirement 11: Inline Action Buttons

**User Story:** As a user who received a check result, I want relevant action buttons below the message, so that I can quickly report, re-check, or get more help without typing commands.

#### Acceptance Criteria

1. THE Formatter SHALL render the following Inline_Buttons after every Result_Message: "📢 Сообщить" (ru) / "📢 Xabar berish" (uz) / "📢 Report" (en), "🔁 Проверить ещё" (ru) / "🔁 Yana tekshirish" (uz) / "🔁 Check another" (en), "❓ Почему так?" (ru) / "❓ Nima uchun?" (uz) / "❓ Why?" (en)
2. WHEN Risk_Level is high_risk, THE Formatter SHALL additionally render the button "🆘 Что делать срочно" (ru) / "🆘 Shoshilinch qadamlar" (uz) / "🆘 Emergency steps" (en)
3. THE i18n_Module SHALL provide button label strings for all Inline_Buttons in all three languages (ru, uz, en)
4. THE Formatter SHALL assign stable callback_data values to each Inline_Button that are consistent with the existing bot router contract

### Requirement 12: Trilingual Consistency

**User Story:** As a user of any supported language, I want the Result Message UX v2 applied uniformly across all languages, so that the experience is consistent regardless of my language choice.

#### Acceptance Criteria

1. WHEN Lang is set to ru, THE Formatter SHALL produce the same visual structure (emojis, separators, section order, button layout) as for uz and en
2. THE i18n_Module SHALL define all new strings (verdict lines, section titles, context-aware advice, button labels) for each of the three languages (ru, uz, en)
3. IF a localized string is missing for any Lang, THEN THE Formatter SHALL fall back to the Russian variant of that string
4. THE Formatter SHALL apply the same Risk_Level-specific Template logic regardless of the active Lang


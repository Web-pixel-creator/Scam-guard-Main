# Requirements Document

## Introduction

Brand Impersonation Detector is a new risk engine module for Ishonch Guard that identifies when a URL or text submission attempts to impersonate a known Uzbek brand (bank, payment system, telecom operator, government body). Currently, a phishing URL like `kapitalbank-support.lovable.app` is flagged generically as "suspicious domain" or "hosted platform," but the user receives no clear explanation that this site pretends to be a specific brand. This feature adds a dedicated `brand_impersonation` reason code (weight ~40) that fires when a brand name appears in a non-official context (wrong domain, typosquatted name, suspicious subdomain) and provides the user with an explicit warning naming the impersonated brand and its real official domain.

## Glossary

- **Risk_Engine**: The scoring module (`src/lib/risk/rules.ts`) that evaluates user-submitted content and produces a list of reason codes with weighted scores.
- **Brand_Registry**: A structured dictionary of protected brands containing brand identifiers, name variants, official domains, and associated metadata.
- **Brand_Matcher**: The detection component that compares input (URLs and text) against the Brand_Registry to identify impersonation attempts.
- **Reason_Code**: A string identifier representing a specific risk signal detected by the Risk_Engine (e.g., `brand_impersonation`).
- **Official_Domain**: A domain explicitly owned and operated by a protected brand (e.g., `kapitalbank.uz`).
- **Typosquat_Variant**: A deliberate misspelling or visual lookalike of a brand name used to deceive users (e.g., `kapitolbank`, `kapitalbenk`).
- **Protected_Brand**: An organization (bank, telecom, payment system, government body) whose name and domains are guarded against impersonation.
- **Verified_Contacts_Module**: The existing module (`src/lib/risk/verified-contacts.ts`) that stores verified phone numbers, Telegram handles, and org metadata for known organizations.
- **Impersonation_Explanation**: The user-facing trilingual message that names the impersonated brand and provides the official domain.
- **Evidence_Object**: A structured data object returned by the Brand_Matcher containing detection details including matched brand, alias, location, domain checked, official domains, and confidence level.
- **Domain_Normalizer**: The preprocessing component that normalizes domains (lowercasing, stripping protocol/www, punycode decoding) before comparison against brand aliases.
- **Generic_Brand_Name**: A brand whose canonical name coincides with a common English word or phrase (e.g., "Click", "Payme"), requiring stricter matching rules to avoid false positives.

## Requirements

### Requirement 1: Brand Registry Data Structure

**User Story:** As a system maintainer, I want a structured registry of protected brands with their official domains and name variants, so that the detection logic has an authoritative reference to match against.

#### Acceptance Criteria

1. THE Brand_Registry SHALL contain entries for the following organization categories: banks, payment systems, telecom operators, and government bodies operating in Uzbekistan.
2. WHEN a new brand entry is added, THE Brand_Registry SHALL store the following fields for each Protected_Brand: a unique identifier, a canonical display name (trilingual: ru, uz, en), a list of official domains, a list of known name variants and Typosquat_Variants, and the organization type.
3. THE Brand_Registry SHALL include the following initial brands at minimum: Kapitalbank, NBU (National Bank of Uzbekistan), Ipak Yuli Bank, ANOR Bank, Aloqabank, Uzcard, Humo, Payme, Click, Ucell, Beeline Uzbekistan, Mobiuz (Uzmobile), MVD (Ministry of Internal Affairs), and the Tax Authority.
4. THE Brand_Registry SHALL store at least one official domain per Protected_Brand entry.
5. WHEN the Brand_Registry stores name variants, THE Brand_Registry SHALL include common Cyrillic and Latin transliterations of each brand name.

### Requirement 2: Brand Impersonation Detection in URLs

**User Story:** As a user submitting a suspicious URL, I want the system to detect when a URL impersonates a known brand, so that I am clearly warned about fake websites.

#### Acceptance Criteria

1. WHEN a URL is evaluated AND the URL hostname or path contains a Protected_Brand name or variant, AND the hostname is NOT in the Official_Domain list for that brand, THEN THE Brand_Matcher SHALL emit the `brand_impersonation` reason code.
2. WHEN a URL hostname contains a brand name as a subdomain component (e.g., `kapitalbank-support.lovable.app`), THE Brand_Matcher SHALL detect the brand name within hyphenated or dot-separated subdomain segments.
3. WHEN a URL hostname contains a Typosquat_Variant of a Protected_Brand name (e.g., `kapitolbank.example.com`), THE Brand_Matcher SHALL emit the `brand_impersonation` reason code identifying the target brand.
4. WHEN a URL matches an Official_Domain for a Protected_Brand, THE Brand_Matcher SHALL NOT emit the `brand_impersonation` reason code.
5. WHEN a URL is hosted on a known public platform (e.g., `lovable.app`, `vercel.app`) AND contains a brand name in the subdomain, THE Brand_Matcher SHALL emit the `brand_impersonation` reason code.
6. WHEN validating a URL against Official_Domains, THE Brand_Matcher SHALL treat the official domain AND all its subdomains as legitimate: the hostname MUST end with the official domain preceded by a dot, OR be an exact match of the official domain.
7. WHEN a URL hostname contains an official domain as a substring but does NOT end with it (e.g., `kapitalbank.uz.evil.com`, `kapitalbank-uz.com`, `kapitalbank-support.com`), THE Brand_Matcher SHALL emit the `brand_impersonation` reason code.

### Requirement 3: Brand Impersonation Detection in Text

**User Story:** As a user submitting a suspicious text message, I want the system to detect brand impersonation when a brand name appears alongside a suspicious link, so that I understand the scam tactic being used.

#### Acceptance Criteria

1. WHEN text contains both a Protected_Brand name AND a URL that does not belong to that brand's Official_Domain list, THE Brand_Matcher SHALL emit the `brand_impersonation` reason code.
2. WHEN text mentions a Protected_Brand name without any accompanying URL or suspicious context, THE Brand_Matcher SHALL NOT emit the `brand_impersonation` reason code.
3. WHEN text contains a Protected_Brand name alongside other existing high-risk reason codes (e.g., `asks_for_otp`, `asks_for_card_cvv`) AND the brand mention appears in a suspicious or deceptive context (not merely referenced in a factual way alongside other risk signals), THE Brand_Matcher SHALL emit the `brand_impersonation` reason code.

### Requirement 4: Risk Scoring Integration

**User Story:** As a risk engine consumer, I want the brand impersonation signal to contribute significant weight to the overall score, so that impersonation attempts are appropriately flagged when combined with other signals.

#### Acceptance Criteria

1. THE Risk_Engine SHALL assign a weight of 40 to the `brand_impersonation` reason code.
2. WHEN the `brand_impersonation` reason code is emitted alongside `hosted_app_platform`, THE Risk_Engine SHALL compute the combined score using both weights (40 + 0 = 40).
3. WHEN the `brand_impersonation` reason code fires, THE Risk_Engine SHALL include it in the list of detected reason codes returned to the formatter.
4. WHEN the `brand_impersonation` reason code fires alone without additional risk signals, THE Risk_Engine SHALL NOT classify the result as high_risk.
5. WHEN the `brand_impersonation` reason code fires AND the URL contains support/login/verify/security keywords in the path or subdomain, THE Risk_Engine SHALL classify the combined result as high_risk.
6. WHEN the `brand_impersonation` reason code fires AND the URL is hosted on a public/free hosting domain (lovable.app, vercel.app, pages.dev, netlify.app), THE Risk_Engine SHALL classify the combined result as high_risk.
7. WHEN the `brand_impersonation` reason code fires AND the surrounding text contains OTP/PIN/CVV/card/payment/APK keywords, THE Risk_Engine SHALL classify the combined result as high_risk.
8. WHEN the `brand_impersonation` reason code fires AND a suspicious redirect or URL shortener is present, THE Risk_Engine SHALL classify the combined result as high_risk.

### Requirement 5: User-Facing Explanation

**User Story:** As an end user, I want a clear explanation naming the impersonated brand and showing the real official domain, so that I understand exactly which organization is being faked.

#### Acceptance Criteria

1. WHEN the `brand_impersonation` reason code is present in results, THE Formatter SHALL display an Impersonation_Explanation in the user's selected language (ru, uz, or en).
2. THE Impersonation_Explanation in Russian SHALL follow the template: "Похоже на имитацию [Brand_Name]. Ссылка использует название бренда, но домен не совпадает с официальным. Официальный сайт: [official_domain]".
3. THE Impersonation_Explanation in Uzbek SHALL follow the template: "[Brand_Name] ga o'xshash taqlid aniqlandi. Havola brend nomini ishlatadi, lekin domen rasmiy domenga mos kelmaydi. Rasmiy sayt: [official_domain]".
4. THE Impersonation_Explanation in English SHALL follow the template: "Possible [Brand_Name] impersonation detected. The link uses the brand name, but the domain does not match the official one. Official site: [official_domain]".
5. WHEN multiple brands are detected in a single input, THE Formatter SHALL display an Impersonation_Explanation for each detected brand.

### Requirement 6: False Positive Prevention

**User Story:** As a user sharing legitimate content about brands, I want the system to avoid false alarms when I mention a brand in a normal context, so that I trust the system's accuracy.

#### Acceptance Criteria

1. WHEN the submitted URL exactly matches an Official_Domain or any subdomain of an Official_Domain (e.g., `kapitalbank.uz`, `www.kapitalbank.uz`, `help.kapitalbank.uz`, `app.kapitalbank.uz`), THE Brand_Matcher SHALL NOT emit the `brand_impersonation` reason code.
2. WHEN text mentions a brand name in a plain discussion context (no URLs, no other risk signals), THE Brand_Matcher SHALL NOT emit the `brand_impersonation` reason code.
3. WHEN a URL contains a brand name as part of a legitimate news domain (e.g., `gazeta.uz/article/kapitalbank-results`), THE Brand_Matcher SHALL apply a whitelist of known news/media domains to suppress false positives.
4. WHEN a brand name appears as a common substring in an unrelated word, THE Brand_Matcher SHALL use word boundary detection to avoid false matches.
5. WHEN a Generic_Brand_Name (e.g., "Click", "Payme") appears in normal conversational phrases (e.g., "click here", "click this link", "pay me", "pay me later"), THE Brand_Matcher SHALL NOT trigger brand impersonation detection.
6. WHEN detecting a Generic_Brand_Name AND the brand name appears in the hostname or subdomain OR the brand name appears alongside card/OTP/payment/login/verify keywords, THE Brand_Matcher SHALL emit the `brand_impersonation` reason code.
7. WHEN a Generic_Brand_Name appears in a URL but the brand name is NOT an exact match in the URL hostname or subdomain segment AND the brand name does NOT appear near .uz/payment/card/login/verify context, THE Brand_Matcher SHALL suppress brand impersonation detection for that Generic_Brand_Name.

### Requirement 7: Integration with Verified Contacts Module

**User Story:** As a system architect, I want the brand registry to reuse data from the existing verified-contacts module, so that brand metadata is consistent and maintainable.

#### Acceptance Criteria

1. THE Brand_Registry SHALL reference organization names already defined in the Verified_Contacts_Module to maintain naming consistency.
2. WHEN a new organization is added to the Verified_Contacts_Module, THE Brand_Registry SHOULD be updated to include corresponding brand protection entries.
3. WHEN the `brand_impersonation` reason code fires AND the impersonated brand has verified contact information, THE Formatter SHALL include the verified callback number in the explanation when available.

### Requirement 8: Reason Label Localization

**User Story:** As an end user viewing results in my language, I want the brand impersonation reason label to be displayed in Russian, Uzbek, or English, so that I understand the finding.

#### Acceptance Criteria

1. THE Risk_Engine SHALL provide a REASON_LABELS entry for `brand_impersonation` in all three languages (ru, uz, en).
2. THE REASON_LABELS entry for `brand_impersonation` in Russian SHALL read: "Подражает известному бренду".
3. THE REASON_LABELS entry for `brand_impersonation` in Uzbek SHALL read: "Taniqli brendga taqlid qilmoqda".
4. THE REASON_LABELS entry for `brand_impersonation` in English SHALL read: "Impersonates a known brand".

### Requirement 9: Structured Evidence Object

**User Story:** As a downstream consumer (Telegram bot, web UI, admin panel, test suite), I want a structured evidence object from the detector, so that I can render explanations, populate moderation panels, and write precise test assertions without parsing free-text reasons.

#### Acceptance Criteria

1. WHEN the Brand_Matcher detects brand impersonation, THE Brand_Matcher SHALL return an Evidence_Object containing the following fields: brandId (string, unique brand identifier), brandName (string, canonical display name), matchedAlias (string, the specific variant that matched), matchedIn ("hostname" | "path" | "text" indicating where the brand was found), checkedDomain (string, the domain that was checked), officialDomains (string array, list of official domains for the brand), and confidence ("medium" | "high" indicating detection confidence level).
2. WHEN the brand name is found in the URL hostname, THE Evidence_Object SHALL set matchedIn to "hostname", accurately reflecting that the actual detection location was the hostname.
3. WHEN the brand name is found in the URL path, THE Evidence_Object SHALL set matchedIn to "path", accurately reflecting that the actual detection location was the path.
4. WHEN the brand name is found in the message text (not in a URL), THE Evidence_Object SHALL set matchedIn to "text", accurately reflecting that the actual detection location was the message text and preventing mismatched reporting.
5. WHEN the matched alias is an exact brand name match, THE Evidence_Object SHALL set confidence to "high".
6. WHEN the matched alias is a Typosquat_Variant or partial match, THE Evidence_Object SHALL set confidence to "medium".
7. THE Formatter SHALL use the Evidence_Object to populate the Telegram explanation, web result card, ReasonTimeline component, and admin moderation panel.

### Requirement 10: Domain Normalization

**User Story:** As a detection engineer, I want domains to be normalized before matching against brand aliases, so that trivial obfuscation techniques (mixed case, protocol prefixes, punycode, homoglyphs) do not bypass detection.

#### Acceptance Criteria

1. THE Domain_Normalizer SHALL convert all domain characters to lowercase before comparison.
2. THE Domain_Normalizer SHALL strip the protocol scheme (http://, https://) and the "www." prefix from domains before comparison.
3. WHERE the domain contains Punycode/IDNA-encoded segments, THE Domain_Normalizer SHALL decode them to Unicode representation before comparison.
4. THE Domain_Normalizer SHALL apply basic homoglyph normalization (Cyrillic а→a, l→I, 1→l, 0→o) as a future-safe detection layer.
5. THE Brand_Matcher SHALL apply Domain_Normalizer to the checked domain before comparing against brand aliases and Official_Domains.
6. WHEN a domain uses mixed-case or protocol prefixes to obscure brand names, THE Brand_Matcher SHALL still detect the impersonation after normalization.

### Requirement 11: Key Detection Test Expectations

**User Story:** As a quality assurance engineer, I want clearly defined test expectations for critical detection scenarios, so that I can verify correctness of the brand impersonation detection logic.

#### Acceptance Criteria

1. WHEN the URL `kapitalbank-support.lovable.app` is evaluated, THE Brand_Matcher SHALL emit the `brand_impersonation` reason code.
2. WHEN the URL `kapitalbank.uz` is evaluated, THE Brand_Matcher SHALL NOT emit the `brand_impersonation` reason code.
3. WHEN the URL `help.kapitalbank.uz` is evaluated, THE Brand_Matcher SHALL NOT emit the `brand_impersonation` reason code.
4. WHEN the URL `kapitalbank.uz.evil.com` is evaluated, THE Brand_Matcher SHALL emit the `brand_impersonation` reason code.
5. WHEN a news article text mentions "Kapitalbank" without any URL, THE Brand_Matcher SHALL NOT emit the `brand_impersonation` reason code; however, other risk signals present in the same content MAY independently produce a high_risk classification.
6. WHEN the text "click here" is evaluated, THE Brand_Matcher SHALL NOT match the Click brand.
7. WHEN the text "pay me later" is evaluated, THE Brand_Matcher SHALL NOT match the Payme brand.
8. WHEN the URL `payme-verify.pages.dev` is evaluated, THE Brand_Matcher SHALL emit the `brand_impersonation` reason code.

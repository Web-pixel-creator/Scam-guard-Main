# Implementation Plan: Brand Impersonation Detector

## Overview

Add a brand impersonation detection module to the Ishonch Guard risk engine. The implementation introduces a Brand Registry, Domain Normalizer, Brand Matcher (URL + text), structured Evidence Object output, formatter integration, and integrates the new `brand_impersonation` reason code (weight 40) into the existing scoring pipeline. All code is TypeScript, tested with Vitest and fast-check.

## Tasks

- [x] 1. Create Brand Registry and extend ReasonCode type
  - [x] 1.1 Create the Brand Registry module at `src/lib/risk/brand-registry.ts`
    - Define `OrgCategory` type and `BrandEntry` interface
    - Populate the `BRAND_REGISTRY` array with all 14 required brands (Kapitalbank, NBU, Ipak Yuli, ANOR Bank, Aloqabank, Uzcard, Humo, Payme, Click, Ucell, Beeline UZ, Mobiuz, MVD, Tax Authority) including aliases, official domains, transliterations, and typosquat variants
    - Mark `isGenericName: true` for Click and Payme
    - Export `findBrandByAlias(alias: string): BrandEntry | null` lookup function
    - Define and export the `NEWS_DOMAIN_WHITELIST` array (gazeta.uz, spot.uz, kun.uz, daryo.uz, podrobno.uz, kommersant.uz, review.uz, nuz.uz)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.3, 7.1_

  - [x] 1.2 Add `brand_impersonation` to `ReasonCode` type and `WEIGHTS` in `src/lib/risk/rules.ts`
    - Add `"brand_impersonation"` to the `ReasonCode` union type
    - Add `brand_impersonation: 40` to the `WEIGHTS` record
    - Add trilingual `REASON_LABELS` entry: ru="Подражает известному бренду", uz="Taniqli brendga taqlid qilmoqda", en="Impersonates a known brand"
    - _Requirements: 4.1, 8.1, 8.2, 8.3, 8.4_

  - [x]* 1.3 Write unit tests for Brand Registry integrity (`src/lib/risk/__tests__/brand-registry.test.ts`)
    - Verify all 14 brands are present
    - Verify each entry has at least one official domain
    - Verify required fields (id, name, category, officialDomains, aliases)
    - Verify REASON_LABELS for `brand_impersonation` match exact strings
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 8.1, 8.2, 8.3, 8.4_

- [x] 2. Implement Domain Normalizer
  - [x] 2.1 Create the Domain Normalizer module at `src/lib/risk/domain-normalizer.ts`
    - Define `NormalizedDomain` interface (`hostname: string`, `path: string`)
    - Implement `normalizeDomain(rawUrl: string): NormalizedDomain` function
    - Strip protocol scheme (http://, https://)
    - Strip `www.` prefix
    - Lowercase all characters
    - Decode Punycode/IDNA segments to Unicode (with fallback to raw ASCII on failure)
    - Apply homoglyph normalization (Cyrillic а→a, 0→o, 1→l)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x]* 2.2 Write property tests for Domain Normalizer (`src/lib/risk/__tests__/domain-normalizer.property.test.ts`)
    - **Property 14: Domain normalization produces lowercase output with no protocol or www prefix**
    - **Validates: Requirements 10.1, 10.2**

  - [x]* 2.3 Write property tests for homoglyph normalization (`src/lib/risk/__tests__/domain-normalizer.property.test.ts`)
    - **Property 15: Homoglyph normalization maps known substitutions**
    - **Validates: Requirements 10.4**

  - [x]* 2.4 Write unit tests for Domain Normalizer (`src/lib/risk/__tests__/domain-normalizer.test.ts`)
    - Test protocol stripping, www removal, lowercasing
    - Test punycode decode fallback behavior
    - Test homoglyph replacement edge cases
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Brand Matcher (URL detection)
  - [x] 4.1 Create the Brand Matcher module at `src/lib/risk/brand-matcher.ts`
    - Define `BrandEvidence` and `BrandMatchResult` interfaces
    - Implement `matchBrandInUrl(normalizedUrl: NormalizedDomain, rawHostname: string): BrandMatchResult`
    - Implement official domain validation: exact match OR ends with `.` + official domain
    - Implement hostname segment matching: split hostname by `.` and `-`, check against brand aliases
    - Implement path matching: check brand aliases in URL path
    - Implement generic brand handling: only match if alias is an exact segment in hostname/subdomain
    - Implement news domain whitelist suppression for path-only matches
    - Implement word boundary detection to prevent substring false matches
    - Set `confidence` to "high" for exact alias matches, "medium" for typosquat variants
    - Set `matchedIn` to "hostname" or "path" based on detection location
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 6.1, 6.3, 6.4, 6.5, 6.6, 6.7, 9.1, 9.2, 9.3, 9.5, 9.6_

  - [x]* 4.2 Write property test: Brand alias in non-official domain triggers detection (`src/lib/risk/__tests__/brand-matcher.property.test.ts`)
    - **Property 1: Brand alias in non-official domain triggers detection**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.5**

  - [x]* 4.3 Write property test: Official domain or subdomain never triggers detection (`src/lib/risk/__tests__/brand-matcher.property.test.ts`)
    - **Property 2: Official domain or subdomain never triggers detection**
    - **Validates: Requirements 2.4, 2.6, 6.1**

  - [x]* 4.4 Write property test: Official domain as substring without suffix triggers detection (`src/lib/risk/__tests__/brand-matcher.property.test.ts`)
    - **Property 3: Official domain as substring without suffix triggers detection**
    - **Validates: Requirements 2.7**

  - [x]* 4.5 Write property test: Word boundary detection prevents substring false matches (`src/lib/risk/__tests__/brand-matcher.property.test.ts`)
    - **Property 7: Word boundary detection prevents substring false matches**
    - **Validates: Requirements 6.4**

  - [x]* 4.6 Write property test: News domain whitelist suppresses detection (`src/lib/risk/__tests__/brand-matcher.property.test.ts`)
    - **Property 6: News domain whitelist suppresses detection**
    - **Validates: Requirements 6.3**

  - [x]* 4.7 Write property test: Evidence matchedIn field and confidence accuracy (`src/lib/risk/__tests__/brand-matcher.property.test.ts`)
    - **Property 12: Evidence matchedIn field accurately reflects detection location**
    - **Property 13: Evidence confidence reflects match type**
    - **Validates: Requirements 9.2, 9.3, 9.5, 9.6**

- [x] 5. Implement Brand Matcher (Text detection)
  - [x] 5.1 Implement `matchBrandInText(text: string, urls: string[], otherReasonCodes: ReasonCode[]): BrandMatchResult` in `src/lib/risk/brand-matcher.ts`
    - Scan text for brand name mentions with word boundary detection
    - Extract URLs from text
    - For non-generic brands: emit if brand is mentioned AND (non-official URL present OR high-risk codes present in suspicious context)
    - For generic brands: require accompanying payment/card/OTP/login/verify keywords or URL context
    - Do NOT emit when brand mentioned in plain discussion without URLs or risk signals
    - Set `matchedIn` to "text" for text-only detections
    - _Requirements: 3.1, 3.2, 3.3, 6.2, 6.5, 6.6, 6.7, 9.4_

  - [x]* 5.2 Write property test: Text with brand name and non-official URL triggers detection (`src/lib/risk/__tests__/brand-matcher.property.test.ts`)
    - **Property 4: Text with brand name and non-official URL triggers detection**
    - **Validates: Requirements 3.1**

  - [x]* 5.3 Write property test: Brand name in plain text without URL or risk signals does not trigger (`src/lib/risk/__tests__/brand-matcher.property.test.ts`)
    - **Property 5: Brand name in plain text without URL or risk signals does not trigger**
    - **Validates: Requirements 3.2, 6.2**

  - [x]* 5.4 Write property test: Generic brand name handling (`src/lib/risk/__tests__/brand-matcher.property.test.ts`)
    - **Property 8: Generic brand name in normal conversation does not trigger**
    - **Property 9: Generic brand name in hostname or with suspicious keywords triggers detection**
    - **Validates: Requirements 6.5, 6.6**

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement Formatter and integrate into risk engine pipeline
  - [x] 7.1 Create the Brand Formatter module at `src/lib/risk/brand-formatter.ts`
    - Implement `formatBrandImpersonationExplanation(evidence: BrandEvidence, lang: Lang, verifiedCallbackNumber?: string): string`
    - Implement RU template: "Похоже на имитацию {brandName}. Ссылка использует название бренда, но домен не совпадает с официальным. Официальный сайт: {officialDomain}"
    - Implement UZ template: "{brandName} ga o'xshash taqlid aniqlandi. Havola brend nomini ishlatadi, lekin domen rasmiy domenga mos kelmaydi. Rasmiy sayt: {officialDomain}"
    - Implement EN template: "Possible {brandName} impersonation detected. The link uses the brand name, but the domain does not match the official one. Official site: {officialDomain}"
    - Append verified callback number when available
    - Handle multiple brands: produce one explanation per detected brand
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.3_

  - [x]* 7.2 Write property tests for Formatter (`src/lib/risk/__tests__/brand-formatter.property.test.ts`)
    - **Property 10: Formatter explanation contains brand name and official domain in all languages**
    - **Property 11: Multiple brand detections produce multiple explanations**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

  - [x] 7.3 Integrate brand detection into `check-core.ts` pipeline
    - Import `matchBrandInUrl`, `matchBrandInText`, and `normalizeDomain` into `check-core.ts`
    - After existing `evaluateUrl()` and `evaluateText()` calls, invoke `evaluateBrandImpersonation()`
    - Add `brand_impersonation` to reason codes when detection fires
    - Pass Evidence Objects to the formatter for explanation generation
    - Wrap brand detection in try/catch for graceful degradation
    - _Requirements: 4.1, 4.2, 4.3, 7.3, 9.7_

  - [x]* 7.4 Write unit tests for Formatter output (`src/lib/risk/__tests__/brand-formatter.test.ts`)
    - Test Russian, Uzbek, English templates match expected format
    - Test verified callback number inclusion
    - Test multiple brand explanations
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 7.3_

- [x] 8. Implement key detection test scenarios and scoring integration tests
  - [x]* 8.1 Write unit tests for key detection scenarios (`src/lib/risk/__tests__/brand-matcher.test.ts`)
    - `kapitalbank-support.lovable.app` → detects Kapitalbank impersonation
    - `kapitalbank.uz` → no detection
    - `help.kapitalbank.uz` → no detection
    - `kapitalbank.uz.evil.com` → detects impersonation
    - Text "Kapitalbank" without URL → no detection
    - Text "click here" → no Click brand match
    - Text "pay me later" → no Payme brand match
    - `payme-verify.pages.dev` → detects Payme impersonation
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_

  - [x]* 8.2 Write scoring integration tests (`src/lib/risk/__tests__/brand-integration.test.ts`)
    - `brand_impersonation` alone → score 40, level `suspicious`
    - `brand_impersonation` + `hosted_app_platform` → score 40
    - `brand_impersonation` + `suspicious_short_link` → score 70, level `high_risk`
    - `brand_impersonation` + `asks_for_otp` → score 85, level `high_risk`
    - Verify brand_impersonation coexists with other reason codes
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties defined in the design (Properties 1-15)
- Unit tests validate specific examples and edge cases from Requirement 11
- The design specifies TypeScript throughout; all files use `.ts` extension
- Property tests use `fast-check` (already available) with `numRuns: 100` minimum
- Test files follow project convention: `.test.ts` for unit tests, `.property.test.ts` for PBT

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["4.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "5.4"] },
    { "id": 6, "tasks": ["7.1"] },
    { "id": 7, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 8, "tasks": ["8.1", "8.2"] }
  ]
}
```

# Project Overview

## Name

**Ishonch Guard** ("ishonch" = trust). Anti-scam assistant for Uzbekistan.

## Problem

Scams in Uzbekistan follow a recurring pattern: **call + Telegram + pressure + request for data/action**. Fraudsters impersonate the Central Bank, commercial banks and mobile operators, push urgency and fear, then ask for SMS/OTP codes, card data, screen sharing, a malicious APK install, or a transfer to a "safe account". The product answers one question:

> Is this call, message, link, bot or payment request safe?

## Target market

- Phase 1: Tashkent. Phase 2: all Uzbekistan.
- Primary users: everyday smartphone users, older/less-technical people, bank customers, heavy Telegram users, small business owners.
- Secondary (future B2B): banks, fintech, marketplaces, telecom, cyber-awareness partners.

## Core value proposition

Check phone / Telegram / link / APK / text / screenshot → clear risk level (`safe` / `unknown` / `suspicious` / `high_risk`) + reasons + concrete next steps, in RU/UZ/EN. Report scams. Privacy-first: sensitive data is redacted and hashed, never stored raw.

## Market & competitor research (2025–2026)

**Local context.** Telegram-based impersonation of the Central Bank is a live, high-damage pattern — e.g. a Bukhara resident lost over UZS 1 billion after Telegram contact from fake "Central Bank officials" who pushed a transfer to a "safe card" ([kun.uz, May 2026](https://kun.uz/en/news/2026/05/12/major-fraud-ring-exposed-after-bukhara-resident-loses-over-uzs-1-billion)). 2024 saw a sharp rise in card fraud via stolen confirmation codes ([kursiv.media](https://uz.kursiv.media/en/2025-11-03/access-denied-uzbeks-abroad-are-left-without-online-banking/)) and Android SMS-stealer APK campaigns spread over Telegram ([aviatrix.ai](https://aviatrix.ai/threat-research-center/uzbekistan-2024-telegram-android-sms-stealer-campaign)). Content rephrased for licensing compliance.

**Reference products (what to learn from each):**

| Product                                                         | What it is                                                                                                                                                       | Takeaway for us                                                     |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **ScamShield (Singapore)**                                      | Gov-backed anti-scam suite: app + site + 1799 helpline; check/filter/block across SMS, call, Telegram, WhatsApp, links. 120k+ entities blocked, 900k+ downloads. | Best model. Single trusted place to check, report, block, learn.    |
| **1Lookup**                                                     | B2B API: phone/email/IP validation + fraud scoring ("50+ risk factors"), FCC/carrier data.                                                                       | Future B2B revenue path, not the consumer MVP.                      |
| **Truecaller**                                                  | Caller ID, spam/scam alerts, reverse lookup; 450M+ users.                                                                                                        | Community caller reputation. We go deeper on Telegram + loan scams. |
| **Hiya**                                                        | Voice intelligence, branded/verified calls, AI call screening.                                                                                                   | "Verified official number" layer for banks/operators.               |
| **Robokiller / YouMail**                                        | Consumer call/SMS blocking, answer bots, reverse lookup.                                                                                                         | Auto-blocking is a later phase (Android first). MVP = check/report. |
| **Norton Genie / Bitdefender Scamio / Malwarebytes Scam Guard** | AI scam detectors: paste text / screenshot / link / QR → verdict.                                                                                                | The "paste & get a verdict" UX — but localized to RU/UZ.            |
| **Twilio Lookup / IPQualityScore**                              | Phone/email/IP/URL fraud-scoring APIs.                                                                                                                           | Enrichment sources for the risk engine later.                       |

Sources: [ScamShield](https://www.scamshield.gov.sg/), [GovTech](https://www.tech.gov.sg/products-and-services/for-citizens/scam-prevention/scamshield), [1Lookup](https://www.1lookup.io/), [TrustMRR](https://trustmrr.com/startup/1lookup).

## Differentiation

Consumer-first and **Telegram-first**, tuned to local scam wording (RU/UZ), local actors (Central Bank, Hamkorbank, Kapitalbank, Uzcard, Humo, Payme, Click, Beeline/Ucell/Mobiuz), and local mechanics (fake loans, OTP theft, APK installs, card-to-card "safe account" transfers). Positioning: **"ScamShield for Uzbekistan, Telegram-native."**

## MVP status vs. plan

The current product already delivers the core MVP across web and Telegram:
multi-type check (phone/Telegram/url/apk/text/screenshot/short voice note),
rules-based risk scoring, optional AI explanations/OCR/STT, community reports,
moderated reputation, emergency Telegram flows, Family Shield, inline checks,
public scheme trends and an admin moderation dashboard. Not yet built: native
mobile app, B2B API and automated call/SMS blocking. See `OPEN_TASKS.md`.

## Key product risks

False positives / lynch-mob reporting, doxxing, fake mass-reporting, UZ personal-data law compliance, iOS/Telegram platform limits (can't auto-scan private chats — user must forward/share), and cold-start data sparsity (needs community reports + official feeds).

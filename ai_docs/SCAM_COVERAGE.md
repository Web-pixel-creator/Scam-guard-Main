# Scam Coverage Map

> Realistic map of which scam categories Ishonch Guard covers, how, and where the limits are. We do **not** promise to eliminate scams — no app can. We reduce the chance a user falls for the most common, most costly local schemes by giving a clear verdict *before* they act, plus education and emergency steps.

## Guiding truth

- A detector cannot stop a person who, under pressure, willingly says a code or transfers money. So coverage = **detection + education + emergency response + (later) blocking**.
- Platform limits: iOS can't inspect live calls; Telegram private chats can't be auto-scanned. Model is always **user forwards / pastes / screenshots**, never silent interception.
- Scammers adapt. Coverage grows continuously via community reports, moderation, official feeds and new rules.

## Coverage status legend

- ✅ **Covered now** — reason code + rule exists in `src/lib/risk/rules.ts`.
- 🟡 **Planned rule** — needs a new reason code/pattern (tracked in `OPEN_TASKS.md`).
- 📘 **Education/flow** — handled by guidance, "panic mode", or emergency checklist, not pure detection.

## Categories

| # | Scam category | How we cover it | Status |
|---|---|---|---|
| 1 | Fake bank / Central Bank / operator call | `impersonates_bank`, `impersonates_operator` + phone check | ✅ |
| 2 | Asks for OTP / SMS code / CVV / PIN | `asks_for_otp`, `asks_for_sms_code`, `asks_for_card_cvv`, `asks_for_pin` → high_risk | ✅ |
| 3 | Telegram "bank manager" / trap bots & channels | `telegram_bank_contact` + username/link check | ✅ |
| 4 | Fake loans | `fake_loan_offer` | ✅ |
| 5 | Phishing links / fake payment pages | `evaluateUrl`: short links, weird domains, brand typos | ✅ |
| 6 | Malicious APK install | `apk_download_link`, `asks_to_install_apk` | ✅ |
| 7 | "Transfer to a safe account" | `asks_to_transfer_to_safe_account` | ✅ |
| 8 | Screen sharing (AnyDesk/TeamViewer) | `asks_to_share_screen` | ✅ |
| 9 | Urgency / legal threats | `uses_urgency`, `threatens_legal_action` | ✅ |
| 10 | "Don't hang up" / keeping victim on the line | `asks_not_to_hang_up` + 📘 live-call panic checklist | ✅ + 📘 |
| 11 | Prize / too-good-to-be-true / crypto doubler | `too_good_to_be_true` | ✅ |
| 12 | Requests personal/passport data | `requests_personal_data` | ✅ |
| 13 | **QR-code scam / "quishing"** ("scan this QR to verify/log in") — Telegram account takeover via Link Desktop Device; also fake QR in public places | `asks_to_scan_qr` → always high_risk + 📘 strong warning | 🟡 |
| 14 | **Relative/friend in distress** ("friend had an accident, send money now") | `relative_in_distress` (RU/UZ patterns) | 🟡 |
| 15 | **Time-wasting / prolonging the call** to extract data | reinforce `asks_not_to_hang_up`; can't measure call length → 📘 behavioral guide | 🟡 + 📘 |
| 16 | **Piecemeal data extraction** ("just confirm the last 4 digits of your card") | `requests_card_digits` (RU/UZ patterns) → treated as data theft | 🟡 |
| 17 | **Account-block threat** ("your account/card will be blocked in 24h, confirm now") | `uses_urgency` + `threatens_account_block` | 🟡 |
| 18 | **AI voice-clone call** (call "sounds like" your bank or a relative) | 📘 education only — we can't analyze live audio; advise call-back verification | 📘 |
| 19 | Fake courier / delivery surcharge | `evaluateUrl` + 🟡 `fake_delivery_payment` pattern | 🟡 |
| 20 | Marketplace prepayment / fake buyer-seller | 🟡 `payment_before_service` (code exists, needs patterns) | 🟡 |
| 21 | Romance / dating scam | 🟡 future pattern | 🟡 |
| 22 | Fake job offer | 🟡 future pattern | 🟡 |
| 23 | Free eSIM / prize QR stuck on ATMs | overlaps `asks_to_scan_qr` + `too_good_to_be_true` | 🟡 |

> Research note (2025–2026 trends, rephrased for licensing compliance; sources: southernbank.com, ntd.com, cybersamir.com, kun.uz, group-ib.com): the fastest-rising tactics are QR-code "quishing", AI voice cloning that imitates a bank or a loved one, and urgency-driven phishing ("account blocked in 24h"). Live audio and deepfake-voice detection are **out of scope** for the bot — we counter them with education + call-back verification advice.

## Protection layers (beyond detection)

1. **Clear verdict before action** — risk level + reasons + concrete next step, in RU/UZ/EN.
2. **Emergency mode** (`/emergency`) — "already sent a code/money?" first-hours checklist (block card, change Telegram password, end sessions, call bank official number, file report 102).
3. **Panic / live-call helper** 📘 — short script for when someone is being pressured on a call ("hang up, call the bank yourself").
4. **Education for vulnerable users (elderly)** 📘 — simple language, big-text/voice-friendly, and a **trusted-contact / family-share** so a relative can review a suspicious message. (Planned — see OPEN_TASKS.)
5. **Community reports + moderation** — grows the `entities` reputation base over time.
6. **Later:** automated call/SMS blocking (Android first), official "verified" contacts, B2B risk API.

## Hard limits (state these to users, don't hide)

- We can't read your private chats or listen to live calls — you must forward/paste/screenshot.
- We reduce risk; we don't guarantee zero scams.
- A "safe/unknown" result is not a green light to share codes or transfer money.

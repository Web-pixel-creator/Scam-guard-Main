# Scam Coverage Map

Ishonch Guard does not promise to eliminate scams. It reduces risk by giving a clear verdict before the user acts, plus education, reporting and emergency steps.

## Guiding truth

- A detector cannot stop someone who is already under pressure and willingly shares a code or transfers money.
- Coverage = detection + education + emergency response + community reports.
- Telegram private chats and live calls cannot be silently inspected; the user must forward/paste/screenshot.
- Scammers adapt, so coverage grows from moderated reports, official warnings and research feeds.

## Status legend

- **Covered:** reason code/rule or concrete flow exists.
- **Partial:** related rule exists, but coverage is indirect or education-only.
- **Planned:** needs a reason code, pattern, content or integration.

## Categories

| #   | Scam category                                | How we cover it                                                          | Status  |
| --- | -------------------------------------------- | ------------------------------------------------------------------------ | ------- |
| 1   | Fake bank / Central Bank / operator call     | `impersonates_bank`, `impersonates_operator`, phone checks               | Covered |
| 2   | OTP / SMS code / CVV / PIN request           | `asks_for_otp`, `asks_for_sms_code`, `asks_for_card_cvv`, `asks_for_pin` | Covered |
| 3   | Telegram "bank manager" / trap bot           | `telegram_bank_contact`, `unknown_sender`                                | Covered |
| 4   | Fake loans                                   | `fake_loan_offer`                                                        | Covered |
| 5   | Phishing links / fake payment pages          | short links, weird domains, brand typos                                  | Covered |
| 6   | Malicious APK install                        | `apk_download_link`, `asks_to_install_apk`                               | Covered |
| 7   | "Transfer to a safe account"                 | `asks_to_transfer_to_safe_account`                                       | Covered |
| 8   | Screen sharing / remote access               | `asks_to_share_screen`                                                   | Covered |
| 9   | Urgency / legal threats                      | `uses_urgency`, `threatens_legal_action`                                 | Covered |
| 10  | "Do not hang up" pressure                    | `asks_not_to_hang_up` + emergency guidance                               | Covered |
| 11  | Prize / too-good-to-be-true / crypto doubler | `too_good_to_be_true`                                                    | Covered |
| 12  | Personal/passport data request               | `requests_personal_data`                                                 | Covered |
| 13  | QR login/account takeover                    | `asks_to_scan_qr`                                                        | Covered |
| 14  | Relative/friend in distress                  | `relative_in_distress`                                                   | Covered |
| 15  | Piecemeal card data extraction               | `requests_card_digits`                                                   | Covered |
| 16  | Account/card block threat                    | `threatens_account_block` + urgency                                      | Covered |
| 17  | AI voice-clone call                          | education only; advise callback verification                             | Partial |
| 18  | Fake courier / delivery surcharge            | `fake_delivery_payment` + URL heuristics                                 | Covered |
| 19  | Marketplace prepayment / fake buyer-seller   | `payment` detector + `payment_before_service` text patterns              | Covered |
| 20  | Romance / dating scam                        | future pattern/content                                                   | Planned |
| 21  | Fake job offer                               | future pattern/content                                                   | Planned |
| 22  | Malicious Telegram GIF/file bait             | `malicious_file_bait`, APK coverage and out-of-scope handling            | Covered |
| 23  | Fake boss/official/workplace request         | `fake_boss_request` + personal-data rules                                | Covered |

## Research feed: pressauz

`https://t.me/pressauz` is useful as a local research feed. Use it to identify recurring tactics, not as raw app content. Current themes to track:

- suspicious foreign calls asking for SMS codes or card data;
- unknown Telegram files/GIFs that may lead to malware or phishing (`malicious_file_bait`);
- fake manager/boss/official messages requesting personal data (`fake_boss_request`);
- APK "security" apps that steal payment data;
- fake delivery/service/payment intermediaries (`payment` detector, `fake_delivery_payment`, `payment_before_service`) and offline social-engineering scripts.

Before adding a new detection rule, summarize the tactic, map it to a reason code, add RU/UZ/EN labels/advice, and write tests.

## Hard limits

- We cannot read private chats or listen to live calls.
- A `safe` or `unknown` result is not permission to share codes or transfer money.
- Public reputation appears only after moderation.

# Requirements: Telegram Follow-up Memory v1

## Overview

After a check result or emergency scenario, users often ask short human follow-ups:
"Tочно?", "что дальше?", "дай номер банка", "что еще посоветуешь?". These must not be
treated as fresh scam payloads. The bot should answer using the latest safe session
context while still sending real links, numbers, usernames and suspicious text to the
risk pipeline.

## Requirements

1. The bot SHALL route short post-check questions about confidence, next steps,
   explanation and official contacts before `runCheck`.
2. The bot SHALL recognize Russian, Uzbek and English follow-up phrases using valid
   UTF-8 text patterns.
3. The bot SHALL keep a safe `lastCheck` snapshot only: risk level, input type,
   coarse context and timestamp. It SHALL NOT store raw links, phone numbers, OCR text,
   card data, codes or image bytes in the snapshot.
4. The bot SHALL ignore stale `lastCheck` snapshots older than 20 minutes.
5. The bot SHALL let a newer emergency context win over an older check context.
6. The bot SHALL not intercept messages that contain a new artifact: URL, Telegram
   username/link, phone number, SMS/OTP/CVV/PIN/card/payment/APK terms.
7. If there is no usable recent context, the bot SHALL answer orphan follow-ups with
   safe generic guidance instead of returning a fake "not enough data" risk card.
8. Official contact replies SHALL tell users to call only official numbers and include
   verified bank/payment short codes.

## Acceptance

- "Точно?" after a menu QR/safe screenshot returns a confidence answer, not a new check.
- "Что еще посоветуешь?" after APK/card/OTP/high-risk result returns next safe steps.
- "дай номер банка" after a card/phone/emergency result returns official callback guidance.
- "Почему так?" returns a plain explanation without internal weights or thresholds.
- "Точно? https://evil.example/login" still goes to the risk pipeline.

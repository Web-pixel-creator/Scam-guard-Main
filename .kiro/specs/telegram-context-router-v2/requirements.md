# Requirements: Telegram Context Router v2

## Overview

Telegram users often ask short follow-up questions after a check or emergency answer: "точно?", "что делать дальше?", "дай номер банка", "я не понял", "почему так?". These should feel like a continuation of the previous situation, not a new scam-risk check. Context Router v2 extends the existing emergency and last-check follow-up layers with deterministic, privacy-preserving routing.

## Requirements

### R1. Last Check Context Memory

1. WHEN a check result is sent, THE Bot SHALL persist only non-sensitive summary metadata: risk level, input type, coarse context and timestamp.
2. THE persisted last-check context SHALL NOT include raw input text, OCR text, URLs, phone numbers, usernames, card data, OTP/PIN/CVV/passwords or image bytes.
3. THE context SHALL expire logically after a short window so unrelated future messages go through normal check routing.

### R2. Natural Last-Check Follow-Ups

1. WHEN the user asks "точно?", "уверен?", "это безопасно?" after a recent check, THE Bot SHALL answer with a conservative confidence explanation.
2. WHEN the user asks "что делать дальше?", "что посоветуешь?", "как поступить?" after a recent check, THE Bot SHALL answer with context-specific next steps.
3. WHEN the user asks "дай номер банка", "куда звонить?", "горячая линия" after a recent check involving phone, bank, payment, suspicious or high-risk context, THE Bot SHALL show official-contact guidance and remind the user not to trust numbers from the suspicious message.
4. WHEN the user asks "почему так?", "я не понял", "объясни" after a recent check, THE Bot SHALL explain the previous result in plain language without exposing internal weights or thresholds.
5. THE Bot SHALL respond in the user's current language.

### R3. Conservative Payload Override

1. WHEN the text contains a URL, Telegram username/link, phone number, OTP/SMS-code, CVV/PIN, APK, payment, transfer, card or bank payload, THE follow-up classifier SHALL return `null` so the message is risk-checked.
2. WHEN a newer emergency context exists, THE last-check follow-up classifier SHALL not intercept the text.
3. WHEN there is no recent last-check context, THE classifier SHALL return `null`.

### R4. Router Priority

1. Existing Telegram routing priority SHALL remain: callbacks > commands > active scenarios > meta-intent > content check.
2. Callback buttons such as "Почему так?", "Проверить ещё", "Сообщить" and panic buttons SHALL continue to be handled as callbacks, not last-check follow-ups.
3. "Проверить ещё" SHALL start a fresh `await_check` state and clear old scenario data.

### R5. Tests

1. Tests SHALL verify QR/menu screenshot followed by "точно?" returns contextual confidence, not "Недостаточно данных".
2. Tests SHALL verify a safe phone check followed by "дай номер банка" returns official-contact guidance.
3. Tests SHALL verify a high-risk check followed by "что делать дальше?" returns urgent next steps.
4. Tests SHALL verify "почему так?" after a recent check returns a plain-language explanation.
5. Tests SHALL verify suspicious payloads still route to the risk pipeline even when last-check context exists.
6. Tests SHALL verify callback buttons are not intercepted by last-check follow-ups.

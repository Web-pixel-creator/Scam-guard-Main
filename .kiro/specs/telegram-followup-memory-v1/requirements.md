# Requirements: Telegram Follow-up Memory v1

## Overview

After a check result, users often ask short human follow-ups such as «Ты точно
уверен?», «Почему домен подозрительный?», «Можно связаться с близким?» or
“check it again”. These messages are helper actions, not fresh scam payloads.
The bot must answer from a recent privacy-safe snapshot while sending any new
link, number, username, payment request, secret request or other concrete
artifact through the normal risk pipeline.

## Requirements

1. The bot SHALL represent post-check behavior with the shared typed
   `LastCheckFollowUpAction` taxonomy:
   - `confidence`;
   - `methodology`;
   - `trusted_person`;
   - `recheck`;
   - `disagreement`;
   - `next_steps`;
   - `contacts`;
   - `explain`;
   - `simple_explain`;
   - `ai_origin`;
   - `confirmation_request`;
   - `acknowledgement`;
   - `identity`.
2. The bot SHALL recognize supported Russian, Uzbek and English helper phrases
   with deterministic classifiers and parallel localized responses.
3. The bot SHALL keep only a privacy-safe `lastCheck` snapshot: risk level,
   input type, coarse context, timestamp, at most three non-sensitive reason
   codes and bounded enum-only provenance. Provenance SHALL contain at most
   three evidence methods, source classes and limitations.
4. The snapshot SHALL NOT contain raw links, phone numbers, usernames, message
   text, OCR text, screenshots, card data, codes, passwords, files, provider
   payloads or other raw evidence.
5. The bot SHALL ignore a `lastCheck` snapshot older than 20 minutes. If a
   recent panic/emergency timestamp is equal to or newer than the check
   timestamp, emergency context SHALL win and the last-check helper SHALL not
   intercept the message.
6. A message containing a new concrete artifact SHALL bypass helper routing and
   reach the normal risk pipeline. This includes URLs, Telegram usernames or
   links, phone numbers, codes, card/payment data, transfers, APK/install
   requests and other actionable scam evidence.
7. A `methodology` answer SHALL use only retained reason/provenance enums. It
   SHALL identify the available method/source and limitation without inventing
   hidden checks, provider data, identity proof or internal score thresholds.
8. A free-text `trusted_person` action SHALL provide manual safe-contact
   guidance only. It SHALL NOT notify a Family Shield contact or cause any other
   side effect.
9. A `recheck` action SHALL explain that the original artifact was not retained
   and ask the user to submit it again. It SHALL NOT claim that a new check was
   performed or silently change the previous result.
10. A `disagreement` action SHALL acknowledge uncertainty and explain safe next
    steps without overriding the deterministic verdict in the absence of new
    evidence.
11. If there is no usable recent context, the bot SHALL render a safe orphan
    response for recognized helper actions instead of returning a fabricated
    “not enough data” risk card.
12. Official-contact replies SHALL direct users to independently verified
    channels and SHALL not treat a phone number supplied in the suspicious
    conversation as trusted.

## Acceptance

- «Ты точно в этом уверен?» after a recent result returns `confidence`, not a
  new risk check.
- «Почему домен подозрительный ты посчитал, ты его проверил каким-то образом?»
  returns `methodology` based only on retained enum provenance.
- «Я могу связаться с близким?» returns manual guidance and produces no trusted
  contact notification.
- «Перепроверь ещё раз» asks the user to resend the raw artifact and does not
  pretend that a recheck occurred.
- A disagreement phrase does not change the result without new evidence.
- «Ты точно? https://evil.example/login» bypasses helpers and reaches the risk
  pipeline.
- A newer recent panic context wins over an older `lastCheck` snapshot.

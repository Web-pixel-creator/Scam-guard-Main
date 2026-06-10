# Requirements: Telegram Image Fallback Triage v1

## Overview

When screenshot OCR/QR analysis fails, the bot must not leave the user in a dead end. It shall stay honest about unreadable images and offer fast scenario buttons that provide safe next steps without pretending to inspect hidden image contents.

## Requirements

### R1. Honest unreadable-image fallback

1. WHEN image text/QR cannot be read reliably, THE bot SHALL say it could not read the image.
2. THE bot SHALL NOT invent a verdict, account reputation, hidden Telegram labels, account age, or report history from an unreadable image.
3. THE fallback SHALL ask for the text/link/next screen, but also offer quick category buttons.

### R2. Scenario triage buttons

1. The fallback keyboard SHALL include quick categories for NFT/Stars/gifts, casino/free-spins, TON/wallet, bank/code, and menu/QR.
2. Selecting a category SHALL return practical safe steps for that scenario.
3. The response SHALL remain cautious: it describes common risk points and asks for the next concrete evidence.

### R3. Safety and privacy

1. Triage callbacks SHALL not run risk scoring or persist a check row.
2. Existing image bytes SHALL remain in-memory only and SHALL never be persisted.
3. Emergency and check-another actions SHALL remain available from the fallback.

### R4. Verification

1. Unit tests SHALL cover the triage keyboard and at least one scenario response.
2. Webhook integration tests SHALL cover unreadable image fallback keyboard and triage callback handling.

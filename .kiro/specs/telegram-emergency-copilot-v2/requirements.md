# Requirements: Telegram Emergency Copilot v2

## Overview

Emergency mode must feel like a guided assistant, not a static checklist. After a user chooses a panic scenario, the bot should remember that context and answer natural follow-up questions such as "what else should I do?", "give me the bank number", or "what should I tell my family?" without routing them to the generic risk pipeline.

## Requirements

### R1. Panic Context Memory

1. WHEN a user taps any `panic:N` scenario, THE Bot SHALL persist the selected scenario as the latest emergency context for that Telegram user.
2. WHEN a user taps a live-call copilot action, THE Bot SHALL persist the corresponding emergency context.
3. THE persisted context SHALL NOT include sensitive user input, phone numbers, links, card data, OTP codes, or screenshots.
4. THE context SHALL expire logically after a short window so unrelated future messages still go through normal risk checking.

### R2. Natural Follow-Up Routing

1. WHEN the latest emergency context exists and the user asks for more advice, THE Bot SHALL answer with scenario-specific next steps.
2. WHEN the user asks for a bank number or official contact while an emergency context exists, THE Bot SHALL show verified callback contacts and remind the user not to call numbers from the suspicious message.
3. WHEN the user asks what to say, THE Bot SHALL provide a short script that the user can read aloud.
4. WHEN the user asks how to involve a close person, THE Bot SHALL provide an elder-friendly trusted-person script.
5. WHEN the message contains a URL, phone number, Telegram username, OTP, CVV, APK link, or long suspicious text, THE Bot SHALL NOT intercept it as follow-up and SHALL route it to the risk pipeline.

### R3. Elder-Friendly Trusted Person Help

1. THE trusted-person response SHALL be warm, concrete, and shame-reducing.
2. THE trusted-person response SHALL tell the user to call or sit with a trusted person, not merely send a generic text.
3. THE response SHALL explicitly say not to forward SMS codes, PIN, CVV, passwords, or card photos.
4. THE response SHALL include a ready-to-read phrase for elderly or stressed users.

### R4. Interactive Buttons

1. Emergency follow-up answers SHOULD include inline buttons for the next useful actions.
2. Existing callback data SHALL remain stable.
3. New callback data SHALL be prefixed with `panicctx:` and SHALL be acknowledged before sending a response.
4. Buttons SHALL not require the user to re-open `/panic`.

### R5. Testing

1. Tests SHALL verify that `panic:2` followed by "что еще посоветуешь?" returns APK-specific guidance, not "Недостаточно данных".
2. Tests SHALL verify that `panic:4` followed by "дай номер банка" returns official contact guidance.
3. Tests SHALL verify that `panic:6` followed by "что сказать?" returns a call-ending script.
4. Tests SHALL verify that real suspicious content still goes through the risk pipeline even when emergency context exists.

# AGENTS.md

## Primary instruction for future AI agents

Before scanning the repository, always read `AI_INDEX.md` first.

Do not start by crawling the whole project. `AI_INDEX.md` is the navigation layer and points to the useful maps in `ai_docs/`. Read only the files relevant to your task.

## Project context

Product: **Ishonch Guard** is a free anti-scam assistant for Uzbekistan (Tashkent first, then nationwide). It helps people check suspicious phone calls, SMS/Telegram messages, Telegram usernames, links, APK files, screenshots and payment requests before they lose money. It also lets the community report scammers.

Current state: **working MVP** with a real codebase: TanStack Start + React 19 + Supabase + Telegram bot channel. Runtime is self-hosted Node SSR via Nitro `node-server` (Docker/Railway-ready). Lovable was used only for the initial UI design; it is not the production runtime.

## How future AI should work in this project

1. Read `AI_INDEX.md`.
2. Read only the relevant files in `ai_docs/`.
3. When source code changes, update `FILE_MAP.md`, `FUNCTIONS_MAP.md`, `DATABASE.md`, and `API.md` instead of rescanning everything.
4. Keep all docs short and useful. Do not paste full source code into AI memory files.
5. Record architecture decisions in `ai_docs/DECISIONS.md`.
6. Record AI-side doc changes in `ai_docs/CHANGELOG_AI.md`.

## Product safety rules (hard constraints)

- Never accuse a specific named person of being a scammer. Use risk labels: `safe`, `unknown`, `suspicious`, `high_risk`, plus `verified official`.
- Hash sensitive identifiers before storage (phones, Telegram handles, URLs, APK URLs) with `src/lib/risk/hash.ts`.
- Never store OTP codes, SMS confirmation codes, full card numbers, PINs, passwords or passport scans. Run `redactText` before persistence. Screenshots are OCR'd, redacted and discarded as images.
- User report descriptions can contain sensitive data too; redact them before DB insert.
- Every report flow stays anonymous-by-default and passes through admin moderation before an entity is publicly marked confirmed.
- AI explanations must be calm, factual, must not reveal personal data, and must end with one concrete safe action.

## Recommended AI reading order

1. `AI_INDEX.md`
2. `ai_docs/PROJECT_OVERVIEW.md`
3. `ai_docs/ARCHITECTURE.md`
4. `ai_docs/DATABASE.md`
5. `ai_docs/API.md`
6. `ai_docs/OPEN_TASKS.md`

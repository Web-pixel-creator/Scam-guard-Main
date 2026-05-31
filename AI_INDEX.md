# AI_INDEX.md

> **Entry point for any AI agent working on this project. Read this first. Do not crawl the whole repo.**

## What this project is (one line)

**Ishonch Guard** — a free, trilingual (RU/UZ/EN) anti-scam web app for Uzbekistan. Paste a phone number, Telegram username, link, APK or message text → get a risk score + plain-language steps. Users can also report scammers; admins moderate reports.

## Status

- Stage: **working MVP** (real codebase, deployed via Lovable Cloud).
- This is **not** a research stub — the code, DB schema and migrations are real and analyzed.
- Last AI memory update: 2026-05-30.

## Docs map — read only what you need

| File | Use it for |
|---|---|
| `AGENTS.md` | Rules for AI agents, safety constraints, reading order. |
| `ai_docs/PROJECT_OVERVIEW.md` | Product vision, users, market & competitor research. |
| `ai_docs/SCAM_COVERAGE.md` | Which scam categories we cover, how, and the hard limits. |
| `ai_docs/ARCHITECTURE.md` | Stack, data flow, risk engine, AI gateway. |
| `ai_docs/FILE_MAP.md` | Folder + key-file map. Where things live. |
| `ai_docs/FUNCTIONS_MAP.md` | Important functions, server fns, modules. |
| `ai_docs/DATABASE.md` | Tables, enums, RLS policies, RPCs, privacy notes. |
| `ai_docs/API.md` | Server functions (RPC), AI gateway, future B2B API. |
| `ai_docs/DEPLOYMENT.md` | Hosting, env vars, secrets, how to run. |
| `ai_docs/CODING_RULES.md` | Code, color, i18n, privacy & security rules. |
| `ai_docs/DECISIONS.md` | Decisions made and why. |
| `ai_docs/CHANGELOG_AI.md` | AI-side documentation change history. |
| `ai_docs/OPEN_TASKS.md` | Next tasks, fragile spots, unknowns. |

## How to work here

1. Read this file.
2. Read the 1–2 relevant `ai_docs/` files for your task.
3. When code changes, update `FILE_MAP.md` / `FUNCTIONS_MAP.md` / `DATABASE.md` / `API.md` — do not paste raw code dumps into memory.
4. Log decisions in `DECISIONS.md`, doc changes in `CHANGELOG_AI.md`.

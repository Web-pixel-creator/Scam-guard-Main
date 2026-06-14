# AI_INDEX.md

> Entry point for any AI agent working on this project. Read this first. Do not crawl the whole repo.

## What this project is

**Ishonch Guard** is a free trilingual (RU/UZ/EN) anti-scam assistant for Uzbekistan. Users paste or forward a phone number, Telegram username, link, APK URL, screenshot or suspicious text and get a risk score plus plain-language safety steps. Users can also report suspected scammers; admins moderate reports before public reputation is affected.

## Status

- Stage: **working MVP** with real code, DB migrations, tests and a Telegram bot channel.
- Runtime target: **self-hosted Node SSR** via Nitro `node-server`; Docker/Railway-ready. Lovable was used only to author the initial UI design.
- AI layer: **provider-neutral OpenAI-compatible Chat Completions** (`OPENAI_API_KEY`, optional `OPENAI_MODEL`, `OPENAI_BASE_URL`). If no key is present, scoring still works and explanations/OCR degrade to `null`.
- Last AI memory update: 2026-06-14.

## Docs map

| File                          | Use it for                                                         |
| ----------------------------- | ------------------------------------------------------------------ |
| `AGENTS.md`                   | Rules for AI agents, safety constraints, reading order.            |
| `ai_docs/PROJECT_OVERVIEW.md` | Product vision, users, market and competitors.                     |
| `ai_docs/SCAM_COVERAGE.md`    | Which scam categories we cover, limits, and research-feed notes.   |
| `ai_docs/ARCHITECTURE.md`     | Stack, data flow, risk engine, AI provider, Telegram channel.      |
| `ai_docs/FILE_MAP.md`         | Folder and key-file map.                                           |
| `ai_docs/FUNCTIONS_MAP.md`    | Important functions, server functions, modules.                    |
| `ai_docs/ROADMAP.md`          | Canonical product implementation order and "do not build yet" list. |
| `ai_docs/DATABASE.md`         | Tables, enums, RLS policies, RPCs, privacy notes.                  |
| `ai_docs/API.md`              | Server functions, webhook surface, AI integration, future B2B API. |
| `ai_docs/DEPLOYMENT.md`       | Hosting, env vars, secrets, how to run.                            |
| `ai_docs/ON_CALL_RUNBOOK.md`  | Production monitor alert triage and recovery steps.                |
| `ai_docs/CODING_RULES.md`     | Code, color, i18n, privacy and security rules.                     |
| `ai_docs/DECISIONS.md`        | Decisions made and why.                                            |
| `ai_docs/CHANGELOG_AI.md`     | AI-side documentation change history.                              |
| `ai_docs/OPEN_TASKS.md`       | Next tasks, fragile spots, unknowns.                               |

## How to work here

1. Read this file.
2. Read the 1-2 relevant `ai_docs/` files for your task.
3. When code changes, update `FILE_MAP.md`, `FUNCTIONS_MAP.md`, `DATABASE.md`, `API.md`, `DECISIONS.md` and `CHANGELOG_AI.md` as relevant.
4. Do not paste raw code dumps into docs. Keep AI memory short and navigable.

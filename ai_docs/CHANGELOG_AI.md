# Changelog (AI memory)

> Log of AI-side documentation changes. Newest first. This tracks the *memory files*, not app code.

## 2026-05-30 — Initial AI memory created
- Analyzed the real codebase (cloned from GitHub repo `Web-pixel-creator/scam-guard-ai-c7aaf580`, plus the supplied `scam-guard-ai-c7aaf580-main.zip`).
- Created `AI_INDEX.md`, `AGENTS.md`, and `ai_docs/`: `PROJECT_OVERVIEW`, `ARCHITECTURE`, `FILE_MAP`, `FUNCTIONS_MAP`, `DATABASE`, `API`, `DEPLOYMENT`, `CODING_RULES`, `DECISIONS`, `CHANGELOG_AI`, `OPEN_TASKS`.
- Mapped: TanStack Start + React 19 + Supabase stack, server-fn RPC layer, rules-first risk engine (`src/lib/risk/*`), DB schema + RLS (5 tables, 4 enums, 3 DB functions), AI gateway usage, auth/role model.
- Documented competitor/market research (ScamShield, 1Lookup, Truecaller, Hiya, Robokiller, Norton Genie, Bitdefender Scamio, etc.) and current UZ scam landscape with sources.
- Updated `AGENTS.md` so future AI reads `AI_INDEX.md` first instead of scanning the whole repo.

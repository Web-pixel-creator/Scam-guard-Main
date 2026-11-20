# Repository guide

Start with [current state](ai_docs/CURRENT_STATE.md) for the last verified release and [open tasks](ai_docs/OPEN_TASKS.md) for pending work. A file in the repository shows what is implemented at that revision, not what is running.

| Question                                  | Reference                                                                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| What does the product do?                 | [README](README.md), [product overview](ai_docs/PROJECT_OVERVIEW.md)                                                                                                           |
| Where is the code?                        | [Architecture](ai_docs/ARCHITECTURE.md), [file map](ai_docs/FILE_MAP.md), [database](ai_docs/DATABASE.md), [API](ai_docs/API.md)                                               |
| How should a risk check or report behave? | [Scam coverage](ai_docs/SCAM_COVERAGE.md), [Telegram contract](ai_docs/TELEGRAM_INTENT_CONTRACT.md), [moderation](ai_docs/MODERATION_GUIDELINES.md)                            |
| How do we verify a release?               | [Deployment](ai_docs/DEPLOYMENT.md), [on-call runbook](ai_docs/ON_CALL_RUNBOOK.md), [canary criteria](ai_docs/CANARY_72H.md), [recovery](ai_docs/RECOVERY_AND_KEY_ROTATION.md) |
| Why was a decision made?                  | [Decisions](ai_docs/DECISIONS.md), [documentation history](ai_docs/CHANGELOG_AI.md)                                                                                            |

Follow [project constraints](AGENTS.md). Use [documentation policy](ai_docs/DOCUMENTATION_POLICY.md) when records disagree; do not promote a dated observation, draft PR or local test to a production claim.

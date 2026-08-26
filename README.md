# Ishonch Guard

> Бесплатный RU/UZ/EN антискам-ассистент для Узбекистана: веб-приложение и
> Telegram-бот помогают проверить подозрительный текст, номер, ссылку,
> Telegram-аккаунт, QR-код, APK, скриншот или голосовое описание и предлагают
> конкретный безопасный следующий шаг.

[![CI](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/workflows/ci.yml/badge.svg)](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/workflows/ci.yml)
[![Security Gates](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/workflows/security.yml/badge.svg)](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

- Production: [scam-guard-main-production.up.railway.app](https://scam-guard-main-production.up.railway.app/)
- Telegram: [@scamguard_bot](https://t.me/scamguard_bot)
- Текущее состояние: [`ai_docs/CURRENT_STATE.md`](ai_docs/CURRENT_STATE.md)
- Открытые проверки и ограничения: [`ai_docs/OPEN_TASKS.md`](ai_docs/OPEN_TASKS.md)

## Статус проекта

Ishonch Guard — **production-deployed safety MVP и кандидат для контролируемого
пилота**. Это работающий продукт с реальным веб-интерфейсом, Telegram-каналом,
базой данных, административной модерацией и эксплуатационными процедурами. Мы
не называем его enterprise-ready, пока не завершены внешняя приёмка, независимое
измерение качества распознавания, legal/privacy review и оставшиеся
эксплуатационные проверки.

Проверенный снимок на 2026-08-26 (repository tip и runtime учитываются
раздельно):

| Параметр              | Подтверждённое состояние                                                                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub docs tip       | PR №138, commit `4380085d`; docs-only merge не заменил runtime                                                                                                                   |
| Production source     | PR №135, commit `a964153f`, tree `36d9d748`; application runtime не менялся с PR №129                                                                                            |
| Railway deployment    | `464f3bb8-45c8-4df9-9752-f8a9564a757f` — `SUCCESS`, `/healthz` возвращает `200 ok`                                                                                               |
| Автоматические тесты  | Deployed gate: 179 Vitest-файлов, 15 327/15 327; полный CI и coverage прошли                                                                                                     |
| CI/security           | TypeScript, lint, build, coverage, migrations, pgTAP, CodeQL, Gitleaks, Trivy и SBOM прошли                                                                                      |
| Telegram transport    | Durable single-leader polling в production; webhook остаётся совместимым fail-closed режимом                                                                                     |
| AI в плановом monitor | Отключён политикой; scheduled monitor не получает AI-ключи и не делает provider-запросы                                                                                          |
| Формальная приёмка    | Окно №3 `OPEN`: нужны ≥72 часа **и** ≥144 eligible success; окно №1 имеет operational GO, но formal `OPEN/exception pending`; device/a11y/legal и real-client матрица не закрыты |

Текущие идентификаторы, границы доказательств и оставшиеся проверки записаны в
[`CURRENT_STATE.md`](ai_docs/CURRENT_STATE.md) и
[`CANARY_72H.md`](ai_docs/CANARY_72H.md). Датированный release-файл за 8 августа
остаётся исторической записью PR №121.
Цифры из более старых датированных отчётов являются историческими снимками, а
не текущим статусом.

Railway Watch Paths (`**`, `!/*.md`, `!/ai_docs/**`) слиты в составе PR №129 и
подтверждены шестью docs-only записями `SKIPPED`. Документационные merge больше не
запускают build и не создают новый образ или активный non-SKIPPED deployment:
Railway создаёт только placeholder-запись `SKIPPED`. Docs-коммиты проходят
полный GitHub CI, но не меняют runtime и не перезапускают canary-окно. SHA
документации и production source учитываются раздельно; любой merge с кодом или
конфигурацией по-прежнему создаёт новый deployment и открывает новое
canary-окно.

Workflow-файлы backup смержены, но backup сейчас **NOT ENABLED / NOT
VERIFIED**: нет успешных запусков, restore-drill и артефактов, обязательные
секреты отсутствуют. Sole-owner ruleset с нулём approvals не разрешает их
добавление: сначала нужен независимый обязательный review или защищённое
environment с ручным approval. PR №137 также не является готовым релизом: он
остаётся `DRAFT/HOLD` и не задеплоен. Его финальный candidate `e4db0135`
полностью перепроверен локально, GitHub CI 7/7; ещё нужны решение владельца и
явный перезапуск canary при merge.

## Что уже работает

- Direct, Reply и Inline-проверки в Telegram с автоматическим выбором RU/UZ/EN.
- Проверка текста, телефона, Telegram username, URL, APK, QR, скриншота и
  короткого голосового описания.
- Контекстные follow-up ответы, SOS/aftercare-сценарии и пошаговые безопасные
  действия после высокого риска.
- Защита OTP, PIN, CVV, паролей и seed phrase от эха и небезопасного хранения.
- Официальный справочник контактов с предупреждением о подмене caller ID.
- Family Shield с согласием, TTL и возможностью отключения доверенного контакта.
- Модерируемые жалобы, подтверждённая репутация и отдельный appeal-процесс.
- Админ-панель с Supabase Auth, AAL2/TOTP MFA и RLS.
- Privacy-safe embed, агрегированные scam trends и ограниченная телеметрия без
  сырого проверяемого содержимого.
- Деградация без AI: базовый verdict и безопасные шаги продолжают работать.

## Почему ядро не заменено одной LLM

В кризисном продукте свободный ответ модели не должен единолично решать, что
опасно, что безопасно и какое экстренное действие показать пользователю.
Текущий risk verdict строится детерминированно из нормализованных сигналов,
reason codes, проверенных официальных контактов и модерируемой репутации. AI
может дать дополнительное объяснение, но не меняет уровень риска.

Это осознанный проверяемый safety baseline, а не утверждение, что ручные правила
понимают любую живую речь. У проекта остаются известные пробелы в разговорных
формулировках, опечатках и состоянии действия («просят» против «уже сделал»).
Следующий возможный этап — гибридный классификатор, но только после независимого
holdout-набора, privacy review и shadow-проверки. Inline остаётся
детерминированным и не использует платный AI.

## Как проходит проверка

```text
Ввод пользователя
      │
      ▼
Нормализация, определение языка и preflight секретов
      │
      ▼
Детерминированные правила + reputation / official-contact signals
      │
      ▼
Уровень риска + reason codes + конкретный безопасный шаг
      │
      ├── optional AI explanation (не меняет verdict)
      ▼
Ответ в Web / Telegram Direct / Reply / Inline
```

## Приватность и честные границы

- Секреты и чувствительные идентификаторы маскируются до persistence и AI.
- Сырые скриншоты не сохраняются в Storage или базе; после обработки они
  отбрасываются.
- Если OCR/STT/vision-провайдер настроен, медиа может быть передано этому
  провайдеру для обработки. «Не сохраняется нами» не означает «никогда не
  покидает сервер».
- Жалоба не создаёт публичное обвинение автоматически: требуется модерация.
- Отсутствие жалоб не является доказательством безопасности.
- Exactly-once Telegram delivery не заявляется: Bot API не предоставляет
  прикладной idempotency key. Реализованы bounded retry, durable lifecycle и
  защита от повторов в проверяемых границах.

Подробнее: [`ai_docs/ARCHITECTURE.md`](ai_docs/ARCHITECTURE.md),
[`ai_docs/DATABASE.md`](ai_docs/DATABASE.md) и
[`ai_docs/MODERATION_GUIDELINES.md`](ai_docs/MODERATION_GUIDELINES.md).

## Технологии

- React 19, TanStack Start, TypeScript, Tailwind CSS.
- Nitro `node-server`, Docker и Railway.
- Supabase PostgreSQL, Auth, RLS и migrations.
- Telegram Bot API: polling в текущем production и совместимый webhook-контур.
- Vitest, fast-check и pgTAP.
- Опциональные OpenAI-compatible explanation/STT/TTS и vision paths.

## Локальный запуск

```bash
git clone https://github.com/Web-pixel-creator/Scam-guard-Main.git
cd Scam-guard-Main

bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

Минимальные локальные проверки:

```bash
bun run test:run
bunx tsc --noEmit
bun run lint
bun run build
```

Для production/staging используйте только проверенные процедуры из
[`ai_docs/DEPLOYMENT.md`](ai_docs/DEPLOYMENT.md). Не копируйте production-секреты
в локальные команды, issue, PR или отчёты.

## Документация

Документы имеют явный порядок доверия:

1. [`ai_docs/CURRENT_STATE.md`](ai_docs/CURRENT_STATE.md) — канонический
   подтверждённый baseline.
2. [`ai_docs/OPEN_TASKS.md`](ai_docs/OPEN_TASKS.md) — актуальные открытые
   проверки и следующий порядок работ.
3. [`ai_docs/PROJECT_OVERVIEW.md`](ai_docs/PROJECT_OVERVIEW.md) — продуктовый
   контекст, а не release status.
4. Датированные планы, аудиты и release evidence — исторические снимки. Старые
   commit id, test totals и чекбоксы нельзя переносить в текущую оценку без
   сверки с `CURRENT_STATE.md`.

Политика актуальности: [`ai_docs/DOCUMENTATION_POLICY.md`](ai_docs/DOCUMENTATION_POLICY.md).
Навигация для AI-агентов: [`AI_INDEX.md`](AI_INDEX.md).

## Участие в разработке

См. [`CONTRIBUTING.md`](CONTRIBUTING.md). Изменения должны сохранять RU/UZ/EN,
privacy/redaction, безопасные risk labels и проходить CI. Нельзя добавлять
публичные обвинения, хранение секретов или AI-side effects без отдельного
safety/privacy review.

## Лицензия

[MIT](LICENSE)

---

**Ishonch** по-узбекски означает «доверие». Цель проекта — не обещать
безошибочность, а дать человеку проверяемый сигнал риска и безопасное действие
до или сразу после мошеннического давления.

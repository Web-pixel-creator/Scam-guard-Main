# Implementation Plan: Telegram Bot MVP (Ishonch Guard)

> Current implementation note (2026-06-01): all listed MVP tasks are complete in
> `main`. Follow-up work lives in `ai_docs/OPEN_TASKS.md`.

## Overview

План реализует Telegram-бота как **новый канал** к существующему веб-приложению, переиспользуя risk engine (`src/lib/risk/*`) и серверные конвейеры через **вынесенное общее ядро** `check-core.ts`. Принцип «scoring правилами, AI только объясняет» сохраняется без изменений.

Порядок: сначала транспортно-независимое ядро и чистые модули (`check-core`, новые reason codes, session store, Telegram API helper, форматтер) с тестами, затем эффектный слой (роутер, обработчики, webhook) поверх них. Чистая логика покрывается property-тестами (fast-check, ≥100 прогонов, тег `// Feature: telegram-bot-mvp, Property {n}`), эффектный слой — unit/интеграционными тестами с моками (`fetch` Telegram/AI, `supabaseAdmin`).

Источник правды — `requirements.md` (22 требования) и `design.md` (10 correctness properties) этой папки. Существующий веб-контракт (`checkInput`/`ocrExtract` с ключом `check:<ip>`, лимит 10/мин) сохраняется без изменений поведения.

## Tasks

- [x] 1. Настройка тестов, миграции БД и серверных секретов
  - [x] 1.1 Добавить и настроить Vitest + fast-check
    - Добавить `vitest` и `fast-check` в devDependencies (сейчас их нет в `package.json`)
    - Создать `vitest.config.ts` (node-окружение для серверной логики, резолв алиасов через `vite-tsconfig-paths`) и минимальный setup-файл
    - Добавить скрипты `"test": "vitest"` и `"test:run": "vitest run"` в `package.json`
    - _Requirements: поддерживает Testing Strategy для всех последующих задач_

  - [x] 1.2 Создать таблицу `telegram_sessions` (Supabase, service-role)
    - Добавить SQL-миграцию в `supabase/migrations/*` строго по дизайну: `telegram_user_id BIGINT PK`, `lang TEXT DEFAULT 'ru'`, `scenario TEXT DEFAULT 'none'`, `scenario_step INT DEFAULT 0`, `scenario_data JSONB DEFAULT '{}'`, `updated_at TIMESTAMPTZ DEFAULT now()`; индекс по `updated_at`; `ENABLE ROW LEVEL SECURITY`; политика, запрещающая доступ `anon`/`authenticated`; функция `prune_telegram_sessions()`
    - Регенерировать `src/integrations/supabase/types.ts` после применения (не редактировать руками)
    - _Requirements: 15.1, 15.2, 17.3_

  - [x] 1.3 Добавить серверные переменные окружения бота
    - Добавить чтение `TELEGRAM_BOT_TOKEN` и `TELEGRAM_WEBHOOK_SECRET` **внутри хендлеров** (per-request, CODING_RULES §6), не на уровне модуля; `OPENAI_API_KEY` и Supabase-секреты уже есть
    - Задокументировать переменные в `.env.example` без реальных значений; не помещать секреты в `VITE_*` или клиентский bundle
    - _Requirements: 17.1, 17.2, 17.4_

- [x] 2. Вынести общее ядро проверки `check-core.ts`
  - [x] 2.1 Реализовать `runCheck` и `ocrExtractCore`
    - Создать `src/lib/risk/check-core.ts`: перенести тело `checkInput.handler` в `runCheck(params)` (принимает готовый `rateLimitKey`, опц. `channel`, `skipAi`), перенести `aiExplain`/`ocrScreenshot` в ядро (или соседний `ai.server.ts`); сохранить контракт `RunCheckResult` и `RateLimitedError`
    - Превратить `checkInput`/`ocrExtract` в тонкие обёртки: веб извлекает IP → строит `check:<ip>` → вызывает ядро; scoring и запись в `checks` (redacted + hashed) не меняются
    - _Requirements: 4.2, 4.3, 7.1, 7.2, 7.3, 7.4, 13.5, 18.3_

  - [x]\* 2.2 Property-тесты ядра: детерминизм и приватность
    - **Property 1: Детерминизм scoring, независимость от AI** — `runCheck(skipAi:true)` и с AI дают одинаковые `level/score/reasons` (AI/сеть мокаются)
    - **Property 2: Sensitive_Data никогда не попадает в БД в сыром виде** — в `checks.insert` уходит только `maskForDisplay`/`input_hash`, без сырых цифр
    - **Validates: Requirements 4.2, 7.1, 7.2, 7.3, 13.5**

  - [x]\* 2.3 Unit-тест: веб-контракт `checkInput` не изменился
    - Проверить, что ключ rate-limit остался `check:<ip>` и формат ответа идентичен дорефакторному
    - _Requirements: 4.2_

- [x] 3. Расширить `rules.ts` новыми reason codes (локальные сценарии)
  - [x] 3.1 Добавить 4 reason codes без поломки порогов
    - В `src/lib/risk/rules.ts` добавить в union, `WEIGHTS`, `PATTERNS` (RU **и** UZ Latin) и `REASON_LABELS` (ru/uz/en) коды `asks_to_scan_qr` (вес 50), `relative_in_distress` (30), `requests_card_digits` (45), `threatens_account_block` (20); при необходимости усилить `ADVICE` поведенческими советами; пороги `scoreFromCodes` (≥50 high_risk, ≥20 suspicious) не менять; зафиксировать решение в `DECISIONS.md`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_

  - [x]\* 3.2 Property-тесты правил
    - **Property 6: `asks_to_scan_qr` всегда даёт high_risk** — любой набор кодов, содержащий его, → `level == "high_risk"`
    - **Property 10: Сохранение порогов при добавлении reason codes** — для наборов без новых четырёх кодов вердикт идентичен дорефакторному
    - **Validates: Requirements 14.1, 14.4, 4.2**

  - [x]\* 3.3 Unit-тесты regex новых кодов (RU/UZ, позитив/негатив)
    - По несколько позитивных и негативных примеров на каждый из 4 кодов на русском и узбекском (латиница)
    - _Requirements: 14.4, 14.5, 14.6, 14.7_

- [x] 4. Реализовать session store `session.server.ts`
  - [x] 4.1 Реализовать загрузку/сохранение сессии
    - Создать `src/lib/telegram/session.server.ts` поверх `telegram_sessions` через `supabaseAdmin`: `loadSession` (дефолт `{ lang:"ru", scenario:"none" }` при отсутствии), `saveSession` (upsert, возвращает `{ ok }`), `setLanguage` (возвращает `{ ok }`, при сбое язык не меняется), `resetScenario`
    - _Requirements: 1.4, 2.2, 2.3, 15.1, 15.2, 15.5_

  - [x]\* 4.2 Unit/интеграционные тесты сессии (мок `supabaseAdmin`)
    - Дефолт `ru` при отсутствии строки; upsert по `telegram_user_id`; `setLanguage` возвращает `ok:false` при ошибке записи и сохраняет прежний язык
    - _Requirements: 1.4, 2.3, 15.2_

- [x] 5. Реализовать Telegram API helper `api.server.ts`
  - [x] 5.1 Реализовать обёртку Bot API и `escapeMarkdownV2`
    - Создать `src/lib/telegram/api.server.ts`: `sendMessage` (MarkdownV2), `sendChatAction("typing")`, `answerCallbackQuery`, `getFile`, `downloadFileAsDataUrl` (скачивание **только в память**, проверка лимита 6 МБ до скачивания, без записи на диск), `setWebhook`, `escapeMarkdownV2`; токен читать внутри функций
    - _Requirements: 5.3, 5.5, 17.1, 17.2, 18.2, 19.3_

  - [x]\* 5.2 Property-тест MarkdownV2-безопасности
    - **Property 8: MarkdownV2-безопасность** — `escapeMarkdownV2` экранирует все спецсимволы и идемпотентен относительно их набора
    - **Validates: Requirements 4.4, 7.5**

  - [x]\* 5.3 Unit-тесты `getFile`/`downloadFileAsDataUrl` (мок `fetch`)
    - Файл > 6 МБ не скачивается и отклоняется; валидный файл → data URL в памяти; форма запросов к Bot API
    - _Requirements: 5.3, 5.5_

- [x] 6. Реализовать bot-i18n и форматтер ответа
  - [x] 6.1 Добавить трилингвальные строки бота
    - В `src/lib/telegram/bot-i18n.ts` (форма `{ ru, uz, en }`) добавить строки: приветствие, подсказки шагов, `/help`, `/safety`, чек-лист `/emergency`, сообщения об ошибках/лимите/вне-объёма; каждая строка обязана иметь все три языка
    - _Requirements: 1.3, 2.4, 3.1, 3.2, 3.3, 16.1, 16.2, 20.2_

  - [x] 6.2 Реализовать `format.ts`
    - Создать `src/lib/telegram/format.ts`: `RISK_EMOJI`, `formatCheckResult` (эмодзи+метка уровня, блок объяснения только при `explanation!==null`, `REASON_LABELS`, всегда `ADVICE`, строка `knownReports>0`, кнопки Report/Check another, при `high_risk` доп. кнопка Emergency, только `display` — без сырых данных), `formatEmergencyChecklist`, `formatHelp`, `formatSafety`, `formatWelcome`
    - _Requirements: 4.4, 4.5, 4.6, 4.11, 7.5, 8.1, 8.3, 13.1, 13.2, 13.3, 20.1, 20.3_

  - [x]\* 6.3 Тесты форматтера
    - **Property 5: Ответ всегда содержит ADVICE даже при недоступном AI** — текст всегда содержит непустой `ADVICE[level][lang]`
    - Unit: блок объяснения отсутствует при `explanation=null`; кнопка Emergency только при `high_risk`; строка `knownReports` только при `>0`
    - **Validates: Requirements 13.1, 13.2, 13.3, 4.11, 20.3**

- [x] 7. Чекпоинт — ядро, helpers и форматтер
  - Прогнать все тесты, при вопросах обратиться к пользователю.

- [x] 8. Реализовать роутер обновлений и обработчики
  - [x] 8.1 Реализовать `router.ts` (диспетчер + `parseCommand`)
    - Создать `src/lib/telegram/router.ts`: `dispatchUpdate`, `parseCommand` (команда + аргумент, учёт `@botusername`), приоритет callback > команда > активный сценарий > контент; команда прерывает активный сценарий; forward → текст как обычный ввод; `HandlerCtx` с загруженной `Session`
    - _Requirements: 4.7, 4.8, 4.9, 11.1, 11.2, 11.5, 15.3, 15.4_

  - [x] 8.2 Реализовать командные обработчики (`commands`)
    - `handleCommand` для `/start` (приветствие + кнопки языка), `/lang`, `/help`, `/safety`, `/emergency`; тексты из bot-i18n/форматтера на текущем языке
    - _Requirements: 1.1, 1.3, 1.5, 2.1, 3.1, 3.2, 3.3, 20.1, 20.2, 20.5_

  - [x] 8.3 Реализовать обработчики проверки (`check`)
    - `handleCheck` (текст + forward → `runCheck` с `rateLimitKey="tg:"+userId`, обрезка/отклонение >2000 символов, индикатор «typing» при >3с), `handleImage` (скачивание в память → `ocrExtractCore` → `runCheck`, без сохранения изображения, отказ при `null`/>6 МБ, обработка нескольких фото — одно за раз), `handlePhoneFromContact` (номер из `contact` → `runCheck` type `phone`, имя не сохранять, при пустом номере — подсказка)
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6, 4.7, 4.10, 4.11, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.1, 10.3, 11.3, 11.5, 16.3, 18.1, 18.2, 21.1, 21.2, 21.3, 21.4_

  - [x] 8.4 Реализовать сценарий жалобы (`report`)
    - `handleScenarioStep` для многошагового `/report`: value → description → опциональные (scamType/city/amount, пропускаемые) → `submitReport`; валидация (описание 5..5000, значение ≤500); сохранение `telegram_sessions` на каждом шаге; подтверждение «публично только после модерации»; обработка ошибки `submitReport`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 9.1, 9.2, 9.3, 15.2, 15.5_

  - [x] 8.5 Реализовать callback- и fallback-обработчики (`misc`)
    - `handleCallback` (выбор языка, кнопки Report/Check another/Emergency, `answerCallbackQuery`), `handleOutOfScope` (пустой/стикер/гео → подсказка; голос/аудио/видео → вежливый отказ вне объёма; неизвестная команда → `/help`)
    - _Requirements: 2.2, 2.3, 16.1, 16.2, 22.1, 22.2, 22.3_

  - [x] 8.6 Property-тест ключа rate-limit
    - **Property 4: Rate-limit ключ бота всегда основан на telegram_user_id** — для любого update ключ == `"tg:"+from.id`, не зависит от IP/Chat-заголовков
    - **Validates: Requirements 10.1, 10.3**

  - [x] 8.7 Property-тест эквивалентности контакт-карты
    - **Property 9: Контакт-карта эквивалентна телефону** — `handlePhoneFromContact(phone)` совпадает по `{level,score,reasons}` с `runCheck(phone, type="phone")`
    - **Validates: Requirements 21.1, 21.2**

  - [x] 8.8 Unit-тесты роутера
    - Приоритет callback > команда > шаг сценария > контент; прерывание сценария командой (15.4); forward как текст (11.5); `parseCommand` с `@botusername` и `/check текст`
    - _Requirements: 4.7, 4.9, 11.5, 15.3, 15.4_

  - [x] 8.9 Интеграционный тест сценария жалобы
    - Многошаговый ввод (value → desc → optional) с сохранением `telegram_sessions` на каждом шаге; прерывание командой; успешный `submitReport` → `entities.moderation_status='new'`
    - _Requirements: 6.4, 6.7, 9.1, 15.2_

- [x] 9. Реализовать webhook route и интеграцию
  - [x] 9.1 Реализовать `webhook.ts` (server route)
    - Создать `src/server.ts + src/lib/telegram/webhook.server.ts` (`POST /api/telegram/webhook`): сверка `X-Telegram-Bot-Api-Secret-Token` **первой**, до валидации структуры (401 при отсутствии/несовпадении и при отсутствии секретов конфигурации); zod-валидация `telegramUpdateSchema` только после токена (невалидная структура → 200, игнор); `dispatchUpdate` в работу; processing error после валидного токена → лог без Sensitive_Data + 200
    - _Requirements: 11.3, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 17.4, 19.1, 19.2_

  - [x]\* 9.2 Property-тесты контракта webhook
    - **Property 3: Webhook без валидного токена не обрабатывает update и не валидирует структуру** — `status==401`, `dispatchUpdate` не вызван, парсинг не выполнялся
    - **Property 7: Webhook после валидного токена и валидной структуры всегда отвечает 200** — даже при броске внутри `dispatchUpdate`
    - **Validates: Requirements 12.1, 12.2, 12.4, 12.5**

  - [x]\* 9.3 Интеграционные тесты webhook end-to-end (моки Telegram API + `supabaseAdmin`)
    - Неверный токен → 401, `dispatchUpdate` не вызван; валидный токен + текст → 200 + один `sendMessage` с корректным уровнем; бросок в обработчике → 200; фото → `getFile`+`downloadFileAsDataUrl` (в память) → OCR → check, файл не сохраняется
    - _Requirements: 5.3, 12.2, 12.4, 12.5_

  - [x]\* 9.4 Интеграционный тест деградации AI
    - Без `OPENAI_API_KEY` ответ содержит Risk_Level + reasons + ADVICE без блока объяснения; scoring через `scoreFromCodes`
    - _Requirements: 13.1, 13.2, 13.3, 13.5, 18.3_

- [x] 10. Развёртывание webhook
  - [x] 10.1 Утилита регистрации webhook + инструкции
    - Одноразовый админ-скрипт, вызывающий `setWebhook(<публичный URL>/api/telegram/webhook, TELEGRAM_WEBHOOK_SECRET)`; задокументировать шаги (миграция → секреты в окружении → setWebhook → проверка отсутствия секретов в логах/клиенте) в `ai_docs/DEPLOYMENT.md`
    - _Requirements: 12.1, 17.1, 17.2_

- [x] 11. Финальный чекпоинт
  - Прогнать все тесты, при вопросах обратиться к пользователю.

## Notes

- Подзадачи с `*` — опциональные тесты; основные реализационные подзадачи не опциональны.
- Каждое свойство реализуется одним fast-check тестом (≥100 прогонов, `fc.assert(..., { numRuns: 100 })`) с тегом `// Feature: telegram-bot-mvp, Property {n}`.
- Внешние вызовы в тестах мокаются: Telegram Bot API (`fetch`), OpenAI-compatible AI provider (`fetch`), `supabaseAdmin`. Секреты в тестах — фиктивные значения через окружение.
- Рефакторинг `check-core.ts` сохраняет поведение веба без изменений (ключ `check:<ip>`, лимит 10/мин, формат ответа).
- Покрытие 10 design-свойств: 1→2.2, 2→2.2, 3→9.2, 4→8.6, 5→6.3, 6→3.2, 7→9.2, 8→5.2, 9→8.7, 10→3.2.
- `rate-limit.ts` читает `Date.now()` и держит модульный `buckets`; тесты, зависящие от окна, используют `vi.useFakeTimers()` и сбрасывают модульное состояние.
- Новые строки i18n обязаны иметь ru/uz/en; `*.server.ts` и секреты никогда не импортируются в клиент.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "3.1", "4.1", "5.1", "6.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "3.3", "4.2", "5.2", "5.3", "6.2"] },
    { "id": 3, "tasks": ["6.3", "8.1"] },
    { "id": 4, "tasks": ["8.2", "8.3", "8.4", "8.5"] },
    { "id": 5, "tasks": ["8.6", "8.7", "8.8", "8.9", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4", "10.1"] }
  ]
}
```

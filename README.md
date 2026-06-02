# 🛡️ Ishonch Guard

> Бесплатный антискам-ассистент для Узбекистана. Проверяет номера, ссылки, Telegram-аккаунты, скриншоты и подозрительные сообщения — выдаёт уровень риска за секунды.

[![CI](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/workflows/ci.yml/badge.svg)](https://github.com/Web-pixel-creator/Scam-guard-Main/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Проблема

В Узбекистане ежедневно тысячи людей теряют деньги из-за телефонных и интернет-мошенников. Нет единого бесплатного инструмента, который бы мгновенно оценивал подозрительный номер или сообщение и говорил «это, скорее всего, скам» — прежде чем человек переведёт деньги.

## Решение

**Ishonch Guard** — открытая платформа (веб + Telegram-бот), которая:

- 🔍 **Проверяет** номера, ссылки, Telegram-юзернеймы, скриншоты (OCR) и текстовые сообщения
- ⚖️ **Оценивает риск** по правилам (детерминированно, без «галлюцинаций» AI)
- 🤖 **Объясняет** почему подозрительно — через AI (опционально; при недоступности AI работает и без него)
- 📢 **Принимает жалобы** на мошенников (модерируемая база)
- 🌐 **Трёхъязычный**: русский, узбекский (латиница), английский
- 🔒 **Приватный**: хранит только хешированные/замаскированные данные, скриншоты не сохраняет

## Каналы

| Канал | Статус |
|-------|--------|
| Веб-приложение (SSR) | ✅ Реализовано |
| Telegram-бот [@scamguard_bot](https://t.me/scamguard_bot) | ✅ Реализовано |

## Как это работает

```
Ввод пользователя (номер / ссылка / скриншот / текст)
        │
        ▼
  [ Определение типа ] → [ Нормализация + маскирование ]
        │
        ▼
  [ Правила (rules.ts) ] → reason codes + score
        │
        ▼
  [ Пороги: ≥50 = high_risk, ≥20 = suspicious ]
        │
        ▼
  [ AI объяснение (опционально) ] → human-readable текст
        │
        ▼
  [ Форматирование + ответ пользователю ]
```

Ключевой принцип: **scoring правилами — AI только объясняет**. Вердикт детерминирован и не зависит от доступности AI.

## Стек

- **Frontend**: React 19, TanStack Start v1, Tailwind v4
- **Backend**: Nitro v3 (node-server), TypeScript, Server Functions
- **БД**: Supabase (PostgreSQL + Auth + RLS)
- **AI**: OpenAI-compatible API (опционально; любой провайдер)
- **Telegram**: Bot API + Webhook
- **Тесты**: Vitest + fast-check (property-based), 193 теста
- **CI/CD**: GitHub Actions
- **Deploy**: Docker / Railway-ready

## Быстрый старт (локально)

```bash
# Клонируй
git clone https://github.com/Web-pixel-creator/Scam-guard-Main.git
cd Scam-guard-Main

# Установи зависимости (Bun — основной, npm тоже работает)
bun install

# Скопируй и заполни .env
cp .env.example .env
# Заполни SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
# (остальное опционально для локальной разработки)

# Запусти dev-сервер
bun run dev

# Тесты
bun run test:run

# Production build
bun run build
bun run start   # → http://localhost:3000
```

## Структура проекта

```
src/
├── routes/          # Страницы (file-based routing)
├── components/      # React-компоненты
├── lib/
│   ├── risk/        # Risk engine (rules, check-core, detect, hash)
│   ├── telegram/    # Telegram-бот (router, handlers, format, i18n)
│   ├── *.functions.ts  # Server functions (RPC)
│   └── config.server.ts
├── integrations/    # Supabase client
└── server.ts        # Entry: /healthz + webhook + SSR
```

## Переменные окружения

См. [`.env.example`](.env.example) — полный список с комментариями.

## Деплой

См. [`ai_docs/DEPLOYMENT.md`](ai_docs/DEPLOYMENT.md) — пошаговая инструкция для Docker / Railway.

## Тестирование

```bash
bun run test:run     # Vitest (193 теста, включая property-based)
bunx tsc --noEmit    # Type check
bun run build        # Production build
```

10 correctness properties покрывают: детерминизм scoring, приватность (хеширование), безопасность MarkdownV2, rate-limit по telegram_user_id, webhook-контракт (token-first), деградацию AI и другие критические свойства.

## Вклад в проект

Contributions welcome! См. [CONTRIBUTING.md](CONTRIBUTING.md).

Основные правила:
- Тесты обязательны для нового функционала
- CI должен быть зелёным
- Секреты — только в env, никогда в коде
- i18n: каждая строка — ru + uz + en

## Лицензия

[MIT](LICENSE)

---

> **Ishonch** (узб.) — доверие. Мы помогаем людям проверять, кому можно доверять.

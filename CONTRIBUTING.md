# Contributing to Ishonch Guard

Спасибо за интерес к проекту! Ishonch Guard — открытый антискам-инструмент для Узбекистана, и мы рады любому вкладу.

## Как начать

1. Fork репозитория
2. Клонируй свой fork: `git clone https://github.com/YOUR_USERNAME/Scam-guard-Main.git`
3. Установи зависимости: `bun install`
4. Создай feature-ветку: `git checkout -b feat/my-feature`
5. Внеси изменения
6. Прогони проверки: `bunx tsc --noEmit && bun run test:run && bun run build`
7. Закоммить и запуш: `git push origin feat/my-feature`
8. Открой Pull Request в `main`

## Правила

- **CI должен быть зелёным** — PR не мержится без прохождения type-check + tests + build.
- **Тесты обязательны** для нового функционала и багфиксов.
- **i18n** — каждая пользовательская строка обязана иметь все три языка: ru, uz, en.
- **Секреты** — никогда в коде. Только через `process.env` внутри серверных функций.
- **Приватность** — хешируем/маскируем перед записью. Скриншоты не сохраняем.
- **`*.server.ts`** — серверные модули не импортируются в клиентский bundle.

## Что можно улучшить

Смотри [`ai_docs/OPEN_TASKS.md`](ai_docs/OPEN_TASKS.md) — актуальный backlog задач.

Области, где особенно нужна помощь:

- Новые scam-паттерны (regex для RU и UZ Latin) — `src/lib/risk/rules.ts`
- Перевод на узбекский (проверка существующих строк)
- UI/UX улучшения
- Документация

## Code Style

- TypeScript strict mode
- Prettier + ESLint (запусти `bun run format && bun run lint`)
- Именование: kebab-case для файлов, camelCase для переменных/функций

## Вопросы?

Открой Issue или напиши в Discussions.

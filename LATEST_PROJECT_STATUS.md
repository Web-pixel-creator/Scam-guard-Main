# Ishonch Guard — что выполнено за последнее время

Обновлено: **2026-08-28** (post-rotation read-back).
Период сводки: примерно последние 30 дней.

Этот файл — короткая точка входа для владельца проекта, разработчика или
аудитора. Здесь отделены:

- факты, уже находящиеся в production;
- проверенные локальные изменения, которые ещё не опубликованы;
- задачи, которые действительно остаются открытыми;
- старые документы и фидбеки, которые больше нельзя считать текущим статусом.

## Короткий статус

- Стадия проекта: **production-deployed safety MVP / кандидат для ограниченного
  пилота**. Это уже работающий продукт, но не доказанная массовым использованием
  и независимой приёмкой enterprise-система.
- GitHub `main` и deployed runtime: PR
  [№141](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/141), commit
  `b36c453a08b3afd05c6e623d938e15dfc5b6084c`.
- Railway production deployment:
  `311997d0-2c1a-4428-88a0-d8be1308f679`, статус `SUCCESS`.
- Railway image digest:
  `sha256:8250a9a2edc1b7b0b451fc9fb274cb1e9c986b753cbc2f4a7db501f1a2b3651c`.
- Публичное приложение:
  [scam-guard-main-production.up.railway.app](https://scam-guard-main-production.up.railway.app/).
- PR №141 прошёл все **7/7 GitHub CI/Security jobs**. После ротации no-AI
  production smoke, полный security smoke и `/healthz=200` прошли; свежие
  error/warn логи — `0/0`.
- Railway watch patterns активны: за проверенный период зафиксировано 3
  non-SKIPPED deployment entries и 6 docs-only placeholder deployments со
  статусом `SKIPPED`; шесть docs merges не меняли runtime.
- Workflow-файлы зашифрованного backup смержены (№133), но operational status
  — **NOT ENABLED / NOT VERIFIED**: 0 backup runs, 0 restore-drill runs,
  0 artifacts, обязательные backup credentials отсутствуют. Их нельзя добавлять
  до security/Supabase portability review и отдельного credential gate:
  independent trusted reviewer + CODEOWNERS + ≥1 approval/dismiss-stale либо
  protected environment с ручным approval. Изменение credentials перезапускает
  canary.
- Supabase production: **33 миграции**, head `20260729131000`; AAL2 RLS и
  retention истёкших Family Shield claims применены.
- Canary PR №128 имеет **operational GO**: 188/188 eligible scheduled runs плюс
  финальные production/security/web-P1 проверки. Formal closure остаётся
  `OPEN / exception pending`: обязательный polling-dialogue smoke был skipped,
  а AI-probe evidence не содержит требуемых approval/run-id/request-count/budget.
- Окно №2 (PR №129) прошло 18/18 чисто и было заменено ускорением. Окно №3
  (PR №135) затем superseded изменением runtime в PR №141 и production-secret
  cutover. **Активного формального canary сейчас нет**; новый baseline стартует
  только после решения по deploy-eligible PR №137, PR №140 и Railway-IaC.
- Hash-pepper rotation завершена по трём слотам: active `v3`, previous `v2`,
  legacy read slot сохранён. Telegram token/webhook синхронизированы между
  Railway и GitHub; старый token возвращает `401`, новый принадлежит
  `@scamguard_bot`. Значения секретов нигде в отчёте не записаны.

## Что опубликовано в production за последнее время

### 1. Telegram Direct, Reply и Inline RU/UZ/EN

- Ответ теперь выбирает язык преимущественно по самому сообщению, а не только по
  языку профиля Telegram.
- Улучшена поддержка русского, узбекского латиницей, узбекской кириллицы и
  английского языка.
- Исправлена обработка многострочного Inline-запроса: вторая и третья строки
  входят в контекст и могут менять результат.
- Reply и follow-up сохраняют тему предыдущего сообщения. Вопросы вроде
  «почему?», «что делать дальше?», «что им сказать?» и «как связаться с банком?»
  не должны запускать случайную новую проверку.
- Inline preview и вставляемый результат сохраняют конкретный scam-сценарий и
  безопасный следующий шаг.
- Inline остаётся stateless и non-persistent: он не создаёт Telegram session,
  не записывает обычную проверку в базу и не вызывает платный AI во время ввода.
- Усилены callback-кнопки, report/appeal routing, chat scope и защита от
  повторного или чужого callback.
- Report callback binding проверяет message, action, scenario и chat, имеет TTL
  20 минут и fail-closed поведение для malformed, future и expired state.

### 2. Сценарии мошенничества и действия после инцидента

Добавлена или усилена конкретная маршрутизация для следующих семейств:

- bank/police/government impersonation;
- «безопасный счёт» и требование скрыть перевод от банка;
- уже сообщённый SMS/OTP-код или уже переведённые деньги;
- remote access, AnyDesk и вредоносный APK;
- SIM swap и угон Telegram;
- fake support, QR login, vote link и stranger/channel invite;
- task scam, fake job, комиссия/налог перед выплатой;
- BNPL, рассрочка или кредит, который пользователь не оформлял;
- fake tax, loan advance fee, charity pressure и parcel fee;
- marketplace delivery, romance money и investment/crypto;
- blackmail/photo extortion;
- family emergency и другие сценарии социальной инженерии.

Completed incident/aftercare имеет приоритет над обычной профилактикой: если
пользователь уже передал код, установил приложение или отправил деньги, бот
должен давать срочные действия по восстановлению, а не только совет «ничего не
отправляйте».

### 3. Устойчивость к опечаткам и обходам

- Добавлена ограниченная нормализация NFKC, zero-width, homoglyph/confusable и
  смешанной кириллицы/латиницы.
- Закрыты безопасные варианты spaced/leet и частые опечатки в опасных маркерах.
- Добавлены отрицательные границы для статей, инструкций, цитат, третьих лиц,
  честных банковских операций и технических идентификаторов, чтобы не повышать
  риск только из-за слова `code`, `installment`, `bank` или `получить`.
- Образовательная цитата не должна автоматически считаться личным инцидентом,
  но слова `guide`, `policy` или `example` больше не являются глобальным
  способом скрыть реальную опасную инструкцию.

### 4. Защита секретов и приватности

- OTP, PIN, CVV, пароли, passphrase, private key и recovery/seed phrase
  перехватываются до обычного risk/AI/storage pipeline.
- Покрыты mixed-script labels, несколько секретов в одном сообщении,
  value-first варианты, буквенно-цифровые коды, опечатки и полностью spaced
  labels.
- Поддержаны канонические recovery phrases из 12/15/18/21/24 слов, включая
  многострочный, нумерованный и маркированный формат.
- Inline secret result полностью статичен: preview и вставляемый текст не
  содержат исходный секрет или пользовательский контекст с ним.
- Voice secret preview также статичен; сырой transcript с секретом не кэшируется
  и не передаётся ожидающим запросам.
- Telegram public-post и общие display/storage sinks получили дополнительную
  mixed-script маскировку.
- Для проверенных secret-path действует контракт: нет raw echo, обычного
  `runCheck`, AI-вызова, session write или внешнего запроса.

### 5. Надёжность Telegram delivery и мониторинг

- Production использует durable Postgres-fenced polling. Webhook оставлен как
  совместимый fail-closed boundary.
- Direct delivery различает retryable, permanent и ambiguous ответы Telegram.
  Контекст и вторичные действия выполняются только в безопасной фазе.
- Exactly-once доставка честно не заявляется: у Telegram нет idempotency key, а
  отдельный durable outbound outbox пока не реализован.
- Scheduled Production Monitor проверяет `/`, `/healthz`, webhook secret
  boundary, `getMe`, `getWebhookInfo`, polling leader, pending updates и
  `last_error`.
- Обычный scheduled monitor не получает AI-ключи, не вызывает AI/TTS и не
  отправляет Telegram-сообщения. Платный provider probe возможен только отдельным
  явным opt-in.
- Текущий no-AI smoke показывает polling mode, пустой webhook URL, `pending=0`,
  `last_error=none` и здорового polling leader.
- После нескольких transient `getUpdates` network/502 событий polling
  восстановился автоматически. Повторяющийся silent-update/lost-response
  паттерн не подтверждён.
- Один optional AI explanation получил quota `429`. Детерминированное ядро при
  этом продолжает работать, но доступность необязательного AI-объяснения нельзя
  считать гарантированной.

### 6. Supabase, админка и безопасность

- Два независимо контролируемых владельца используют TOTP MFA.
- Railway требует `REQUIRE_ADMIN_MFA_AAL2=true`; отсутствующая или неверная
  production-конфигурация отклоняется.
- Все семь защищённых admin RLS policies требуют
  `private.is_admin_aal2()`, включая оба UPDATE `WITH CHECK`.
- Реальный AAL1-deny/AAL2-allow путь проверен одним пользовательским клиентом;
  service-role запрос не выдавался за это доказательство.
- В production применена retention-миграция Family Shield claims и ежедневная
  cleanup-функция.
- Развёрнуто versioned hash-pepper поведение: новые записи используют `v2`,
  legacy reads сохраняют совместимость до отдельного безопасного retirement.
- Service-role клиент не попадает в browser bundle.
- CI включает TypeScript, lint, build, tests, migration/schema/pgTAP checks,
  CodeQL, full-history secret scan, container scan и SBOM.

### 7. UI/UX и accessibility

- Главная и `/admin` приведены к одной системе типографики, отступов, радиусов,
  границ и motion.
- Сохранено утверждённое направление: тёплый белый фон, чёрный текст, оранжевые
  CTA, зелёные safe и красные danger состояния.
- Сохранён точный production background и reduced-motion режим.
- Главная и админка проверялись на ширинах 320, 375, 390, 768, 1024, 1280,
  1440 и 1920 px без горизонтальных обрезаний.
- Исправлены основные mobile/accessibility проблемы и централизованы публичные
  emergency contacts.

### 8. Recovery и эксплуатационная устойчивость

- Созданы пароль-защищённые EFS и portable PFX recovery-копии.
- Копии размещены независимо от рабочего компьютера в OneDrive и отдельном
  Google Drive; пароль не хранится рядом с архивом и не передаётся в чат.
- Выполнен hosted restore drill в отдельном staging Supabase с проверкой схемы,
  основных миграций и AAL1/AAL2 поведения.
- Production DB migration head и семь AAL2 policies перепроверены после apply.
- Развёрнуты Brotli/gzip compression и безопасная обработка ошибок/cancellation.
- Подготовлены runbooks для rollback, recovery, migration apply и key rotation.
- Railway связан с GitHub `main`, Auto Deploy и Wait for CI работают.

## Последние production-релизы

| Дата       | Релиз                   | Что изменилось                                                                                                   | Статус                                                                            |
| ---------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 2026-08-28 | PR №141, `b36c453`      | Three-slot hash-pepper runtime и контролируемая ротация production credentials                                   | Production `311997d0`, healthy; формальный canary ещё не начат                    |
| 2026-08-26 | PR №133+135, `a964153f` | Candidate backup workflow-файлы (`NOT ENABLED / NOT VERIFIED`) и CI-actions батч; application runtime не менялся | Superseded PR №141 и secret cutovers; окно №3 закрыто без формального verdict     |
| 2026-08-25 | PR №129, `9019776`      | Semantic/human-simulation hardening: rules, patterns, RU/UZ/EN routing, QA corpora; watch patterns               | Superseded production; окно №2 прошло 18/18, заменено ускорением                  |
| 2026-08-20 | PR №128, `58557765`     | Исправлен `installment`/APK конфликт в Inline и русский task-scam «зарплата → налог»                             | Superseded; operational `GO`, formal `OPEN / exception pending`                   |
| 2026-08-13 | PR №126, `8a76a5e`      | Большой RU/UZ/EN hardening, privacy/secret paths, completed actions, report TTL                                  | Superseded production; 226 eligible monitor success, operational observation `GO` |
| 2026-08-09 | PR №125, `1576e21`      | Coercive transaction secrecy context                                                                             | Historical production checkpoint                                                  |
| 2026-08-09 | PR №124, `eb944f3`      | Task scam, BNPL и coercion hardening                                                                             | Входит в текущий `main`                                                           |
| 2026-08-08 | PR №123, `f3a2343`      | Completed-action и language hardening                                                                            | Входит в текущий `main`                                                           |

Подробный неизменяемый отчёт о последнем релизе:
[`ai_docs/PRODUCTION_APPLICATION_RELEASE_2026-08-25.md`](ai_docs/PRODUCTION_APPLICATION_RELEASE_2026-08-25.md).

## Что не находится в production

- [PR №137](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/137) —
  `DRAFT/HOLD`, не задеплоен. Candidate
  `c437a30` после rebase на текущий `main` завершил второй TDD-раунд по generic
  «отправил + не той/не тому» и полностью re-gated локально: 15 364/15 364,
  focused 152/152, TypeScript/lint/build/prettier чисто; GitHub CI 7/7. Нужны
  решение владельца и явный новый canary.
- [PR №140](https://github.com/Web-pixel-creator/Scam-guard-Main/pull/140) —
  `DRAFT/HOLD`, candidate `b076450`, hardened backup/restore trust contract.
  Local gates и GitHub CI 7/7 прошли. Он не включает cron и не доказывает
  operational backup до реального backup/read-back/restore.
- PR №138 смержил только предложения
  `ai_docs/DESIGN_OUTBOX_JOURNAL.md` и
  `ai_docs/DESIGN_OBSERVABILITY_BASELINE.md`. Outbox и observability baseline не
  реализованы.
- `ai_docs/CLIENT_ACCEPTANCE_PLAN_2026-08.md` — план, а не выполненная приёмка;
  формальный Inline результат остаётся 1/51.
- PR №127 уже закрыт как устаревший; он не является текущим кандидатом.

## Что ещё не завершено

1. Принять одно решение по release bundle: PR №137, PR №140 и Railway-IaC Draft
   PR №142 (`8c440ba`) — merge одним окном либо явная отсрочка каждого пункта. IaC-аудит
   уже поймал и исправил два потенциальных удаления previous-pepper variables;
   повторный plan показывает `0 destroy`, но apply не выполнялся.
2. После единственного deploy выполнить read-back/smokes и начать новый canary;
   нужны одновременно ≥72 часа и ≥144 eligible scheduled success.
3. Разобрать formal exception окна №1: отдельное разрешение на
   polling-dialogue smoke или owner/expiry-bound waiver плюс полная AI-probe
   evidence.
4. Перед добавлением production backup credentials исправить и stage-test
   Supabase-compatible export/restore и доказать один credential gate:
   independent trusted reviewer + CODEOWNERS + ≥1 approval/dismiss-stale либо
   protected environment с ручным approval. Во втором случае scheduled job ждёт
   человека и не является unattended daily backup. Затем запустить
   backup/read-back/restore в явно записанном новом canary-окне.
5. До `2026-12-01` вручную мигрировать deprecated `railway.toml` на
   `.railway/railway.ts` через CLI `>=5.44` pull/plan/apply; blind auto migrate
   запрещён, потому что он не сохраняет все watch/build/restart инварианты.
6. До DB credential исправить BOM/mojibake и стабильные ASCII job names,
   ограничить Actions+SHA и включить `main` ruleset без bypass. Required
   approvals оставить `0` до появления второго независимого reviewer, но при
   таком sole-owner режиме backup credentials остаются заблокированы, если нет
   отдельного protected-environment approval.
7. Записать Railway payment-method expiry, spend alerts и ответственного за
   реакцию.
8. Обновить Supabase CLI с `2.104.0` до проверенной версии `2.110.0+` сначала в
   staging, не экспериментируя на production-linked окружении.
9. Завершить risk-based real-client matrix Desktop/Android/iOS для критических
   Direct/Inline RU/UZ/EN сценариев. Формальный Inline client pack пока 1/51.
10. Отдельно провести Voice, accessibility и независимую legal/privacy приёмку.
11. Перепроверить реальный Telegram → browser путь `/appeal` на RU/UZ/EN.
12. Провести 5–8 модерируемых usability sessions, затем ограниченный пилот на
    20–30 человек и собирать только privacy-safe funnel events.
13. Сохранять как отдельные архитектурные границы multi-instance polling
    handoff и durable outbound outbox; не заявлять exactly-once до их реализации.

## Где смотреть самые свежие изменения

Используйте источники в таком порядке:

1. **Этот файл** — простая сводка для владельца проекта.
2. [`ai_docs/CURRENT_STATE.md`](ai_docs/CURRENT_STATE.md) — короткий operational
   source of truth: production commit, deployment, проверки и открытые границы.
3. [`ai_docs/OPEN_TASKS.md`](ai_docs/OPEN_TASKS.md) — подробная очередь того, что
   действительно ещё нужно сделать.
4. [`ai_docs/CANARY_72H.md`](ai_docs/CANARY_72H.md) — письменный контракт и
   доказательства production-наблюдения.
5. [`ai_docs/CHANGELOG_AI.md`](ai_docs/CHANGELOG_AI.md) — подробная хронология;
   самые новые записи находятся сверху.
6. [`ai_docs/RECOVERY_AND_KEY_ROTATION.md`](ai_docs/RECOVERY_AND_KEY_ROTATION.md)
   — backup, restore, rollback, MFA и rotation boundaries.
7. [`AI_INDEX.md`](AI_INDEX.md) — карта всей документации.
8. [GitHub `main` commits](https://github.com/Web-pixel-creator/Scam-guard-Main/commits/main/)
   и [Pull Requests](https://github.com/Web-pixel-creator/Scam-guard-Main/pulls)
   — что реально опубликовано или только ожидает merge.

## Почему другие люди иногда видят старое состояние

Основные причины:

- на компьютере есть несколько Git worktree и веток с разными commit;
- локальный незакоммиченный diff виден только в конкретной папке и не появляется
  на GitHub;
- старый PR или старая локальная `main` может отставать от удалённой ветки;
- датированные отчёты и фидбеки сохраняют историческое состояние и не должны
  автоматически считаться текущим планом;
- зелёные локальные тесты ещё не означают merge и deployment.

Для read-only проверки актуального GitHub `main`:

```powershell
git ls-remote origin refs/heads/main
gh pr list --state open
gh pr list --state merged --limit 10
```

Ожидаемые идентификаторы на дату этой сводки:

```text
GitHub main: b36c453a08b3afd05c6e623d938e15dfc5b6084c
Deployed runtime: b36c453a08b3afd05c6e623d938e15dfc5b6084c
```

Не выполняйте `reset`, `checkout`, `clean`, `stash`, `rebase` или обычный
`pull` поверх грязного worktree только ради обновления отображаемых файлов.
Сначала сохраните и разберите чужие изменения в отдельной ветке/worktree.

## Как понять, что правка действительно опубликована

Правку можно назвать production-фактом, только если одновременно выполнено:

1. commit входит в GitHub `main`;
2. CI и Security Gates для merge commit зелёные;
3. Railway показывает `SUCCESS` deployment именно этого commit;
4. `/healthz` и post-deploy no-AI smoke проходят;
5. database migration/config identity совпадает с release scope;
6. текущий `CURRENT_STATE.md` или отдельный release record не противоречит
   фактическому deployment.

Локальный diff, сообщение агента, старый фидбек, открытый PR или один зелёный
тестовый прогон сами по себе не доказывают, что изменение уже находится в
production.

## Честный итог

За последний месяц проект заметно продвинулся: production Telegram-ядро стало
точнее на RU/UZ/EN, закрыло большое количество послеинцидентных и обфусцированных
сценариев, усилило no-echo защиту секретов, AAL2/RLS, retention, monitoring,
recovery и delivery boundaries. Это серьёзная инженерная база для безопасного
пилота.

При этом deployed gate 15 327/15 327 не доказывает реальную точность на людях,
спрос или предотвращённые потери. Следующий качественный шаг — не добавление ещё
одной большой функции, а корректное завершение текущего canary, исправление
PR №137, реальная backup/RPO proof, device QA и контролируемый пользовательский
пилот с privacy-safe метриками.

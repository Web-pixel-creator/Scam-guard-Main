# Проверенный план по продуктовым и техническим фидбекам

Дата проверки: 24 июля 2026
Репозиторий: `C:\Scam-guard\repo`
Снимок кода: ветка `main`, `HEAD d3c20f1`, рабочее дерево намеренно грязное
Статус: аудит завершён, реализация пунктов этого документа ещё не начиналась

> Актуализация 26 июля 2026: строка статуса выше описывает исходный checkpoint.
> Значительная часть этапов 0–3 после него реализована и опубликована.
> Фактический baseline и оставшиеся задачи теперь ведутся в
> `CURRENT_STATE.md`; этот файл сохраняется как проверенное обоснование и
> порядок продуктовых этапов.

## 1. Назначение документа

Этот документ объединяет:

- незавершённые этапы уже согласованного плана;
- четыре новых файла с техническим и продуктовым фидбеком;
- проверку утверждений по текущему коду, документации и production;
- независимые read-only проверки нескольких агентов;
- безопасный порядок дальнейшей реализации с критериями готовности.

Во время аудита не выполнялись commit, push, deploy, production-миграции, платные AI-вызовы или массовые Telegram-проверки. Production использовался только для read-only HTTP/browser-проверок. Полный test suite в рамках этого аудита не перезапускался: последний известный локальный gate до аудита был зелёным, но после будущих изменений его потребуется пройти заново.

Параллельные локальные UI/UX-правки другого агента считаются пользовательскими. Их нельзя сбрасывать, перезаписывать, stash/rebase/clean или приписывать текущему исполнителю.

## 2. Краткий вердикт

Фидбек в целом сильный и полезный, но не является готовым техническим заданием.

Главная мысль верна: Ishonch Guard уже очень силён как детерминированный проверяющий механизм, но теперь больший прирост пользы дадут:

1. разрыв изоляции человека под давлением;
2. семейная помощь и проверенные контакты;
3. безопасный протокол действий после инцидента;
4. outcome-метрики вместо одного счётчика проверок;
5. доступность, честные обещания и эксплуатационная надёжность;
6. реальные пользовательские пилоты вместо бесконечного расширения числа правил.

При этом стратегический разворот уже частично сделан: `/call`, Guardian Angel, Family Shield, семейное кодовое слово, каталог официальных контактов и 15 SOS-сценариев существуют. Их нужно не создавать заново, а исправить, упростить, измерить и безопасно вывести в эксплуатацию.

Нельзя внедрять буквально следующие советы:

- два ответа «да» про срочность и секретность не должны автоматически становиться окончательным scam-вердиктом без corpus/FP-проверки;
- «секретность» сама по себе не означает мошенничество: фраза «никому не сообщайте OTP» может быть корректным предупреждением;
- `1344` нельзя показывать как универсальный номер банка — это короткий номер NBU;
- нельзя обещать гарантированное «окно первого часа» или возврат перевода;
- LLM, возвращающий enum, всё равно способен выбрать неверный маршрут и опасный кризисный совет;
- плановые сообщения через 30 минут/24 часа — не одна колонка и не простой cron, а отдельная delivery-инфраструктура;
- скрытые правила не должны быть основной защитой от обхода;
- нельзя называть outcome «спасёнными деньгами» без согласованной методологии, знаменателя и privacy-review.

## 3. Что подтверждено, что устарело и что требует корректировки

| Тема фидбека | Проверенный вердикт | Решение |
|---|---|---|
| Rules-first, AI только объясняет | Подтверждено. Детерминированный score остаётся источником вердикта | Сохранить как архитектурное ограничение |
| Regex/словари достигли потолка | Частично верно. Монолиты велики, но уже есть общие нормализаторы, UZ Cyrillic, translit, multiline и code-switching corpus | Сначала измерить реальные null/misroute cases; архитектуру менять только по benchmark |
| Inline language detection хрупкий | Частично верно: hand-written signals и пороговые эвристики остаются риском | Продолжить corpus-driven улучшения; не включать платный LLM в Inline |
| `/start` содержит 11 кнопок | Подтверждено | Проверить упрощённый первый экран на реальных пожилых пользователях; не переставлять вслепую |
| Pressure/secrecy важнее легенды | Сильная, но ещё не доказанная гипотеза | Добавить triage и reason signal только с RU/UZ/EN negative corpus и shadow/A/B-пилотом |
| Family Shield — лишь пункт меню | Устарело: invite/accept/revoke, cooldown, ручная кнопка и proactive alert уже существуют | Исправить consent/idempotency и улучшить caregiver-first onboarding |
| Семейное кодовое слово нужно добавить | Уже сделано, секрет намеренно не хранится | Сохранить privacy-first подход; напоминания — только после общей очереди и opt-in |
| Справочник нужно выделить отдельно | Почти уже сделано: есть `/official-numbers`, поиск, source и дата | Главный пробел — correctness, freshness, owner и lifecycle |
| Контактов 36 | Неверно. В seed 35 записей; из них 8 Telegram handles просрочены, активны 27 | Не использовать устаревшие числа; считать только fresh |
| Дата проверки номера не показывается | Устарело: текущая карточка показывает source и `verifiedAt` | Добавить stale/retired state, а не дублировать дату |
| Reverse lookup отсутствует | Устарело: обычная проверка уже распознаёт official/lookalike numbers | `/nomer` делать только если аналитика покажет проблему discoverability |
| Интентов 53 | Устарело: сейчас 54 | Любой benchmark привязать к актуальному enum |
| LLM→enum полностью безопасен | Неверно в сильной формулировке: intent меняет routing и шаблон до `runCheck` | Только offline/shadow для eligible null cases; исключить panic, Inline и артефакты |
| SOS «первого часа» отсутствует | Частично устарело: freeze/dispute, evidence, 102 и готовая фраза уже есть | Упорядочить и юридически проверить, не обещать гарантированный возврат |
| Половина пользователей приходит после перевода | В текущих данных не проверяется | Сначала outcome/event model, затем выводы |
| Outcome важнее числа тестов | Подтверждено | Сделать privacy-safe outcome pilot одним из главных продуктовых этапов |
| Заморозить все второстепенные функции | Направление верное, буквальная формулировка слишком широкая | Заморозить новые growth-функции, но продолжать safety, accessibility, appeal, directory, admin/security и release gates |
| A+ действительно увеличивает шрифт | Не подтверждено; production-проверка доказала обратное | Исправить как P0 accessibility |
| Мобильная типографика и tap targets малы | Подтверждено измерением production на 375 px | Исправить и пройти полную матрицу ширин |
| HTTP compression отсутствует | Подтверждено production HTTP-проверкой | Включить gzip/brotli на app/edge и зафиксировать transfer budget |
| «Данные не храним» неточно | Подтверждено для production и части RU/UZ/EN copy | Использовать точное описание: исходный текст не публикуется; redacted/hash metadata может храниться |
| Service-role код присутствует в client graph | Подтверждено как латентный риск; значения ключа в bundle не найдено | Исправить server-only boundary и добавить post-build CI guard |
| Password policy только client-side | Частично устарело: docs фиксируют dashboard policy, но signup остаётся прямым/public, CAPTCHA off, leaked-password protection недоступна на Free | Оставить Supabase Free, но сделать admin signup invite-only/closed и проверить server-side настройки |
| Railway rate-limit identity сломана | Риск подтверждён; утверждение «оба режима точно сломаны» слишком категорично без live spoof probe | На Railway доверять только доказанному edge-overwritten `X-Real-IP`, не первому клиентскому XFF |
| Webhook secret compare не constant-time | Подтверждено, низкая практическая тяжесть | P3 hardening |
| Gemini key передаётся query-параметром | Подтверждено | Перевести на `x-goog-api-key`, не логировать URL |
| Telegram `file_path` не валидируется | Подтверждено, SSRF ограничен фиксированным Telegram host | Добавить allowlist и запрет traversal/query/fragment |
| Публичные правила позволяют обход | Частично верно | Не полагаться на obscurity; добавлять свежие server-side reputation/velocity/partner signals |
| Краткой архитектуры нет | Устарело: `ai_docs/ARCHITECTURE.md` существует | Обновить и сократить docs, а не создавать дубликат |

## 4. Дополнительные проблемы, найденные при проверке

Эти пункты не были ясно сформулированы в исходном фидбеке, но влияют на безопасность сильнее части предложений.

### 4.1. На главной странице показаны неверные или неподтверждённые экстренные контакты

В `src/components/ApprovedRussianHomepage.jsx` и `src/routes/index.tsx` захардкожены:

- `1173` как «Горячая линия UZCARD»;
- `1252` как «Антифрод-линия ЦБ».

Проверка первичных источников показала:

- официальный UZCARD указывает call center `1257`;
- официальный МВД Узбекистана относит `1173` к Safe Tourism;
- официальный Центральный банк указывает телефон доверия `+998 71 200-00-44`;
- первичного подтверждения `1252` как антифрод-линии ЦБ не найдено;
- собственный `verified-contacts.ts` также относит `1173` к Safe Tourism и не содержит `1252`.

Это P0 content-safety defect: неверная кнопка звонка во время кризиса опаснее неточной маркетинговой фразы.

Решение:

1. убрать дублирующие hardcoded-массивы;
2. строить публичные contact CTA из единого verified registry;
3. удалить/скрыть `1252`, пока нет первичного источника;
4. показывать UZCARD как `1257`;
5. проверить официальное наименование маршрута `102`, не использовать неподтверждённый бренд;
6. добавить тест, который запрещает public emergency CTA без source, `verifiedAt`, freshness и usage context.

Первичные источники:

- UZCARD: https://uzcard.uz/news/uzcard_call_center
- МВД Узбекистана, список номеров: https://gov.uz/en/iiv/pages/contacts
- Центральный банк: https://cbu.uz/ru/contacts/helpline/

### 4.2. Family Shield обещает one-tap, но автоматически уведомляет после high-risk

Тексты подключения говорят, что пользователь сможет «позвать близкого одной кнопкой» и что доверенный контакт получит сигнал, если близкий попросит помощь. Однако `sendCheckResult()` после private high-risk результата автоматически вызывает `notifyTrustedContact()`.

Это не обязательно плохая функция, но текущий consent-контракт неоднозначен. Дополнительно cooldown реализован как read → send → update timestamp и не атомарен, поэтому два параллельных worker/retry могут отправить дубликаты.

Решение P0:

- отдельное двустороннее согласие `auto_alerts`, default `false`;
- одинаково ясное RU/UZ/EN объяснение ручных и автоматических уведомлений;
- manual notify остаётся доступен одной кнопкой;
- atomic claim/idempotency key до отправки;
- revoke/opt-out прекращает новые уведомления немедленно;
- третьей стороне никогда не передаётся исходный проверяемый текст, номер, ссылка, код, сумма или screenshot.

### 4.3. Production accessibility-дефект измерен, а не только предположен

Read-only browser-проверка production на viewport `375×900`:

- 222 видимых текстовых элемента в выбранном наборе;
- 160 имели computed font-size меньше 16 px;
- минимум — 9 px, медиана — 12 px;
- 13 из 41 интерактивных элементов имели хотя бы одну сторону меньше 44 px;
- изменение `--a11y-font-scale` с `1` до `1.5` не изменило ни одну из этих метрик, потому что production-типографика в основном задана в `px`.

Это эвристическое измерение, а не полный WCAG-аудит, но оно однозначно подтверждает структурную проблему.

### 4.4. Production действительно отдаёт крупные текстовые assets без сжатия

Read-only HTTP-проверка с `Accept-Encoding`:

- HTML `/`: около 64 KB;
- JS: около 764 KB;
- CSS: около 228 KB;
- `Content-Encoding` отсутствовал.

Суммарно это примерно 1,06 MB несжатого начального текста. Нужно определить, отвечает ли за compression приложение или Railway edge, затем закрепить результат автоматическим production smoke.

### 4.5. Privacy-copy уже частично исправляется локально, но ещё не закрыт

В dirty worktree другой агент уже заменил RU-фразу «Данные не храним» на «Исходные данные не публикуем» в одной homepage-реализации. Это изменение не задеплоено и не покрывает автоматически все RU/UZ/EN surfaces. Его нужно сохранить, проверить и согласовать с фактической retention/privacy policy.

### 4.6. Не связанные напрямую с новым фидбеком release gaps остаются открыты

В общий план необходимо сохранить:

- staged rollout Admin MFA;
- transactional consistency модерации/report/appeal;
- корректный correction loop для appeal;
- pagination/SLA admin queue;
- точное disclosure передачи screenshot/voice внешним AI-провайдерам;
- production monitoring core check/DB/RPC, а не только homepage/health;
- parity web SOS с Telegram;
- truthful APK-copy: сейчас продукт анализирует APK-ссылку/просьбу установить, но не бинарный APK-файл.

Эти пункты нельзя вытеснять новыми growth-функциями.

## 5. Принципы дальнейшей работы

1. Сначала исправляются опасные факты, consent и release/security boundaries.
2. Новые growth-функции временно заморожены.
3. Проверка, SOS, Family, official directory, appeal, accessibility и operations не считаются «лишними функциями».
4. Никакой production-мутации, deploy, paid AI, массовой Telegram QA или schema rollout без отдельного разрешения.
5. Все Telegram/product изменения проверяются на RU/UZ/EN и безопасных отрицательных примерах.
6. Inline остаётся stateless, deterministic и без платного AI.
7. Panic/SOS не должен ждать классификатор или длинный опрос, если деньги уже переведены, устройство скомпрометировано или угроза происходит сейчас.
8. Исходный текст, коды, пароли, PIN/CVV, seed phrase, номера карт и screenshots не используются как аналитическая telemetry.
9. Любое публичное число имеет период, знаменатель и понятное определение.
10. Параллельные UI-правки сохраняются; пересекающиеся файлы сначала diff-review, потом точечное редактирование.

## 6. Пошаговый план

### Этап 0. Зафиксировать безопасный рабочий baseline

Цель: не потерять текущие изменения и не смешать security, product и UI provenance.

Действия:

1. Перечитать `git status` и diff перед каждой серией правок.
2. Разделить текущие dirty changes по владельцу/теме: UI, admin/MFA/security, Telegram/product, docs.
3. Не делать reset, checkout, clean, stash, rebase или force operations.
4. Перед изменением файла, который трогает второй агент, дождаться его handoff и провести manual merge.
5. Создать frozen local RC только после завершения P0, а не из текущего смешанного worktree.

Критерий готовности:

- каждый изменённый файл имеет понятное происхождение;
- нет потерянных пользовательских правок;
- будущий release diff можно независимо ревьюить.

### Этап 1. P0 — исправить опасные публичные факты и обещания

#### 1.1. Единый реестр экстренных контактов

Действия:

- исправить `1173`/UZCARD на `1257`;
- удалить `1252` до появления первичного подтверждения;
- убрать hardcoded public contact arrays;
- проверить `102`, Центральный банк, банки, UZCARD/HUMO и операторов по первичным источникам;
- ввести `fresh/stale/retired`, owner, `verifiedAt`, `expiresAt`, usage context;
- stale/retired не считать verified и не показывать как обычную action-кнопку.

Acceptance:

- у 100% публичных contact CTA есть первичный URL, дата и freshness;
- ни один expired/unverified контакт не кликабелен как «проверенный»;
- tests ловят несовпадение homepage, directory и Telegram copy.

#### 1.2. Честный privacy и product copy

Действия:

- удалить «Данные не храним» / `Data is not stored` / `Ma’lumot saqlanmaydi` со всех surfaces;
- согласовать точный RU/UZ/EN текст с реальным поведением redaction/hash/retention;
- уточнить APK-copy: проверяется ссылка/просьба установить, а не бинарный APK;
- убрать категоричное «шанс есть только в первые часы».

Acceptance:

- copy snapshot tests по RU/UZ/EN;
- privacy page и UI описывают одинаковую модель;
- нет обещаний, которые код фактически не выполняет.

#### 1.3. Family Shield consent и idempotency

Действия:

- `auto_alerts=false` по умолчанию;
- bilateral opt-in и понятный opt-out;
- atomic notification claim/idempotency;
- manual one-tap остаётся главным безопасным default;
- миграция только локально до отдельного production approval.

Acceptance:

- default-off high-risk отправляет доверенному контакту 0 сообщений;
- manual tap отправляет ровно 1;
- auto-on с двумя параллельными worker/retry отправляет максимум 1;
- revoke блокирует новые alerts немедленно;
- payload не содержит проверяемый артефакт или секрет.

### Этап 2. P0 — закрыть security и operational boundaries

#### 2.1. Server-only client graph

Действия:

- исключить service-role implementation из client dependency graph;
- проверить все browser imports и lazy chunks;
- добавить post-build CI scan для server-only module reachability и секретных identifiers/values;
- сохранить Gitleaks/CodeQL/Trivy.

Acceptance:

- в client assets нет service-role implementation и `SUPABASE_SERVICE_ROLE_KEY`;
- server client доступен только server functions;
- CI падает на намеренном canary secret/import.

#### 2.2. Railway client IP и rate limits

Действия:

- подтвердить точное поведение Railway `X-Real-IP` и spoofed `X-Forwarded-For`;
- доверять только edge-overwritten header;
- не принимать первый произвольный XFF от клиента;
- провести controlled smoke с двумя независимыми клиентами.

Acceptance:

- два клиента получают разные HMAC buckets;
- подмена XFF не позволяет выбрать bucket;
- один клиент не блокирует всех за общим Railway edge IP;
- fail-closed поведение и privacy-safe logs проверены.

Официальная спецификация Railway:
https://docs.railway.com/networking/public-networking/specs-and-limits

#### 2.3. Supabase Auth на бесплатном тарифе

Решение: Supabase Free пока оставить.

Действия:

- закрыть публичную admin-регистрацию или перевести её в invite-only;
- проверить server/dashboard minimum password и strongest character policy;
- сохранить email confirmation;
- CAPTCHA и abuse protection оценить отдельно;
- явно зафиксировать, что leaked-password protection недоступна на Free;
- не выдавать отсутствие этой Pro-функции за включённую защиту.

Acceptance:

- незапрошенный пользователь не может создать admin account;
- password policy действует не только как HTML attribute;
- два admin owner проходят documented access/recovery flow.

Официальные источники:

- https://supabase.com/pricing
- https://supabase.com/docs/guides/deployment/going-into-prod
- https://supabase.com/docs/guides/auth/auth-mfa

#### 2.4. Завершить staged rollout Admin MFA

Текущий незавершённый порядок сохраняется:

1. после review и явного approval задеплоить MFA UI с enforcement flag off;
2. подключить минимум два owner account;
3. выполнить recovery/reset drill;
4. проверить AAL1 denied/AAL2 allowed для каждой admin server function;
5. включить enforcement отдельным approval;
6. подготовить rollback без отключения аудита.

#### 2.5. Малые hardening-задачи

- Gemini API key перенести из query в `x-goog-api-key`;
- валидировать Telegram `file_path`: без leading slash, backslash, `..`, percent/query/fragment;
- webhook secret сравнивать constant-time при одинаковой длине;
- проверять и наблюдать каждую DB `.error`, а не молча продолжать.

### Этап 3. P1 — performance и accessibility

#### 3.1. Compression и transfer budget

Действия:

- определить owner compression: app middleware или Railway edge;
- включить brotli/gzip для HTML/JS/CSS/JSON/SVG;
- добавить `Vary: Accept-Encoding`;
- не сжимать уже сжатые media;
- добавить production smoke с `Accept-Encoding`.

Acceptance:

- текстовые ответы больше 1 KB имеют `Content-Encoding: br` или `gzip`;
- browser получает корректный content и cache headers;
- initial transfer budget зафиксирован и соблюдается;
- regression test падает при исчезновении compression.

#### 3.2. Реальное A+ и mobile accessibility

Действия:

- перевести масштабируемую типографику на `rem`/`calc(... * var(--a11y-font-scale))` или эквивалентную систему;
- поднять основной mobile body text;
- обеспечить product target минимум 44×44 для основных controls;
- проверить focus, keyboard, contrast, reduced motion, zoom 200%;
- не ломать утверждённый warm-white editorial design и фон.

Обязательная матрица для homepage и `/admin`:

- 320, 375, 390, 768, 1024, 1280, 1440 и 1920 px;
- scale 100%, 125%, 150%;
- browser zoom 100% и 200%;
- reduced-motion on/off.

Acceptance:

- computed font-size заметно меняется при A+;
- нет horizontal overflow/overlap/обрезанных кнопок;
- основные интерактивные элементы доступны с клавиатуры и имеют достаточную площадь;
- visual review остаётся локальным до явного approval.

### Этап 4. P1 — сфокусировать Telegram на разрыве изоляции

#### 4.1. Pressure/secrecy reason и triage

Действия:

- создать RU/UZ/EN corpus реальных формулировок;
- включить benign negatives: сюрприз-подарок, медицинская приватность, «никому не сообщайте OTP», цитирование чужой фразы;
- secrecy alone — максимум дополнительный сигнал;
- эскалация только при сочетании с деньгами, кодом/секретом, authority, urgency, запретом перезвонить или изоляцией;
- два вопроса использовать для action routing, а не как безусловный verdict;
- сначала offline/shadow, затем ограниченный A/B.

Acceptance:

- отдельные FP/FN по RU/UZ/EN и code-switching;
- completed-incident/aftercare всегда выше обычной классификации;
- уже переведённые деньги/установленный APK/account takeover не задерживаются triage;
- Inline semantic oracle и Direct corpus остаются зелёными.

#### 4.2. Упростить `/start`

Гипотеза:

- первый экран: «мне звонят сейчас», «проверить сообщение/номер», «помочь близкому»;
- остальные функции — во втором меню.

Порядок:

1. провести 5–10 коротких moderated tests с пожилыми пользователями и взрослыми детьми;
2. сравнить current vs simplified completion;
3. менять меню только после данных.

Метрики:

- time-to-first-safe-action;
- wrong-entry rate;
- abandonment;
- необходимость вернуться назад;
- понимание Family/SOS без объяснения модератора.

#### 4.3. Caregiver-first Family onboarding

Действия:

- исследовать сценарий «настраиваю для мамы/папы»;
- разделить роли guardian/trusted person понятным языком;
- не хранить семейное кодовое слово;
- получить consent обоих участников;
- не превращать взрослого пользователя в объект скрытого наблюдения.

Acceptance:

- оба участника понимают, кто и когда получает alert;
- setup/revoke/opt-out проверены RU/UZ/EN;
- нет уведомлений до явного согласия.

#### 4.4. Упорядоченный SOS-протокол

Действия:

- использовать уже существующие bank freeze/dispute, evidence, 102 и safe callback steps;
- сделать короткий последовательный flow с Resume, Готово, Пропустить, Не получается;
- не собирать raw сумму, получателя, карту или screenshot в session;
- фразу для банка и заявление проверить с банками/платёжными системами и юристом в Узбекистане;
- использовать номер обслуживающего банка из приложения/карты/официального сайта, не общий `1344`.

Acceptance:

- immediate action доступен одним нажатием;
- пользователь всегда понимает текущий и следующий шаг;
- нет обещания возврата или точного универсального времени;
- redacted incident summary создаётся только opt-in и отдельно от публичной жалобы.

Официальная базовая рекомендация ЦБ — немедленно связаться со своим обслуживающим банком:
https://cbu.uz/ru/press_center/news/494850/

### Этап 5. P1/P2 — сначала измерение, затем решения о feature freeze

#### 5.1. Privacy-safe feature analytics

События:

- `exposure`;
- `start`;
- `result`;
- `safe_action`;
- `complete`;
- `feedback`.

Минимальная агрегация:

- `feature`;
- `day`;
- `channel`;
- `event`;
- count.

Запрещено:

- raw input;
- Telegram user id;
- номер телефона/карты;
- URL/username;
- screenshot/voice;
- текст разговора.

Acceptance:

- exposure/start/complete различаются;
- есть знаменатель и период;
- повторное событие идемпотентно;
- retention и delete policy задокументированы;
- appeal и safety/legal paths не выключаются только из-за низкой частоты.

#### 5.2. Outcome taxonomy до scheduler

Нельзя начинать с публичной метрики «спасённые деньги».

Сначала определить:

- кому и после какого события задаётся вопрос;
- что означает «остановился» до перевода;
- как отдельно учитывать уже совершённый перевод;
- invited/delivered/answered/declined;
- opt-out, quiet hours и retention;
- как избежать повторной травматизации.

Для пилота возможны только bounded enum-ответы без текста/суммы.

Acceptance:

- metric definition reviewed product/privacy/legal;
- публичный отчёт всегда показывает denominator и response rate;
- «не отправил деньги» не автоматически считается заслугой бота;
- данные нельзя связать с исходным артефактом.

### Этап 6. P2 — единая durable outbound queue

Очередь нужна общая для:

- 24-hour outcome pilot;
- SOS follow-up;
- Family/codeword reminders;
- будущих consented safety reminders.

Требования:

- opaque event id;
- due/claimed/delivered/answered timestamps;
- lease и atomic claim;
- idempotency key;
- retry/backoff;
- blocked-bot handling;
- opt-out и quiet hours;
- retention/delete job;
- никакого raw content.

Порядок включения:

1. локальные unit/integration tests;
2. shadow queue без отправки;
3. маленький 24-hour outcome pilot;
4. только затем SOS и Family reminders.

### Этап 7. P2 — hybrid classification только после данных

Перед любым внешним AI:

1. собрать labeled offline set из реальных consented/redacted null/misroute cases;
2. измерить текущий deterministic baseline;
3. сравнить compact local embeddings/model и enum-only external model;
4. оценить RU/UZ/EN, Cyrillic/translit/code-switching, latency и cost;
5. не отправлять raw secrets/PII.

Ограничения:

- не использовать в Inline;
- не использовать в panic/SOS;
- не изменять numeric score;
- не показывать user-visible intent до достижения quality gates;
- при timeout/invalid enum всегда deterministic fallback;
- внешний API только после отдельного budget approval.

Acceptance до user-visible pilot:

- заранее согласованные per-intent precision/recall;
- отсутствие регрессии critical aftercare;
- latency/cost budget;
- redaction/privacy review;
- kill switch и offline fallback.

### Этап 8. P2 — партнёры, fresh signals и distribution

Вместо скрытия regex:

- изучить licensed/reliable bank/operator/payment-system feeds;
- server-side reputation, recency и velocity;
- freshness/expiry/owner для каждого источника;
- explainability без раскрытия bypass threshold;
- пилот с 1–2 партнёрами или community channels.

Параллельно:

- набрать первый ограниченный cohort реальных пользователей;
- отдельно тестировать пожилых пользователей и взрослых детей;
- измерять безопасное действие, а не только число открытий.

### Этап 9. P2/P3 — maintainability и прозрачность

Действия:

- обновить существующий `ARCHITECTURE.md`;
- вынести исторические части `CHANGELOG_AI.md`, `DECISIONS.md`, `OPEN_TASKS.md` в архив;
- держать короткие current-state документы;
- дробить `victim-intent.ts`, `emergency.ts`, `inline.ts` по typed registries только при работе в соответствующей области;
- после появления ground truth публиковать агрегированную calibration/error note без пользовательских данных и bypass-рецептов.

Не делать рефакторинг монолитов отдельным большим bang rewrite.

## 7. Release gates

До публичного запуска обязательны:

1. один frozen RC;
2. полный local suite, TypeScript, build, lint, audit;
3. Telegram Desktop/Android/iOS Direct+Inline matrix RU/UZ/EN;
4. browser/accessibility/performance matrix;
5. production Auth/readback и rate-limit smoke;
6. MFA enrollment/recovery/enforcement;
7. backup/restore/rollback evidence;
8. legal/privacy approval;
9. billing/usage alerts;
10. свежий controlled canary без P0/P1 defects.

Любое изменение code/config/migration/secret после freeze требует повторной проверки затронутых gates.

## 8. Рекомендуемый фактический порядок выполнения

1. Сохранить и разложить текущий dirty worktree.
2. Исправить неверные номера, privacy/APK/first-hour copy.
3. Исправить Family consent/idempotency.
4. Закрыть client/server boundary, Railway IP, Auth/MFA и малые hardening-пункты.
5. Включить compression.
6. После handoff UI-агента исправить accessibility и пройти матрицу размеров.
7. Добавить privacy-safe usage events и outcome taxonomy.
8. Провести real-user discovery по `/start`, pressure triage и caregiver onboarding.
9. Реализовать проверенный ordered SOS flow.
10. Построить общую outbound queue и маленький outcome pilot.
11. Только после реальных данных решать, какие secondary features замораживать.
12. LLM/embeddings и partner signal layer оставить последними.
13. Затем frozen RC, полный регресс, live-client matrix и canary.

## 9. Следующий безопасный рабочий блок

Первый implementation-блок после одобрения этого плана:

1. read-only diff/provenance review пересекающихся файлов;
2. точечное исправление public emergency contacts через единый verified registry;
3. завершение privacy/APK/first-hour copy во всех RU/UZ/EN surfaces;
4. focused tests;
5. полный локальный gate;
6. отчёт без commit/push/deploy.

Он даёт максимальное снижение пользовательского риска при минимальном архитектурном вмешательстве и не конфликтует с будущим product redesign.

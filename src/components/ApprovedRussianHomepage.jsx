import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckInput } from "@/components/CheckInput";
import { QuickReportForm } from "@/components/QuickReportForm";
import { getPublicStats } from "@/lib/check.functions";
import { getActiveVerifiedContacts } from "@/lib/risk/verified-contacts";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Bank,
  ChatText,
  CheckCircle,
  EyeSlash,
  Globe,
  ImageSquare,
  Key,
  LinkSimple,
  LockKey,
  MagnifyingGlass,
  Megaphone,
  PaperPlaneTilt,
  Phone,
  PhoneCall,
  Plus,
  ShieldCheck,
  UserMinus,
  WarningCircle,
} from "@phosphor-icons/react";

const SAMPLE_TEXT =
  "Служба безопасности банка: зафиксирована подозрительная операция. Назовите код из SMS, чтобы отменить перевод.";

const checkSurfaces = [
  {
    icon: Phone,
    title: "Номер телефона",
    example: "«Здравствуйте, служба безопасности банка…»",
    answer: "Сверяем с жалобами и признаками звонков-обманов.",
  },
  {
    icon: PaperPlaneTilt,
    title: "Telegram-аккаунт",
    example: "«Менеджер банка пишет в личку и просит код»",
    answer: "Распознаём ботов, каналы-ловушки и фейковых сотрудников.",
  },
  {
    icon: LinkSimple,
    title: "Ссылки и сайты",
    example: "«Оплатите доставку — иначе посылку вернут»",
    answer: "Ищем поддельные домены, оплаты и опасные APK-файлы.",
  },
  {
    icon: ChatText,
    title: "SMS и сообщения",
    example: "«Срочно! По вашей карте подозрительная операция…»",
    answer: "Находим давление, запугивание и просьбы о коде или переводе.",
  },
];

const signals = [
  {
    category: "Банк и карта",
    title: "Звонок от имени банка и SMS-код",
    action: "Положите трубку и перезвоните по номеру с карты.",
    status: "На контроле",
  },
  {
    category: "Приложение",
    title: "«Защитное приложение» в формате APK",
    action: "Не устанавливайте файл. Если установили — включите авиарежим.",
    status: "Высокий риск",
  },
  {
    category: "Telegram",
    title: "«Аккаунт удалят — нажмите Cancel»",
    action: "Не входите по ссылке. Проверяйте статус только в Telegram.",
    status: "Постоянный риск",
  },
];

const schemeTags = [
  "Безопасный счёт",
  "Звонок «из банка»",
  "Поддельное приложение",
  "Код из SMS",
  "Кредит в Telegram",
  "Фейковый курьер",
  "Выигрыш / приз",
  "Фейковая вакансия",
];

const faqItems = [
  {
    q: "Мне звонят из «службы безопасности банка» — это правда?",
    a: "Настоящий банк не просит SMS-код, пароль или установку приложения по ссылке. Положите трубку и перезвоните по номеру с карты.",
  },
  {
    q: "Я уже отправил код из SMS — что делать?",
    a: "Сразу заблокируйте карту через приложение или официальный номер банка, смените пароль и сообщите банку, что код мог попасть к мошенникам.",
  },
  {
    q: "Установил подозрительное приложение APK — телефон в опасности?",
    a: "Включите авиарежим, не открывайте банковские приложения, удалите APK и свяжитесь с банком с другого устройства.",
  },
  {
    q: "Перевёл деньги «на безопасный счёт» — можно вернуть?",
    a: "Не ждите: позвоните в банк, попросите остановить перевод и зафиксировать обращение. Затем подайте заявление в полицию.",
  },
  {
    q: "В Telegram пишет «менеджер банка» — отвечать?",
    a: "Не отвечайте и не переходите по ссылкам. Банк решает вопросы внутри официального приложения или по номеру с карты.",
  },
  {
    q: "Хочу проверить ссылку, но боюсь по ней переходить",
    a: "Не открывайте её. Скопируйте адрес как текст и вставьте в проверку — мы разберём признаки риска без перехода на сайт.",
  },
];

const emergencyContacts = [
  { number: "102", title: "Полиция · Cyber Police", note: "Заявление о мошенничестве" },
  { number: "1252", title: "Антифрод-линия ЦБ", note: "Блокировка карт и счетов" },
  { number: "1173", title: "Горячая линия Uzcard", note: "Споры по платежам" },
];

const ctaParticles = Array.from({ length: 10 });

function AnimatedCTA({ as: Tag = "button", className = "", children, ...props }) {
  return (
    <Tag className={`animated-orange-cta ${className}`.trim()} {...props}>
      <span className="points_wrapper" aria-hidden="true">
        {ctaParticles.map((_, index) => (
          <i className="point" key={index} />
        ))}
      </span>
      <span className="animated-cta-inner">{children}</span>
    </Tag>
  );
}

export function ApprovedRussianHomepage() {
  const [faqOpen, setFaqOpen] = useState(0);
  const statsFn = useServerFn(getPublicStats);
  const { data: publicStats, isLoading: statsLoading } = useQuery({
    queryKey: ["check-stats"],
    queryFn: () => statsFn({ data: undefined }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const verifiedContacts = getActiveVerifiedContacts();
  const verifiedContactsCount = verifiedContacts.length;
  const callbackNumbersCount = verifiedContacts.filter(
    (contact) => contact.contactType !== "telegram" && contact.contactType !== "email",
  ).length;
  const bankLinesCount = verifiedContacts.filter(
    (contact) => contact.orgType === "bank" && contact.contactType !== "telegram",
  ).length;
  const emptyStats = {
    total: 0,
    today: 0,
    dangerous: 0,
    high_risk: 0,
    confirmed_entities: 0,
    reported_loss_uzs: 0,
  };
  const stats = publicStats ?? emptyStats;
  const formatCount = (value) => new Intl.NumberFormat("ru-RU").format(value);
  const formatStat = (value) => (statsLoading ? "…" : formatCount(value));

  const scrollToCheck = () => {
    document.querySelector("#checker")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <main className="site-shell">
      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" /> Антискам-помощник для Узбекистана
          </div>
          <h1>
            Не доверяйте
            <br />
            <span>на слово.</span>
            <br />
            Проверьте.
          </h1>
          <p className="hero-lead">
            Вставьте номер, Telegram, ссылку или сообщение. Получите понятный уровень риска и один
            безопасный следующий шаг.
          </p>
          <div className="hero-actions">
            <AnimatedCTA className="primary-button" type="button" onClick={scrollToCheck}>
              Проверить сейчас <ArrowDown weight="bold" />
            </AnimatedCTA>
            <a
              className="text-link"
              href="https://t.me/scamguard_bot"
              target="_blank"
              rel="noreferrer"
            >
              <PaperPlaneTilt weight="fill" /> Открыть Telegram-бот
            </a>
          </div>
          <a className="urgent-inline" href="/emergency">
            <WarningCircle weight="fill" aria-hidden="true" />
            <span>
              <strong>Уже отправили код или деньги?</strong>
              Перейти к срочным действиям
            </span>
            <ArrowRight aria-hidden="true" />
          </a>
          <div className="trust-points" aria-label="Преимущества">
            <span>
              <LockKey /> Без регистрации
            </span>
            <span>
              <ShieldCheck /> Исходные данные не публикуем
            </span>
            <span>
              <Globe /> RU · UZ · EN
            </span>
          </div>
        </div>

        <div className="checker-wrap" id="checker">
          <div className="checker-heading">
            <div>
              <span className="section-kicker">Быстрая проверка</span>
              <h2>Что хотите проверить?</h2>
            </div>
            <span className="ready-state">
              <span /> Готово
            </span>
          </div>
          <CheckInput defaultValue={SAMPLE_TEXT} variant="signal" />
        </div>
      </section>

      <section className="proof-strip" aria-label="Статистика сервиса">
        <div>
          <strong>{formatStat(stats.total)}</strong>
          <span>всего проверок</span>
        </div>
        <div>
          <strong>{formatStat(stats.dangerous)}</strong>
          <span>предупреждений о риске</span>
        </div>
        <div>
          <strong>{formatCount(verifiedContactsCount)}</strong>
          <span>официальных контактов</span>
        </div>
        <div className="proof-note">
          <ShieldCheck weight="fill" />
          <span>
            Только проверяемые факты.
            <br />
            Без громких обещаний.
          </span>
        </div>
      </section>

      <section className="how-section content-section" id="how">
        <div className="section-heading split-heading">
          <div>
            <span className="section-index">01 / Как работает</span>
            <h2>
              Три шага.
              <br className="title-break" /> Один безопасный ответ.
            </h2>
          </div>
          <p>
            Без сложных терминов и запугивания. Показываем, почему сигнал опасен и что сделать прямо
            сейчас.
          </p>
        </div>
        <div className="process-layout">
          <ol className="steps-list">
            <li>
              <span>01</span>
              <div>
                <MagnifyingGlass />
                <h3>Пришлите подозрительное</h3>
                <p>Номер, сообщение, ссылку, Telegram или скриншот.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <ShieldCheck />
                <h3>Получите понятный вердикт</h3>
                <p>Уровень риска и конкретные причины без технического жаргона.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <CheckCircle />
                <h3>Сделайте безопасный шаг</h3>
                <p>Перезвоните сами, заблокируйте карту или не открывайте ссылку.</p>
              </div>
            </li>
          </ol>
          <div className="verdict-explainer">
            <span className="section-kicker">Так выглядит проверка</span>
            <div className="verdict-score-row">
              <span className="large-risk-icon">
                <WarningCircle weight="fill" />
              </span>
              <div>
                <small>Уровень риска</small>
                <strong>Высокий риск</strong>
              </div>
              <b>88 / 100</b>
            </div>
            <div className="verdict-reasons">
              <span>
                <WarningCircle /> Просят SMS-код
              </span>
              <span>
                <WarningCircle /> Торопят и пугают
              </span>
            </div>
            <div className="verdict-next">
              <CheckCircle weight="fill" />
              <div>
                <small>Следующий шаг</small>
                <strong>Завершите звонок и наберите официальный номер банка.</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        className="checks-section content-section"
        id="checks"
        aria-labelledby="checks-title"
      >
        <div className="section-heading">
          <span className="section-index">02 / Что мы проверяем</span>
          <h2 id="checks-title">
            Если что-то подозрительное —<br className="title-break" /> пришлите нам.
          </h2>
          <p>Четыре самые частые ситуации в Узбекистане и то, что сервис проверяет за секунды.</p>
        </div>
        <div className="checks-grid">
          {checkSurfaces.map((item, index) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="check-surface-card">
                <div className="card-topline">
                  <span>0{index + 1}</span>
                  <Icon />
                </div>
                <small>Болевая точка</small>
                <h3>{item.title}</h3>
                <blockquote>{item.example}</blockquote>
                <div className="card-answer">
                  <CheckCircle weight="fill" />
                  <p>{item.answer}</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="comparison-section content-section"
        id="examples"
        aria-labelledby="comparison-title"
      >
        <div className="section-heading split-heading">
          <div>
            <span className="section-index">03 / Реальные примеры</span>
            <h2 id="comparison-title">
              Как выглядит обман —<br className="title-break" /> и как пишет настоящий сервис.
            </h2>
          </div>
          <p>
            Сравните формулировки. Мошенники давят и ведут на чужой номер или ссылку; официальный
            сервис оставляет вам контроль.
          </p>
        </div>
        <div className="comparison-grid">
          <article className="comparison-card">
            <header>
              <span>01</span>
              <strong>SMS от «банка»</strong>
            </header>
            <div className="message-block bad">
              <small>Мошенник</small>
              <p>
                СРОЧНО! Подозрительная операция 4 500 000 сум. Если это не вы — звоните: +998 99
                412-87-03
              </p>
            </div>
            <div className="message-block good">
              <small>Как безопасно</small>
              <p>Покупка 89 000 сум · Korzinka · 14:32. Поддержка — номер на обороте карты.</p>
            </div>
            <footer>
              <WarningCircle /> Давление + незнакомый номер
            </footer>
          </article>
          <article className="comparison-card">
            <header>
              <span>02</span>
              <strong>Сообщение от «курьера»</strong>
            </header>
            <div className="message-block bad">
              <small>Мошенник</small>
              <p>Посылка не доставлена. Оплатите 27 000 сум, иначе вернём: uzpost-pay.top</p>
            </div>
            <div className="message-block good">
              <small>Как безопасно</small>
              <p>Посылка №RA12345UZ ожидает в отделении №7. Доплата не требуется. uzpost.uz</p>
            </div>
            <footer>
              <WarningCircle /> Чужой домен + срочная оплата
            </footer>
          </article>
        </div>
      </section>

      <section className="signals-section content-section" id="signals">
        <div className="signals-header">
          <div>
            <span className="section-index">04 / Карта схем</span>
            <h2>
              Что используют
              <br className="title-break" /> мошенники сейчас
            </h2>
            <p>Показываем повторяющиеся тактики: крючок, цель и безопасный следующий шаг.</p>
          </div>
          <div className="signal-stats">
            <span>
              <small>01</small>
              <strong>8</strong>
              <b>схем</b>
            </span>
            <span>
              <small>02</small>
              <strong>6</strong>
              <b>на контроле</b>
            </span>
            <span>
              <small>03</small>
              <strong>22</strong>
              <b>сигнала</b>
            </span>
          </div>
        </div>
        <div className="signals-list">
          {signals.map((signal, index) => (
            <a href="/scam-trends" className="signal-row" key={signal.title}>
              <span className="signal-number">0{index + 1}</span>
              <div>
                <span className="signal-category">{signal.category}</span>
                <h3>{signal.title}</h3>
                <p>{signal.action}</p>
              </div>
              <span
                className={
                  signal.status === "Высокий риск" ? "signal-status danger" : "signal-status"
                }
              >
                {signal.status}
              </span>
              <ArrowUpRight className="signal-arrow" />
            </a>
          ))}
        </div>
        <div className="scheme-tags" aria-label="Другие распространённые схемы">
          {schemeTags.map((tag) => (
            <span key={tag}>
              {tag} <Plus />
            </span>
          ))}
        </div>
      </section>

      <section className="official-section content-section" id="official">
        <div className="official-heading">
          <span className="official-icon">
            <Bank weight="fill" />
          </span>
          <span className="section-index light-index">05 / Проверенный справочник</span>
          <h2>
            Перезвоните сами.
            <br className="title-break" /> По номеру из справочника.
          </h2>
          <p>Контакты банков, платёжных систем, операторов и государственных служб Узбекистана.</p>
        </div>
        <div className="official-side">
          <div className="directory-stats">
            <div>
              <strong>{formatCount(verifiedContactsCount)}</strong>
              <span>проверенных контактов</span>
            </div>
            <div>
              <strong>{formatCount(callbackNumbersCount)}</strong>
              <span>номеров для звонка</span>
            </div>
            <div>
              <strong>{formatCount(bankLinesCount)}</strong>
              <span>банковских линий</span>
            </div>
          </div>
          <a className="dark-button" href="/official-numbers">
            Открыть справочник <ArrowRight />
          </a>
          <div className="official-warning">
            <ShieldCheck weight="fill" />
            <p>
              <strong>Важно:</strong> даже с официального номера банк не просит SMS-код, PIN, CVV,
              пароль или установку приложения.
            </p>
          </div>
        </div>
      </section>

      <section className="faq-section content-section" id="faq" aria-labelledby="faq-title">
        <div className="section-heading split-heading">
          <div>
            <span className="section-index">06 / Частые вопросы</span>
            <h2 id="faq-title">
              А что если
              <br className="title-break" /> уже случилось?
            </h2>
          </div>
          <p>
            Шесть ситуаций, с которыми чаще всего приходят пользователи. Для каждой — конкретное
            действие прямо сейчас.
          </p>
        </div>
        <div className="faq-list">
          {faqItems.map((item, index) => (
            <article key={item.q} className={faqOpen === index ? "faq-item is-open" : "faq-item"}>
              <button
                id={`faq-question-${index}`}
                type="button"
                className="faq-question"
                aria-expanded={faqOpen === index}
                aria-controls={`faq-answer-${index}`}
                onClick={() => setFaqOpen(faqOpen === index ? -1 : index)}
              >
                <span>0{index + 1}</span>
                <strong>{item.q}</strong>
                <span className="faq-plus">
                  <Plus />
                </span>
              </button>
              <div
                id={`faq-answer-${index}`}
                className="faq-answer"
                role="region"
                aria-labelledby={`faq-question-${index}`}
                aria-hidden={faqOpen !== index}
              >
                <div>
                  <small>Что делать</small>
                  <p>{item.a}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="privacy-section content-section" id="privacy">
        <div className="privacy-heading">
          <span className="privacy-icon">
            <LockKey weight="fill" />
          </span>
          <span className="section-index light-index">07 / Приватность</span>
          <h2>Ваши данные не становятся публичными.</h2>
          <p>
            Проверка работает без регистрации. Контакты маскируются, а коды и пароли не сохраняются.
          </p>
          <a href="/privacy">
            Полная политика приватности <ArrowRight />
          </a>
        </div>
        <div className="privacy-list">
          <div>
            <EyeSlash />
            <span>Полные номера маскируются до проверки</span>
          </div>
          <div>
            <Key />
            <span>OTP-коды и пароли никогда не сохраняются</span>
          </div>
          <div>
            <ImageSquare />
            <span>Скриншоты не попадают в публичную базу</span>
          </div>
          <div>
            <UserMinus />
            <span>Нет регистрации, профилей и слежения</span>
          </div>
        </div>
      </section>

      <section className="support-section content-section" id="help">
        <div className="report-panel">
          <div className="support-icon">
            <Megaphone weight="fill" />
          </div>
          <span className="section-index">08 / Сообщество</span>
          <h2>Ваша жалоба защищает других.</h2>
          <p>
            Опишите новую схему без личных данных. После модерации её признаки помогут предупреждать
            пользователей.
          </p>
          <QuickReportForm variant="signal" />
        </div>
        <div className="emergency-panel" id="emergency">
          <div className="support-icon danger-icon">
            <PhoneCall weight="fill" />
          </div>
          <span className="section-index danger-index">Срочно / Каждая минута важна</span>
          <h2>Уже отправили код или деньги?</h2>
          <p>Не ждите результата проверки. Сразу блокируйте карту и фиксируйте обращение.</p>
          <div className="emergency-contacts">
            {emergencyContacts.map((contact) => (
              <a key={contact.number} href={`tel:${contact.number}`}>
                <span>
                  <strong>{contact.number}</strong>
                  <b>{contact.title}</b>
                  <small>{contact.note}</small>
                </span>
                <ArrowUpRight />
              </a>
            ))}
          </div>
          <a className="emergency-guide" href="/emergency">
            Открыть пошаговую инструкцию <ArrowRight />
          </a>
        </div>
      </section>

      <footer className="site-footer" id="telegram">
        <div className="footer-main">
          <a className="brand footer-brand" href="#top">
            <span className="brand-mark">
              <ShieldCheck weight="fill" />
            </span>
            <span>Ishonch Guard</span>
          </a>
          <h2>
            Проверяйте до того,
            <br className="title-break" /> как поверить.
          </h2>
          <AnimatedCTA as="a" className="footer-check" href="#checker">
            Проверить риск <ArrowUpRight />
          </AnimatedCTA>
        </div>
        <div className="footer-meta">
          <p>
            Бесплатный антискам-помощник для Узбекистана.
            <br />
            Без регистрации · с маскированием данных · RU / UZ / EN
          </p>
          <nav>
            <a href="/privacy">Приватность</a>
            <a href="#help">Помощь</a>
            <a href="/emergency">Срочные шаги</a>
            <a href="/report">Сообщить</a>
            <a href="/appeal">Апелляция</a>
            <a href="/official-numbers">Номера</a>
            <a href="/scam-trends">Схемы</a>
            <a href="/embed">Виджет</a>
          </nav>
          <span>© 2026 ISHONCH GUARD · ТАШКЕНТ, UZ</span>
        </div>
      </footer>
    </main>
  );
}

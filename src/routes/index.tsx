import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, MessageSquare, Link2, FileWarning, ArrowRight, Sparkles, Users, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { CheckInput } from "@/components/CheckInput";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import { UnicornBackground } from "@/components/UnicornBackground";



export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ishonch Guard — проверьте номер, Telegram или ссылку до того, как вас обманут" },
      { name: "description", content: "Бесплатный антискам-помощник для Узбекистана. Вставьте подозрительное сообщение, номер, ссылку или Telegram username — получите оценку риска и шаги, что делать." },
      { property: "og:title", content: "Ishonch Guard — антискам-помощник для Узбекистана" },
      { property: "og:description", content: "Распознайте мошенников до того, как потеряете деньги." },
    ],
  }),
  component: Index,
});

function Index() {
  const { lang } = useLang();
  return (
    <div className="overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 space-y-10 md:space-y-12 lg:space-y-14 pt-8 md:pt-12">

        {/* HERO — GoLive style: warm off-white, soft pastel blooms, white input card with multicolor halo */}
        <section className="relative isolate flex flex-col items-center text-center pt-16 md:pt-24">
          {/* Pill tag */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-black/5 bg-white text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/55 shadow-sm mb-8 animate-fade-in-up">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            {{ ru: "Anti-Scam Intelligence · Tashkent", uz: "Anti-Scam Intelligence · Toshkent", en: "Anti-Scam Intelligence · Tashkent" }[lang]}
          </div>

          {/* Headline */}
          <h1 className="font-display font-extrabold tracking-tight leading-[1.02] text-5xl md:text-7xl lg:text-[88px] max-w-5xl animate-fade-in-up text-foreground">
            {{
              ru: <>Проверьте до того,<br /><span className="text-foreground/35">как обманут.</span></>,
              uz: <>Aldanmasdan oldin<br /><span className="text-foreground/35">tekshiring.</span></>,
              en: <>Check it before<br /><span className="text-foreground/35">you get scammed.</span></>,
            }[lang]}
          </h1>

          {/* Subheadline — tight like GoLive */}
          <p className="mt-7 text-base md:text-lg text-foreground/55 max-w-xl leading-relaxed font-medium animate-fade-in-up">
            {t("hero_sub", lang)}
          </p>

          {/* Trust bar — avatars + stars (GoLive's 4.8/5 row) */}
          <div className="mt-8 flex items-center gap-4 animate-fade-in-up">
            <div className="flex -space-x-2">
              {["bg-amber-200","bg-rose-200","bg-sky-200"].map((c,i)=>(
                <div key={i} className={`h-8 w-8 rounded-full ring-2 ring-[#FCFAF9] ${c}`} />
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground/70">
              <span className="text-foreground tracking-tight">★★★★★</span>
              <span className="text-foreground/50">{{ ru: "Бесплатно · За секунды · Без сохранения", uz: "Bepul · Soniyalarda · Saqlanmaydi", en: "Free · In seconds · No storage" }[lang]}</span>
            </div>
          </div>

          {/* Bloom band with form centered on top (GoLive-mockup style) */}
          <div className="w-full max-w-[1200px] mt-14 mb-12 animate-fade-in-up">
            <div className="relative isolate rounded-[28px] overflow-hidden h-[460px] md:h-[520px] bg-[#fde7d3]">
              <UnicornBackground
                projectId="pSxbKYCCk7vGhrLFRLrG"
                className="absolute inset-0 w-full h-full z-0 pointer-events-none"
              />
              <div
                aria-hidden
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(60% 50% at 50% 50%, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 70%)",
                }}
              />
              <div className="absolute inset-0 z-20 flex items-center justify-center px-4 md:px-10">
                <div className="w-full max-w-3xl cta-glow rounded-[22px]">
                  <div className="relative bg-white rounded-[22px] border border-black/[0.06] shadow-[0_30px_80px_-20px_rgba(11,11,15,0.35)]">
                    <CheckInput />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* MARQUEE — APEX: stripes texture + edge fade mask */}
        <section
          className="relative -mx-4 sm:-mx-6 overflow-hidden border-y border-[#E2E0D8] py-4 md:py-5 bg-white/55 backdrop-blur-[4px] apex-stripes"
          style={{
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0, #000 clamp(28px,8vw,80px), #000 calc(100% - clamp(28px,8vw,80px)), transparent 100%)",
            maskImage:
              "linear-gradient(to right, transparent 0, #000 clamp(28px,8vw,80px), #000 calc(100% - clamp(28px,8vw,80px)), transparent 100%)",
          }}
        >

          <div className="flex gap-12 whitespace-nowrap animate-marquee">
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex gap-12 shrink-0">
                {[
                  "Безопасный счёт", "Bank security call", "Fake APK", "OTP request", "Telegram loan",
                  "Soxta kuryer", "Prize phishing", "Crypto doubler", "Job offer scam", "Romance scam",
                  "Безопасный счёт", "Bank security call", "Fake APK", "OTP request",
                ].map((w, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center gap-12 text-xl md:text-2xl font-sans font-medium tracking-tight text-[#A1A1AA]">
                    {w}
                    <span className="text-[#F97316] text-2xl md:text-3xl">×</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>


        {/* CAPABILITIES — APEX grid inside a striped frame with corner ticks */}
        <section className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[8px] p-6 md:p-10 bg-white/30">
          <div className="flex items-start justify-between mb-3">
            <span className="apex-mono">BUILD V3.1 · CAPABILITIES</span>
            <span className="apex-mono">CORE SYSTEMS: ONLINE</span>
          </div>
          <div className="flex items-end justify-between mb-10 gap-6 pb-6 border-b border-[#E2E0D8]">
            <div>
              <p className="label-md mb-3">02 — {{ ru: "Возможности", uz: "Imkoniyatlar", en: "Capabilities" }[lang]}</p>
              <h2 className="font-sans font-medium text-4xl md:text-6xl tracking-[-0.05em] leading-[0.95] text-[#18181B]">
                {{
                  ru: <>Что <span className="font-serif-italic text-[#A1A1AA]">можно</span> проверить</>,
                  uz: <>Nimani <span className="font-serif-italic text-[#A1A1AA]">tekshirish</span> mumkin</>,
                  en: <>What you <span className="font-serif-italic text-[#A1A1AA]">can</span> check</>,
                }[lang]}
              </h2>
            </div>
            <span className="hidden md:block apex-mono">04 / 04</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
            {[
              { i: Phone, accent: "#F97316", k: { ru: "Номер телефона", uz: "Telefon raqami", en: "Phone number" },
                d: { ru: "«Банки», «операторы» или анонимные мошенники.", uz: "«Bank», «operator» yoki noma'lum raqamlar.", en: "“Banks”, “operators” or anonymous scammers." } },
              { i: MessageSquare, accent: "#EC4899", k: { ru: "Telegram-аккаунт", uz: "Telegram hisob", en: "Telegram account" },
                d: { ru: "Боты, каналы или псевдо-менеджеры банков.", uz: "Botlar, kanallar yoki soxta menejerlar.", en: "Bots, channels or fake account managers." } },
              { i: Link2, accent: "#6366F1", k: { ru: "Ссылки и сайты", uz: "Havolalar va saytlar", en: "Links & sites" },
                d: { ru: "Фишинг, ложные оплаты и вредоносные APK.", uz: "Fishing, soxta to'lovlar va zararli APK.", en: "Phishing, fake payments and malicious APKs." } },
              { i: FileWarning, accent: "#F97316", k: { ru: "Текст SMS / Telegram", uz: "SMS / Telegram matni", en: "SMS / Telegram text" },
                d: { ru: "Анализ сообщений на признаки соц. инженерии.", uz: "Xabarlarni ijtimoiy muhandislik belgilariga tekshirish.", en: "Analyze messages for social engineering patterns." } },
            ].map((c, idx) => (
              <div key={c.k.en} className="group relative bg-white/70 backdrop-blur-[4px] p-8 hover:bg-white transition-colors duration-300 overflow-hidden">
                <span className="absolute top-5 right-5 apex-mono">0{idx + 1}</span>
                <div className="flex items-center justify-center w-10 h-10 rounded-[3px] border border-[#E2E0D8] mb-12 transition-colors" style={{ color: c.accent }}>
                  <c.i className="h-4 w-4" strokeWidth={1.5} />
                </div>
                <h3 className="font-sans text-[15px] font-medium mb-2 tracking-tight text-[#18181B]">{c.k[lang]}</h3>
                <p className="text-[13px] text-[#A1A1AA] leading-relaxed">{c.d[lang]}</p>
                <ArrowRight className="absolute bottom-5 right-5 h-3.5 w-3.5 text-[#A1A1AA] -rotate-45 group-hover:rotate-0 group-hover:text-[#F97316] transition-all" strokeWidth={1.5} />
              </div>
            ))}
          </div>
        </section>


        {/* HOW IT WORKS — APEX striped surface panel */}
        <section className="apex-frame apex-stripes relative overflow-hidden border border-[#E2E0D8] bg-[#F4F2EB] rounded-[8px]">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#6366F1] z-[1]" />
          <div className="relative p-10 md:p-16">
            <div className="flex items-center justify-between mb-6">
              <span className="apex-mono">SYS · ALGORITHM</span>
              <span className="apex-mono">03 / 03 STEPS</span>
            </div>
            <p className="label-md mb-3">03 — {{ ru: "Алгоритм", uz: "Algoritm", en: "Algorithm" }[lang]}</p>
            <h2 className="font-sans font-medium text-4xl md:text-5xl tracking-[-0.05em] leading-[0.95] mb-14 text-[#18181B] max-w-3xl">{t("how_it_works", lang)}</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
              {[
                { i: "01", t: t("step_1", lang), d: t("step_1_d", lang) },
                { i: "02", t: t("step_2", lang), d: t("step_2_d", lang) },
                { i: "03", t: t("step_3", lang), d: t("step_3_d", lang) },
              ].map((s) => (
                <div key={s.i} className="bg-[#F4F2EB] p-8 space-y-5 apex-stripes-soft">
                  <span className="block font-sans text-5xl font-medium tracking-[-0.05em] text-[#E2E0D8]">{s.i}</span>
                  <h3 className="font-sans text-xl font-medium tracking-tight text-[#18181B]">{s.t}</h3>
                  <p className="text-[#A1A1AA] text-[13px] leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* EXAMPLE — APEX striped frame around the demo */}
        <section className="apex-frame apex-stripes-soft border border-[#E2E0D8] rounded-[8px] p-6 md:p-10 bg-white/30">
          <div className="flex items-center justify-between mb-8">
            <span className="apex-mono">CASE STUDY · DEMO</span>
            <span className="apex-mono">RISK · LIVE</span>
          </div>
          <div className="text-center mb-14">
            <p className="label-md mb-3">04 — {{ ru: "Пример работы", uz: "Ish misoli", en: "Example" }[lang]}</p>
            <h2 className="font-sans font-medium text-4xl md:text-5xl tracking-[-0.05em] leading-[0.95] max-w-2xl mx-auto text-[#18181B]">
              {t("example_title", lang)}
            </h2>
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="apex-glass p-8 rounded-[8px]">
              <p className="label-md mb-5">{{ ru: "Входящий текст", uz: "Kirish matni", en: "Incoming text" }[lang]}</p>
              <p className="text-[15px] leading-relaxed text-[#18181B] italic border-l-2 border-[#F97316] pl-5">
                {{
                  ru: "«Здравствуйте, это служба безопасности банка. По вашей карте подозрительная операция. Срочно назовите код из SMS…»",
                  uz: "«Assalomu alaykum, bu bank xavfsizlik xizmati. Kartangiz bo'yicha shubhali amaliyot. Tezda SMS-kodni ayting…»",
                  en: "“Hello, this is the bank security service. A suspicious transaction was detected on your card. Tell us the SMS code now…”",
                }[lang]}
              </p>
              <p className="mt-7 text-[13px] text-[#A1A1AA] leading-relaxed">
                {{ ru: "Мы объясняем, почему сообщение выглядит подозрительным, и какие конкретные шаги предпринять.",
                   uz: "Xabar nima uchun shubhali ekani va aniq qadamlarni tushuntiramiz.",
                   en: "We explain why the message looks suspicious and which exact steps to take." }[lang]}
              </p>
            </div>

            {/* Gradient-shell card — APEX signature technique */}
            <div className="apex-shell">
              <div className="relative bg-white p-8">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-[11px] font-medium tracking-[0.1em] uppercase mb-2 bg-gradient-to-r from-[#F97316] via-[#EC4899] to-[#6366F1] bg-clip-text text-transparent">Risk score · 98%</p>
                    <h3 className="font-sans text-3xl md:text-4xl font-medium tracking-[-0.05em] text-[#18181B]">{t("risk_high", lang)}</h3>
                  </div>
                  <div className="w-11 h-11 rounded-[3px] border border-[#E2E0D8] flex items-center justify-center text-[#F97316]">
                    <ShieldAlert className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                </div>

                <div className="space-y-7">
                  <div>
                    <p className="label-md mb-3">{t("why_title", lang)}</p>
                    <ul className="space-y-2.5 text-[13px] text-[#18181B]">
                      {(({
                        ru: ["Просят SMS-код (OTP)", "Представляются банком", "Создают срочность и давление", "Похожая схема уже в жалобах"],
                        uz: ["SMS-kod (OTP) so'rashmoqda", "Bank nomidan murojaat", "Shoshilinchlik va bosim", "Shu sxema shikoyatlarda uchragan"],
                        en: ["They ask for an SMS code (OTP)", "They impersonate a bank", "Urgency and pressure", "Similar pattern already reported"],
                      })[lang]).map((r) => (
                        <li key={r} className="flex items-center gap-3">
                          <span className="h-1 w-1 rounded-full bg-[#F97316] shrink-0" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-6 border-t border-[#E2E0D8]">
                    <p className="label-md mb-3">{t("what_to_do", lang)}</p>
                    <div className="space-y-2">
                      {(({
                        ru: ["Не отправляйте код", "Завершите разговор", "Позвоните в банк по номеру с карты"],
                        uz: ["Kodni yubormang", "Suhbatni tugating", "Bankka kartadagi raqam orqali qo'ng'iroq qiling"],
                        en: ["Don't send the code", "End the call", "Call the bank using the number on your card"],
                      })[lang]).map((r, i) => (
                        <div key={r} className="flex items-center gap-3 px-3 py-2.5 rounded-[3px] bg-[#F4F2EB] border border-[#E2E0D8] text-[13px]">
                          <span className="text-[#A1A1AA] text-[11px] font-mono">0{i + 1}</span>
                          <span className="text-[#18181B]">{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KNOWLEDGE BASE — APEX striped frame */}
        <section className="apex-frame apex-stripes border border-[#E2E0D8] rounded-[8px] p-6 md:p-10 bg-white/30">
          <div className="flex items-center justify-between mb-6">
            <span className="apex-mono">DB · SCAM CASES</span>
            <span className="apex-mono">INDEX 06 / 06</span>
          </div>
          <div className="flex items-end justify-between mb-10 gap-6 pb-6 border-b border-[#E2E0D8]">
            <div>
              <p className="label-md mb-3">05 — {{ ru: "База знаний", uz: "Bilimlar bazasi", en: "Knowledge base" }[lang]}</p>
              <h2 className="font-sans font-medium text-4xl md:text-5xl tracking-[-0.05em] leading-[0.95] max-w-3xl text-[#18181B]">{t("schemes_title", lang)}</h2>
            </div>
            <span className="hidden md:block apex-mono">06 cases</span>
          </div>


          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-[#E2E0D8] border border-[#E2E0D8]">
            {([
              { n: "01", ru: "«Служба безопасности банка»", uz: "«Bank xavfsizlik xizmati»", en: "Bank security call",
                d_ru: "Звонят якобы из банка, говорят о подозрительной операции и просят SMS-код.", d_uz: "Bank nomidan qo'ng'iroq qilib, SMS-kod so'rashadi.", d_en: "They call “from the bank” and ask for your SMS code." },
              { n: "02", ru: "APK от мнимого банка", uz: "Soxta bank APK", en: "Fake bank APK",
                d_ru: "Просят установить «безопасное приложение» — оно крадёт SMS и данные.", d_uz: "«Xavfsiz ilova» o'rnatishni so'rashadi — u SMS o'g'irlaydi.", d_en: "They push a “safe app” that steals SMS and data." },
              { n: "03", ru: "Безопасный счёт", uz: "Xavfsiz hisob", en: "Safe account",
                d_ru: "Уговаривают перевести деньги на «безопасный счёт». Их не существует.", d_uz: "«Xavfsiz hisob»ga pul o'tkazishga undashadi.", d_en: "They push you to move money to a “safe account”." },
              { n: "04", ru: "Лёгкий кредит в Telegram", uz: "Telegram'dagi oson kredit", en: "Easy Telegram loan",
                d_ru: "Telegram-канал обещает быстрый кредит, просит предоплату.", d_uz: "Telegram kanali kredit va'da qilib oldindan to'lov so'raydi.", d_en: "A Telegram channel promises a quick loan, asks a fee upfront." },
              { n: "05", ru: "Фейковая доставка", uz: "Soxta yetkazib berish", en: "Fake delivery",
                d_ru: "«Курьер» отправляет ссылку для оплаты доставки — это фишинг карты.", d_uz: "«Kuryer» to'lov havolasini yuboradi — bu fishing.", d_en: "A “courier” sends a payment link — card phishing." },
              { n: "06", ru: "Выигрыш / приз", uz: "Yutuq / sovrin", en: "Prize won",
                d_ru: "Сообщают о выигрыше и просят данные карты для «зачисления».", d_uz: "Yutuq haqida xabar berib karta ma'lumotlarini so'rashadi.", d_en: "They claim you won and ask for card details." },
            ] as const).map((s) => (
              <div key={s.en} className="group bg-white/70 backdrop-blur-[4px] p-8 hover:bg-white transition-colors duration-300">
                <p className="text-[10px] font-mono text-[#A1A1AA] tracking-[0.1em] mb-5">CASE #{s.n}</p>
                <h3 className="font-sans text-[15px] font-medium mb-3 tracking-tight text-[#18181B] group-hover:text-[#F97316] transition-colors">{s[lang]}</h3>
                <p className="text-[13px] text-[#A1A1AA] leading-relaxed">
                  {(s as never as Record<string, string>)["d_" + lang]}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA pair — APEX: one gradient-shell (emergency), one flat surface (community) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          <div className="apex-shell">
            <div className="relative bg-white p-10 md:p-12 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <span className="label-md text-[#F97316]">[ Emergency ]</span>
                <AlertTriangle className="h-5 w-5 text-[#F97316]" strokeWidth={1.5} />
              </div>
              <h3 className="font-sans text-3xl md:text-4xl font-medium tracking-[-0.05em] mb-4 text-[#18181B]">{t("emergency_title", lang)}</h3>
              <p className="text-[#A1A1AA] text-[13px] leading-relaxed mb-8 max-w-sm">
                {{ ru: "Если вы уже отправили SMS-код, установили APK или перевели деньги — время идёт на минуты.",
                   uz: "Agar SMS-kod yuborgan, APK o'rnatgan yoki pul o'tkazgan bo'lsangiz — vaqt daqiqalar bilan o'lchanadi.",
                   en: "If you already sent an SMS code, installed an APK or transferred money — every minute counts." }[lang]}
              </p>
              <Link to="/emergency" className="inline-flex items-center gap-2 px-4 py-2 rounded-[3px] bg-[#F4F2EB] hover:bg-[#18181B] hover:text-white text-[#27272A] text-[12px] font-medium tracking-[0.1em] uppercase transition-all border border-[#E2E0D8]">
                {t("emergency_cta", lang)} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
              </Link>
            </div>
          </div>

          <div className="relative bg-[#F4F2EB] border border-[#E2E0D8] rounded-[8px] p-10 md:p-12 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#6366F1] via-[#EC4899] to-[#F97316]" />
            <div className="flex items-center justify-between mb-6">
              <span className="label-md">[ Community ]</span>
              <Users className="h-5 w-5 text-[#6366F1]" strokeWidth={1.5} />
            </div>
            <h3 className="font-sans text-3xl md:text-4xl font-medium tracking-[-0.05em] mb-4 text-[#18181B]">
              {{ ru: "Помогите защитить других", uz: "Boshqalarni himoya qiling", en: "Help protect others" }[lang]}
            </h3>
            <p className="text-[#A1A1AA] text-[13px] leading-relaxed mb-8 max-w-sm">
              {{ ru: "Каждая жалоба проходит модерацию и помогает системе обучиться и предупредить тысячи пользователей.",
                 uz: "Har bir shikoyat moderatsiyadan o'tadi va tizimni o'rgatadi.",
                 en: "Every report is moderated and helps the system learn and warn thousands." }[lang]}
            </p>
            <Link to="/report" className="inline-flex items-center gap-2 px-4 py-2 rounded-[3px] bg-[#18181B] hover:bg-[#F97316] text-white text-[12px] font-medium tracking-[0.1em] uppercase transition-all">
              {t("report_btn", lang)} <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.5} />
            </Link>
          </div>
        </section>

        {/* APEX-style footer band: ghost wordmark + status meta */}
        <section className="apex-frame apex-stripes-soft border-t border-[#E2E0D8] mt-4 pt-10 pb-6 -mx-6 px-6">
          <div className="flex items-start justify-between mb-10">
            <div className="space-y-1">
              <p className="apex-mono">BUILD V3.1</p>
              <p className="apex-mono">CORE SYSTEMS: ONLINE</p>
            </div>
            <div className="text-right space-y-1">
              <p className="apex-mono">{{ ru: "ТАШКЕНТ · UZ", uz: "TOSHKENT · UZ", en: "TASHKENT · UZ" }[lang]}</p>
              <p className="apex-mono">© 2025 ISHONCH GUARD</p>
            </div>
          </div>
          <div className="apex-wordmark text-[26vw] md:text-[18vw] leading-none select-none pointer-events-none">
            ISHONCH.
          </div>
          <div className="mt-8 flex items-center justify-center gap-3 label-md">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>{{ ru: "Без сохранения · За секунды · Бесплатно", uz: "Saqlanmaydi · Soniyalarda · Bepul", en: "No storage · In seconds · Free" }[lang]}</span>
            <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
          </div>
        </section>

      </div>
    </div>
  );
}


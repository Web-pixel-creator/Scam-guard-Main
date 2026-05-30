import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, MessageSquare, Link2, FileWarning, ArrowRight, Sparkles, Users, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import { CheckInput } from "@/components/CheckInput";
import { useLang } from "@/lib/lang-context";
import { t } from "@/lib/i18n";
import heroBloom from "@/assets/hero-bloom.jpg";


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
      <div className="max-w-[1400px] mx-auto px-6 space-y-28 md:space-y-32 pt-10 md:pt-14">

        {/* HERO — GoLive style: warm off-white, soft pastel blooms, white input card with multicolor halo */}
        <section className="relative isolate flex flex-col items-center text-center pt-16 md:pt-24 overflow-visible">
          {/* Painterly bloom backdrop (full-width, behind form area) */}
          <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-screen -z-10 overflow-hidden">
            <img
              src={heroBloom}
              alt=""
              aria-hidden
              className="absolute left-1/2 -translate-x-1/2 top-[42%] w-[min(1500px,108vw)] h-[760px] object-cover rounded-[48px] opacity-95"
              style={{ filter: "saturate(1.05)" }}
            />
            {/* Edge fades into the page bg */}
            <div className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(60% 55% at 50% 45%, transparent 0%, transparent 35%, rgba(252,250,249,0.55) 65%, #FCFAF9 90%)",
              }}
            />
            {/* Top + bottom soft wash */}
            <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#FCFAF9] to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#FCFAF9] to-transparent" />
          </div>


          {/* Pill tag */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-black/5 bg-white/70 backdrop-blur-md text-[10px] font-bold tracking-[0.2em] uppercase text-foreground/55 shadow-sm mb-8 animate-fade-in-up">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            {{ ru: "Anti-Scam Intelligence · Tashkent", uz: "Anti-Scam Intelligence · Toshkent", en: "Anti-Scam Intelligence · Tashkent" }[lang]}
          </div>

          {/* Headline */}
          <h1 className="font-display font-extrabold tracking-tight leading-[1.05] text-5xl md:text-7xl lg:text-[88px] max-w-5xl animate-fade-in-up text-foreground">
            {{
              ru: <>Проверьте до того,<br /><span className="text-foreground/35">как обманут.</span></>,
              uz: <>Aldanmasdan oldin<br /><span className="text-foreground/35">tekshiring.</span></>,
              en: <>Check it before<br /><span className="text-foreground/35">you get scammed.</span></>,
            }[lang]}
          </h1>

          {/* Subheadline */}
          <p className="mt-7 text-lg md:text-xl text-foreground/55 max-w-2xl leading-relaxed font-medium animate-fade-in-up">
            {t("hero_sub", lang)}
          </p>

          {/* Hero focal point: CheckInput card with GoLive multicolor halo */}
          <div className="w-full max-w-3xl mt-12 animate-fade-in-up">
            <div className="cta-glow rounded-[28px]">
              <div className="relative bg-white rounded-[28px] border border-black/[0.06] shadow-[0_20px_60px_-20px_rgba(11,11,15,0.12)]">
                <CheckInput />
              </div>
            </div>
          </div>

          {/* Trust micro-bar */}
          <div className="mt-10 mb-16 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium text-foreground/50 animate-fade-in-up">
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />{{ ru: "Без сохранения", uz: "Saqlanmaydi", en: "No storage" }[lang]}</span>
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />{{ ru: "За секунды", uz: "Soniyalarda", en: "In seconds" }[lang]}</span>
            <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />{{ ru: "Бесплатно", uz: "Bepul", en: "Free" }[lang]}</span>
          </div>
        </section>

        {/* MARQUEE — scam patterns ticker */}
        <section className="relative -mx-6 overflow-hidden border-y border-border py-6 bg-white/60">
          <div className="flex gap-12 whitespace-nowrap animate-marquee">
            {[...Array(2)].map((_, dup) => (
              <div key={dup} className="flex gap-12 shrink-0">
                {[
                  "Безопасный счёт", "Bank security call", "Fake APK", "OTP request", "Telegram loan",
                  "Soxta kuryer", "Prize phishing", "Crypto doubler", "Job offer scam", "Romance scam",
                  "Безопасный счёт", "Bank security call", "Fake APK", "OTP request",
                ].map((w, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center gap-12 text-2xl md:text-3xl font-display font-extrabold tracking-tight text-foreground/25">
                    {w}
                    <span className="font-serif-italic text-rose-400/70 text-3xl md:text-4xl">×</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </section>


        {/* CAPABILITIES */}
        <section>
          <div className="flex items-end justify-between mb-12 gap-6">
            <div>
              <p className="text-primary label-md mb-3">02 · {{ ru: "Возможности", uz: "Imkoniyatlar", en: "Capabilities" }[lang]}</p>
              <h2 className="font-display text-4xl md:text-6xl tracking-tight">
                {{
                  ru: <>Что <span className="font-serif-italic text-foreground/70">можно</span> проверить</>,
                  uz: <>Nimani <span className="font-serif-italic text-foreground/70">tekshirish</span> mumkin</>,
                  en: <>What you <span className="font-serif-italic text-foreground/70">can</span> check</>,
                }[lang]}
              </h2>
            </div>
            <span className="hidden md:block text-foreground/40 text-sm font-mono">04 / 04</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { i: Phone, color: "bg-blue-500/10 text-blue-400", k: { ru: "Номер телефона", uz: "Telefon raqami", en: "Phone number" },
                d: { ru: "«Банки», «операторы» или анонимные мошенники.", uz: "«Bank», «operator» yoki noma'lum raqamlar.", en: "“Banks”, “operators” or anonymous scammers." } },
              { i: MessageSquare, color: "bg-indigo-500/10 text-indigo-400", k: { ru: "Telegram-аккаунт", uz: "Telegram hisob", en: "Telegram account" },
                d: { ru: "Боты, каналы или псевдо-менеджеры банков.", uz: "Botlar, kanallar yoki soxta menejerlar.", en: "Bots, channels or fake account managers." } },
              { i: Link2, color: "bg-emerald-500/10 text-emerald-400", k: { ru: "Ссылки и сайты", uz: "Havolalar va saytlar", en: "Links & sites" },
                d: { ru: "Фишинг, ложные оплаты и вредоносные APK.", uz: "Fishing, soxta to'lovlar va zararli APK.", en: "Phishing, fake payments and malicious APKs." } },
              { i: FileWarning, color: "bg-amber-500/10 text-amber-400", k: { ru: "Текст SMS / Telegram", uz: "SMS / Telegram matni", en: "SMS / Telegram text" },
                d: { ru: "Анализ сообщений на признаки соц. инженерии.", uz: "Xabarlarni ijtimoiy muhandislik belgilariga tekshirish.", en: "Analyze messages for social engineering patterns." } },
            ].map((c, idx) => (
              <div key={c.k.en} className="group relative p-7 rounded-3xl bg-card border border-border card-hover overflow-hidden">
                <span className="absolute top-5 right-5 text-[10px] font-mono text-foreground/30">0{idx + 1}</span>
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-16 group-hover:scale-110 transition-transform ${c.color}`}>
                  <c.i className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="font-display text-lg font-bold mb-2 tracking-tight">{c.k[lang]}</h3>
                <p className="text-sm text-foreground/55 leading-relaxed">{c.d[lang]}</p>
                <ArrowRight className="absolute bottom-5 right-5 h-4 w-4 text-foreground/20 -rotate-45 group-hover:rotate-0 group-hover:text-primary transition-all" />
              </div>
            ))}
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="rounded-[40px] bg-secondary border border-border p-10 md:p-16 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-2/3 h-full bg-primary/10 blur-[140px] rounded-full pointer-events-none" />
          <div className="relative">
            <p className="text-primary label-md mb-3">03 · {{ ru: "Алгоритм", uz: "Algoritm", en: "Algorithm" }[lang]}</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight mb-14">{t("how_it_works", lang)}</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-16">
              {[
                { i: "01", t: t("step_1", lang), d: t("step_1_d", lang) },
                { i: "02", t: t("step_2", lang), d: t("step_2_d", lang) },
                { i: "03", t: t("step_3", lang), d: t("step_3_d", lang) },
              ].map((s, idx) => (
                <div key={s.i} className={`space-y-5 ${idx > 0 ? "md:border-l md:border-border md:pl-10" : ""}`}>
                  <span className="block font-display text-5xl font-extrabold text-foreground/10">{s.i}</span>
                  <h3 className="font-display text-2xl font-bold tracking-tight">{s.t}</h3>
                  <p className="text-foreground/60 text-sm leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* EXAMPLE */}
        <section>
          <div className="text-center mb-14">
            <p className="text-primary label-md mb-3">04 · {{ ru: "Пример работы", uz: "Ish misoli", en: "Example" }[lang]}</p>
            <h2 className="font-display text-4xl md:text-5xl tracking-tight max-w-2xl mx-auto">
              {t("example_title", lang)}
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div className="p-8 rounded-3xl bg-card border border-border">
              <p className="text-[11px] font-bold tracking-[0.2em] text-foreground/50 uppercase mb-5">{{ ru: "Входящий текст", uz: "Kirish matni", en: "Incoming text" }[lang]}</p>
              <p className="text-base leading-relaxed text-foreground/85 italic border-l-2 border-primary pl-5">
                {{
                  ru: "«Здравствуйте, это служба безопасности банка. По вашей карте подозрительная операция. Срочно назовите код из SMS…»",
                  uz: "«Assalomu alaykum, bu bank xavfsizlik xizmati. Kartangiz bo'yicha shubhali amaliyot. Tezda SMS-kodni ayting…»",
                  en: "“Hello, this is the bank security service. A suspicious transaction was detected on your card. Tell us the SMS code now…”",
                }[lang]}
              </p>
              <p className="mt-7 text-sm text-foreground/60 leading-relaxed">
                {{ ru: "Мы объясняем, почему сообщение выглядит подозрительным, и какие конкретные шаги предпринять.",
                   uz: "Xabar nima uchun shubhali ekani va aniq qadamlarni tushuntiramiz.",
                   en: "We explain why the message looks suspicious and which exact steps to take." }[lang]}
              </p>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 bg-red-500/15 blur-3xl rounded-full pointer-events-none" />
              <div className="relative p-8 rounded-3xl bg-card border border-red-500/30 shadow-[0_30px_80px_-20px_rgba(220,38,38,0.18)]">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <p className="text-[11px] font-bold text-red-400 tracking-[0.2em] uppercase mb-2">Risk score · 98%</p>
                    <h3 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight">{t("risk_high", lang)}</h3>
                  </div>
                  <div className="w-12 h-12 rounded-full border-2 border-red-500/40 flex items-center justify-center text-red-400">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                </div>

                <div className="space-y-7">
                  <div>
                    <p className="text-[11px] font-bold text-foreground/50 tracking-[0.2em] uppercase mb-3">{t("why_title", lang)}</p>
                    <ul className="space-y-2.5 text-sm text-foreground/85">
                      {(({
                        ru: ["Просят SMS-код (OTP)", "Представляются банком", "Создают срочность и давление", "Похожая схема уже в жалобах"],
                        uz: ["SMS-kod (OTP) so'rashmoqda", "Bank nomidan murojaat", "Shoshilinchlik va bosim", "Shu sxema shikoyatlarda uchragan"],
                        en: ["They ask for an SMS code (OTP)", "They impersonate a bank", "Urgency and pressure", "Similar pattern already reported"],
                      })[lang]).map((r) => (
                        <li key={r} className="flex items-center gap-3">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="pt-6 border-t border-border">
                    <p className="text-[11px] font-bold text-foreground/50 tracking-[0.2em] uppercase mb-3">{t("what_to_do", lang)}</p>
                    <div className="space-y-2">
                      {(({
                        ru: ["Не отправляйте код", "Завершите разговор", "Позвоните в банк по номеру с карты"],
                        uz: ["Kodni yubormang", "Suhbatni tugating", "Bankka kartadagi raqam orqali qo'ng'iroq qiling"],
                        en: ["Don't send the code", "End the call", "Call the bank using the number on your card"],
                      })[lang]).map((r, i) => (
                        <div key={r} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-secondary border border-border text-sm font-medium">
                          <span className="text-foreground/40 text-xs font-mono">{i + 1}.</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KNOWLEDGE BASE */}
        <section>
          <div className="flex items-end justify-between mb-12 gap-6">
            <div>
              <p className="text-primary label-md mb-3">05 · {{ ru: "База знаний", uz: "Bilimlar bazasi", en: "Knowledge base" }[lang]}</p>
              <h2 className="font-display text-4xl md:text-5xl tracking-tight max-w-3xl">{t("schemes_title", lang)}</h2>
            </div>
            <span className="hidden md:block text-foreground/40 text-sm font-mono">06 CASES</span>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
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
              <div key={s.en} className="group p-7 rounded-3xl bg-card border border-border hover:border-primary/40 transition-all">
                <p className="text-[10px] font-mono text-foreground/40 mb-5">CASE #{s.n}</p>
                <h3 className="font-display text-lg font-bold mb-3 tracking-tight group-hover:text-primary transition-colors">{s[lang]}</h3>
                <p className="text-sm text-foreground/60 leading-relaxed">
                  {(s as never as Record<string, string>)["d_" + lang]}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA pair */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-8">
          <div className="relative p-10 md:p-12 rounded-[40px] bg-card border border-red-500/30 overflow-hidden">
            <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-red-500/15 blur-3xl rounded-full pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <span className="text-red-400 label-md">[ Emergency ]</span>
                <AlertTriangle className="h-5 w-5 text-red-400/60" />
              </div>
              <h3 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mb-4">{t("emergency_title", lang)}</h3>
              <p className="text-foreground/60 text-sm leading-relaxed mb-8 max-w-sm">
                {{ ru: "Если вы уже отправили SMS-код, установили APK или перевели деньги — время идёт на минуты.",
                   uz: "Agar SMS-kod yuborgan, APK o'rnatgan yoki pul o'tkazgan bo'lsangiz — vaqt daqiqalar bilan o'lchanadi.",
                   en: "If you already sent an SMS code, installed an APK or transferred money — every minute counts." }[lang]}
              </p>
              <Link to="/emergency" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-all">
                {t("emergency_cta", lang)} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="relative p-10 md:p-12 rounded-[40px] bg-card border border-border overflow-hidden">
            <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-primary/15 blur-3xl rounded-full pointer-events-none" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <span className="text-primary label-md">[ Community ]</span>
                <Users className="h-5 w-5 text-primary/60" />
              </div>
              <h3 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight mb-4">
                {{ ru: "Помогите защитить других", uz: "Boshqalarni himoya qiling", en: "Help protect others" }[lang]}
              </h3>
              <p className="text-foreground/60 text-sm leading-relaxed mb-8 max-w-sm">
                {{ ru: "Каждая жалоба проходит модерацию и помогает системе обучиться и предупредить тысячи пользователей.",
                   uz: "Har bir shikoyat moderatsiyadan o'tadi va tizimni o'rgatadi.",
                   en: "Every report is moderated and helps the system learn and warn thousands." }[lang]}
              </p>
              <Link to="/report" className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-foreground text-background hover:bg-primary hover:text-white text-sm font-bold transition-all">
                {t("report_btn", lang)} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* trust strip */}
        <section className="py-8 flex items-center justify-center gap-3 text-[11px] font-bold tracking-[0.2em] text-foreground/40 uppercase">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{{ ru: "Без сохранения · За секунды · Бесплатно", uz: "Saqlanmaydi · Soniyalarda · Bepul", en: "No storage · In seconds · Free" }[lang]}</span>
          <Sparkles className="h-3.5 w-3.5" />
        </section>

      </div>
    </div>
  );
}

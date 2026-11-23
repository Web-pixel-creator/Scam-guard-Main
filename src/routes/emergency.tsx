import { createFileRoute } from "@tanstack/react-router";
import {
  DeviceMobile,
  Key,
  Megaphone,
  Money,
  PhoneCall,
  WarningCircle,
} from "@phosphor-icons/react";
import { UrgentPlans } from "@/components/home/blocks";
import { Callout, PageHero, Pill, RowHead } from "@/components/viper/kit";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/emergency")({
  component: EmergencyPage,
});

const GUIDES = {
  ru: [
    {
      icon: Key,
      title: "Отправили SMS-код / OTP",
      steps: [
        "Срочно позвоните в банк по номеру с обратной стороны карты.",
        "Заблокируйте карту и онлайн-банк, смените пароль.",
        "Проверьте активные сессии в Telegram (Настройки → Устройства) и завершите чужие.",
        "Сохраните скриншоты переписки и номер.",
        "Сообщите о случае в Ishonch Guard.",
      ],
    },
    {
      icon: DeviceMobile,
      title: "Установили APK / приложение",
      steps: [
        "Отключите интернет (Wi-Fi и мобильный) на устройстве.",
        "Удалите подозрительное приложение и связанные с ним.",
        "С другого устройства смените пароли банка, почты и Telegram.",
        "Включите двухфакторку, где её ещё нет.",
        "Лучше сделать сброс к заводским настройкам и восстановить чистый бэкап.",
        "Позвоните в банк и сообщите о возможной компрометации.",
      ],
    },
    {
      icon: Money,
      title: "Перевели деньги",
      steps: [
        "Сразу позвоните в свой банк и попросите попытаться отозвать перевод.",
        "Зафиксируйте всё: чек, скриншоты, номер телефона, Telegram, ссылки.",
        "Подайте заявление в правоохранительные органы — чем раньше, тем выше шанс возврата.",
        "Не продолжайте общение с мошенником, не отправляйте «комиссии за возврат».",
      ],
    },
  ],
  uz: [
    {
      icon: Key,
      title: "SMS-kod / OTP yubordingiz",
      steps: [
        "Karta orqa tomonidagi raqam bo‘yicha bankka darhol qo‘ng‘iroq qiling.",
        "Karta va onlayn-bankni bloklang, parolni o‘zgartiring.",
        "Telegram → Sozlamalar → Qurilmalar bo‘limida begona seanslarni yopib qo‘ying.",
        "Yozishmalar skrinshotini va raqamni saqlang.",
        "Ishonch Guard’ga xabar bering.",
      ],
    },
    {
      icon: DeviceMobile,
      title: "APK / ilova o‘rnatdingiz",
      steps: [
        "Wi-Fi va mobil internetni o‘chirib qo‘ying.",
        "Shubhali ilova va u bilan bog‘liq narsalarni o‘chiring.",
        "Boshqa qurilmadan bank, pochta va Telegram parollarini almashtiring.",
        "Ikki bosqichli himoyani yoqing.",
        "Eng yaxshisi — qurilmani zavod sozlamalariga qaytaring.",
        "Bankka qo‘ng‘iroq qilib, xavf haqida xabar bering.",
      ],
    },
    {
      icon: Money,
      title: "Pul o‘tkazib yubordingiz",
      steps: [
        "Darhol bankka qo‘ng‘iroq qilib, o‘tkazmani qaytarishga urinib ko‘ring.",
        "Hamma narsani saqlang: chek, skrinshot, raqam, Telegram, havolalar.",
        "Huquq idoralariga ariza yozing — qancha tez bo‘lsa, shuncha yaxshi.",
        "Firibgar bilan suhbatni davom ettirmang, «komissiya» yubormang.",
      ],
    },
  ],
  en: [
    {
      icon: Key,
      title: "I sent an SMS / OTP code",
      steps: [
        "Call the bank now using the number on the back of your card.",
        "Block the card and online banking, change your password.",
        "Open Telegram → Settings → Devices and terminate any unknown sessions.",
        "Save screenshots of the chat and the phone number.",
        "Report the case to Ishonch Guard.",
      ],
    },
    {
      icon: DeviceMobile,
      title: "I installed an APK / app",
      steps: [
        "Turn off Wi-Fi and mobile data on the device.",
        "Uninstall the suspicious app and anything related.",
        "From a different device, change bank, email and Telegram passwords.",
        "Enable two-factor where it isn't on yet.",
        "A factory reset and restoring a clean backup is the safest path.",
        "Call your bank to report a possible compromise.",
      ],
    },
    {
      icon: Money,
      title: "I transferred money",
      steps: [
        "Call your bank immediately and ask them to try to recall the transfer.",
        "Save everything: receipt, screenshots, phone, Telegram, links.",
        "File a police report — the sooner, the better the chance of recovery.",
        "Do not keep chatting with the scammer; do not pay any \u201Crecovery fee\u201D.",
      ],
    },
  ],
} as const;

const PAGE = {
  ru: {
    eyebrow: "Срочно · каждая минута важна",
    title: ["Уже отправили код или деньги?", "Действуйте по порядку."],
    lead: "Сначала **заблокируйте карту** и **позвоните в банк**. Чем раньше вы это сделаете, тем выше шанс защитить деньги и аккаунты.",
    asideTitle: "Перезванивайте только сами",
    asideText:
      "По номеру с обратной стороны карты или из списка ниже. Не перезванивайте на номер, с которого вам звонили.",
    callLabel: "Куда звонить",
    callNote: "Проверенные номера из справочника",
    guidesLabel: "Что делать — по ситуации",
    guidesNote: "Делайте шаги по порядку",
    situation: "Ситуация",
    ctaTitle: "Поделитесь случаем — предупредите других",
    ctaText: "Жалоба анонимная и проходит модерацию. Чужие личные данные не публикуются.",
    cta: "Сообщить о случае",
  },
  uz: {
    eyebrow: "Shoshilinch · har bir daqiqa muhim",
    title: ["Kod yoki pulni yuborib qo‘ydingizmi?", "Tartib bilan harakat qiling."],
    lead: "Avval **kartani bloklang** va **bankka qo‘ng‘iroq qiling**. Qancha tez qilsangiz, pul va hisoblarni saqlab qolish imkoni shuncha yuqori.",
    asideTitle: "Faqat o‘zingiz qayta qo‘ng‘iroq qiling",
    asideText:
      "Karta orqasidagi yoki quyidagi ro‘yxatdagi raqamga. Sizga qo‘ng‘iroq qilgan raqamga qayta qo‘ng‘iroq qilmang.",
    callLabel: "Qayerga qo‘ng‘iroq qilish",
    callNote: "Ma’lumotnomadagi tasdiqlangan raqamlar",
    guidesLabel: "Nima qilish kerak — holatga qarab",
    guidesNote: "Qadamlarni tartib bilan bajaring",
    situation: "Holat",
    ctaTitle: "Holatni baham ko‘ring — boshqalarni ogohlantiring",
    ctaText:
      "Shikoyat anonim va moderatsiyadan o‘tadi. Boshqalarning shaxsiy ma’lumotlari e’lon qilinmaydi.",
    cta: "Holat haqida xabar berish",
  },
  en: {
    eyebrow: "Urgent · every minute counts",
    title: ["Already sent a code or money?", "Act in this order."],
    lead: "First **block your card** and **call your bank**. The sooner you do it, the better your chance to protect your money and accounts.",
    asideTitle: "Only call back yourself",
    asideText:
      "Use the number on the back of your card or from the list below. Never call back the number that called you.",
    callLabel: "Who to call",
    callNote: "Verified numbers from the directory",
    guidesLabel: "What to do — by situation",
    guidesNote: "Follow the steps in order",
    situation: "Situation",
    ctaTitle: "Share the case — warn others",
    ctaText:
      "Reports are anonymous and moderated. Other people’s personal data is never published.",
    cta: "Report an incident",
  },
} as const;

function EmergencyPage() {
  const { lang } = useLang();
  const guides = GUIDES[lang];
  const page = PAGE[lang];

  return (
    <div className="vp-home vp-page">
      <div className="vp-shell">
        <PageHero
          alert
          icon={<WarningCircle weight="bold" />}
          eyebrow={page.eyebrow}
          title={page.title}
          lead={page.lead}
          aside={
            <Callout tone="alert" icon={<PhoneCall weight="bold" />} title={page.asideTitle}>
              <p>{page.asideText}</p>
            </Callout>
          }
        />

        <section className="vp-page-section" aria-labelledby="emergency-call">
          <RowHead id="emergency-call" label={page.callLabel} note={page.callNote} />
          <UrgentPlans />
        </section>

        <section className="vp-page-section" aria-labelledby="emergency-guides">
          <RowHead id="emergency-guides" label={page.guidesLabel} note={page.guidesNote} />
          <div className="vp-guides">
            {guides.map((guide, index) => (
              <article className="vp-guide" key={guide.title}>
                <div className="vp-card-top">
                  <span className="vp-card-icon" aria-hidden="true">
                    <guide.icon weight="bold" />
                  </span>
                  <span>
                    {page.situation} {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3>{guide.title}</h3>
                <ol className="vp-numbered">
                  {guide.steps.map((step, stepIndex) => (
                    <li key={step}>
                      <span aria-hidden="true">{stepIndex + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </section>

        <section className="vp-cta-band">
          <span className="vp-cta-band-icon" aria-hidden="true">
            <Megaphone weight="fill" />
          </span>
          <div>
            <h2>{page.ctaTitle}</h2>
            <p>{page.ctaText}</p>
          </div>
          <Pill to="/report" tone="white">
            {page.cta}
          </Pill>
        </section>
      </div>
    </div>
  );
}

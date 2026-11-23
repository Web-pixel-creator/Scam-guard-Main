import type { Lang } from "@/lib/i18n";

/** Bounded semantic controls, not a real-user accuracy corpus. No private values. */
export const DOCUMENT_DISCLOSURE_CASES: ReadonlyArray<{
  text: string;
  lang: Lang;
  expected: "no_disclosure" | "official_only" | "aftercare";
}> = [
  { text: "I sent a refusal to share my passport.", lang: "en", expected: "no_disclosure" },
  { text: "Я отправил отказ предоставить паспорт.", lang: "ru", expected: "no_disclosure" },
  {
    text: "Men pasportimni yuborishni rad etish haqidagi javobni yubordim.",
    lang: "uz",
    expected: "no_disclosure",
  },
  {
    text: "A stranger said that I sent my passport to them.",
    lang: "en",
    expected: "no_disclosure",
  },
  { text: "Незнакомец сказал, что я отправил ему паспорт.", lang: "ru", expected: "no_disclosure" },
  {
    text: "Notanish odam men unga pasportimni yubordim deb aytdi.",
    lang: "uz",
    expected: "no_disclosure",
  },
  { text: "I have not sent my passport to anyone.", lang: "en", expected: "no_disclosure" },
  { text: "Я не отправил свой паспорт никому.", lang: "ru", expected: "no_disclosure" },
  { text: "Men pasportimni hech kimga yubormadim.", lang: "uz", expected: "no_disclosure" },
  {
    text: "I sent my passport only to my bank through its official app.",
    lang: "en",
    expected: "official_only",
  },
  {
    text: "Я отправил паспорт только своему банку через его официальное приложение.",
    lang: "ru",
    expected: "official_only",
  },
  {
    text: "Men pasportimni faqat o'z bankimga uning rasmiy ilovasi orqali yubordim.",
    lang: "uz",
    expected: "official_only",
  },
  {
    text: "I sent a refusal to share my passport. I sent my passport photo to a stranger later.",
    lang: "en",
    expected: "aftercare",
  },
  {
    text: "Я отправил отказ предоставить паспорт. Я отправил паспорт незнакомцу позже.",
    lang: "ru",
    expected: "aftercare",
  },
  {
    text: "Men rad javobini yubordim. Men pasport rasmini notanish odamga yubordim.",
    lang: "uz",
    expected: "aftercare",
  },
  {
    text: "A stranger said that I sent my passport to them. But I sent my passport to another stranger.",
    lang: "en",
    expected: "aftercare",
  },
  {
    text: "Незнакомец сказал, что я отправил ему паспорт. Но я отправил паспорт другому незнакомцу.",
    lang: "ru",
    expected: "aftercare",
  },
  {
    text: "U men pasportimni yubordim deb aytdi. Lekin men pasport rasmini notanish odamga yubordim.",
    lang: "uz",
    expected: "aftercare",
  },
  {
    text: "I sent my passport only to my bank through its official app. I sent my passport photo to a stranger too.",
    lang: "en",
    expected: "aftercare",
  },
  {
    text: "Я отправил паспорт своему банку через его официальное приложение. Я отправил паспорт незнакомцу тоже.",
    lang: "ru",
    expected: "aftercare",
  },
  {
    text: "Men pasportimni o'z bankimga uning rasmiy ilovasi orqali yubordim. Men pasport rasmini notanish odamga ham yubordim.",
    lang: "uz",
    expected: "aftercare",
  },
  {
    text: "I sent my passport to a stranger. I also sent it to my bank through its official app.",
    lang: "en",
    expected: "aftercare",
  },
  {
    text: "Я отправил паспорт незнакомцу. Я также отправил паспорт в официальном приложении своего банка.",
    lang: "ru",
    expected: "aftercare",
  },
  {
    text: "Men pasportimni notanish odamga yubordim. Men pasportimni o'z bankimning rasmiy ilovasiga ham yubordim.",
    lang: "uz",
    expected: "aftercare",
  },
  {
    text: "I sent my passport and a refusal letter to a stranger.",
    lang: "en",
    expected: "aftercare",
  },
  { text: "Я отправил паспорт и письмо с отказом незнакомцу.", lang: "ru", expected: "aftercare" },
  {
    text: "Men pasportimni va rad javobini notanish odamga yubordim.",
    lang: "uz",
    expected: "aftercare",
  },
  {
    text: "I sent my passport through a fake official bank app.",
    lang: "en",
    expected: "aftercare",
  },
  {
    text: "Я отправил паспорт через неофициальное приложение банка.",
    lang: "ru",
    expected: "aftercare",
  },
  {
    text: "Men pasportimni norasmiy bank ilovasi orqali yubordim.",
    lang: "uz",
    expected: "aftercare",
  },
  { text: "I sent my passport despite my earlier refusal.", lang: "en", expected: "aftercare" },
  { text: "Я отправил паспорт несмотря на прежний отказ.", lang: "ru", expected: "aftercare" },
  {
    text: "I sent my passport to a stranger who claimed it was an official bank app.",
    lang: "en",
    expected: "aftercare",
  },
  {
    text: "Я отправил паспорт незнакомцу, который назвал приложение официальным приложением банка.",
    lang: "ru",
    expected: "aftercare",
  },
  {
    text: "Men pasport rasmini yuborishni rad etgan javobimni yubordim.",
    lang: "uz",
    expected: "no_disclosure",
  },
  {
    text: "Я загрузил паспорт только через официальное приложение моего банка.",
    lang: "ru",
    expected: "official_only",
  },
];

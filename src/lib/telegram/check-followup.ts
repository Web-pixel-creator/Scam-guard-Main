import type { Lang } from "@/lib/i18n";
import type { RunCheckResult } from "@/lib/risk/check-core";
import { VERIFIED_CONTACTS } from "@/lib/risk/verified-contacts";
import type { RiskLevel } from "@/lib/risk/rules";
import type {
  LastCheckContext,
  LastCheckSnapshot,
  ReportDraft,
} from "@/lib/telegram/session.server";

const RECENT_CHECK_WINDOW_MS = 20 * 60 * 1000;

const CONFIDENCE_RE =
  /^(?:точно|точно\?|а\s+точно|это\s+точно|ты\s+уверен[а]?|уверен[а]?|правда|реально|это\s+безопасно|можно\s+доверять|sure|really|are\s+you\s+sure|is\s+it\s+safe|can\s+i\s+trust|aniqmi|rostmi|xavfsizmi|ishonsa\s+bo'ladimi)[\s?!.,]*$/i;
const QR_OPEN_RE =
  /(?:можно|безопасно|стоит)\s+(?:открыть|сканировать|перейти).{0,25}qr|qr.{0,25}(?:можно|безопасно|открыть|сканировать|перейти)/i;
const NEXT_STEPS_RE =
  /(?:что\s+(?:делать|дальше|посоветуешь)|что\s+мне\s+делать|как\s+(?:поступить|быть)|какой\s+следующий\s+шаг|что\s+еще|что\s+ещё|what\s+(?:should\s+i\s+do|next)|next\s+step|nima\s+qilay|keyin\s+nima|qanday\s+qilay)/i;
const CONTACTS_RE =
  /(?:дай|покажи|нужен|нужны|куда|как)\s+.{0,30}(?:номер|контакт|банк|горяч|звон)|(?:номер|контакт|телефон|горячая\s+линия)\s+.{0,30}(?:банка|банк|служб)|(?:bank\s+number|official\s+number|where\s+to\s+call|call\s+the\s+bank|bank\s+contact|bank\s+contacts|bank\s+hotline|bank\s+raqam|rasmiy\s+raqam|qayerga\s+qo'ng'iroq)/i;
const EXPLAIN_RE =
  /^(?:почему|почему\s+так|объясни|поясни|я\s+не\s+понял[а]?|не\s+понял[а]?|что\s+это\s+значит|why|why\s+so|explain|i\s+do\s+not\s+understand|i\s+don't\s+understand|nega|tushunmadim|izohla)[\s?!.,]*$/i;

const SCAM_PAYLOAD_RE =
  /(?:https?:\/\/|www\.|t\.me\/|@[a-zA-Z0-9_]{3,}|\+?\d[\d\s().-]{6,}\d|sms.?код|смс.?код|otp|cvv|cvc|pin|пин|apk|перевед|перевести|оплат|оплата|карта|karta|to'?lov|o'?tkazma|transfer)/i;

const CRYPTO_CONTEXT_RE =
  /(крипт|биткоин|bitcoin|binance|trading|трейд|инвест|доходн|прибыл|forex|crypto|investment|investits|kripto|daromad|foyda)/i;
const QR_MENU_CONTEXT_RE =
  /(меню|ресторан|кафе|акци[яи]|лояльност|qr.{0,30}(меню|info|информац)|restaurant|menu|promo|loyalty|restoran|aksiya|ma'lumot)/i;
const DELIVERY_CONTEXT_RE =
  /(доставк|заказ|выдач|пункт|курьер|почт|delivery|pickup|order|courier|yetkazib|buyurtma|topshirish)/i;

export type LastCheckFollowUpAction = "confidence" | "next_steps" | "contacts" | "explain";

function isRecent(snapshot: LastCheckSnapshot, now: Date): boolean {
  const at = Date.parse(snapshot.at);
  return Number.isFinite(at) && now.getTime() - at <= RECENT_CHECK_WINDOW_MS;
}

function hasNewerRecentPanicContext(
  scenarioData: ReportDraft | undefined,
  snapshot: LastCheckSnapshot,
  now: Date,
): boolean {
  const panicAt = Date.parse(scenarioData?.lastPanicAt ?? "");
  const checkAt = Date.parse(snapshot.at);
  return (
    Number.isFinite(panicAt) &&
    Number.isFinite(checkAt) &&
    panicAt >= checkAt &&
    now.getTime() - panicAt <= RECENT_CHECK_WINDOW_MS
  );
}

export function detectLastCheckContext(result: RunCheckResult): LastCheckContext {
  const haystack = `${result.type}\n${result.display}\n${result.explanation ?? ""}`;

  if (DELIVERY_CONTEXT_RE.test(haystack)) return "delivery";
  if (QR_MENU_CONTEXT_RE.test(haystack)) return "qr_menu";
  if (CRYPTO_CONTEXT_RE.test(haystack)) return "crypto";
  if (
    result.type === "phone" ||
    result.reasons.includes("valid_uz_phone") ||
    result.reasons.includes("non_uz_phone")
  ) {
    return "phone";
  }
  if (result.type === "telegram") return "telegram_profile";
  return "generic";
}

export function buildLastCheckSnapshot(
  result: RunCheckResult,
  now = new Date(),
): LastCheckSnapshot {
  return {
    level: result.level,
    type: result.type,
    context: detectLastCheckContext(result),
    at: now.toISOString(),
  };
}

export function buildImageUnreadableSnapshot(now = new Date()): LastCheckSnapshot {
  return {
    level: "unknown",
    type: "unknown",
    context: "image_unreadable",
    at: now.toISOString(),
  };
}

export function classifyLastCheckFollowUp(
  text: string,
  scenarioData: ReportDraft | undefined,
  now = new Date(),
): LastCheckFollowUpAction | null {
  const trimmed = text.trim();
  if (!trimmed || SCAM_PAYLOAD_RE.test(trimmed)) return null;

  const snapshot = scenarioData?.lastCheck;
  if (!snapshot || !isRecent(snapshot, now)) return null;
  if (hasNewerRecentPanicContext(scenarioData, snapshot, now)) return null;

  if (CONTACTS_RE.test(trimmed)) return "contacts";
  if (NEXT_STEPS_RE.test(trimmed)) return "next_steps";
  if (EXPLAIN_RE.test(trimmed)) return "explain";
  if (CONFIDENCE_RE.test(trimmed) || QR_OPEN_RE.test(trimmed)) return "confidence";
  return null;
}

export function classifyOrphanCheckFollowUp(text: string): LastCheckFollowUpAction | null {
  const trimmed = text.trim();
  if (!trimmed || SCAM_PAYLOAD_RE.test(trimmed)) return null;

  if (CONTACTS_RE.test(trimmed)) return "contacts";
  if (NEXT_STEPS_RE.test(trimmed)) return "next_steps";
  if (EXPLAIN_RE.test(trimmed)) return "explain";
  if (CONFIDENCE_RE.test(trimmed) || QR_OPEN_RE.test(trimmed)) return "confidence";
  return null;
}

function levelText(level: RiskLevel, lang: Lang): string {
  const dict: Record<RiskLevel, Record<Lang, string>> = {
    safe: {
      ru: "явных опасных признаков не видно",
      uz: "aniq xavf belgisi ko'rinmayapti",
      en: "I do not see obvious danger signs",
    },
    unknown: {
      ru: "точного вывода пока нет",
      uz: "hozircha aniq xulosa yo'q",
      en: "there is not enough evidence for a precise verdict",
    },
    suspicious: {
      ru: "есть подозрительные признаки",
      uz: "shubhali belgilar bor",
      en: "there are suspicious signs",
    },
    high_risk: {
      ru: "риск высокий",
      uz: "xavf yuqori",
      en: "the risk is high",
    },
  };
  return dict[level][lang];
}

function bankContacts(lang: Lang): string {
  const contacts = VERIFIED_CONTACTS.filter(
    (contact) =>
      (contact.orgType === "bank" || contact.orgType === "payment_system") &&
      contact.contactType === "short_code",
  ).slice(0, 6);

  return contacts.map((contact) => `• ${contact.org[lang]} — ${contact.display}`).join("\n");
}

function confidenceText(snapshot: LastCheckSnapshot, lang: Lang): string {
  if (lang === "uz") {
    if (snapshot.context === "image_unreadable") {
      return "Bu rasm bo'yicha aniq ayta olmayman: matn yoki QR ishonchli o'qilmadi.\n\nMen xavfni o'ylab topmayman. Aniq tekshirish uchun SMS/chat matnini, QR ochadigan havolani yoki sizdan nima so'rashganini yuboring.";
    }
    if (snapshot.context === "qr_menu") {
      return `Aniq kafolat bera olmayman. Ko'rinib turgan rasm bo'yicha ${levelText(snapshot.level, lang)}: bu menyu yoki ma'lumot beruvchi QRga o'xshaydi.\n\nQRni ochsangiz, sahifa manzilini tekshiring. SMS-kod, karta ma'lumoti, login yoki to'lov so'ralsa — to'xtang va keyingi ekran skrinini yuboring.`;
    }
    if (snapshot.context === "delivery") {
      return `Aniq kafolat emas, lekin ko'rinib turgan ma'lumot bo'yicha ${levelText(snapshot.level, lang)}.\n\nHavola, to'lov, APK yoki kod so'rovi paydo bo'lsa — uni alohida yuboring.`;
    }
    if (snapshot.context === "phone") {
      return `Raqamning o'zi yakuniy dalil emas: ${levelText(snapshot.level, lang)}.\n\nAgar suhbatda kod, pul, karta yoki ilova so'ralgan bo'lsa, nima deyishganini qisqacha yozing.`;
    }
    if (snapshot.context === "telegram_profile") {
      return `100% kafolat bera olmayman: Telegram profili yoki kanal bo'yicha faqat ochiq belgilar ko'rinadi. Hozirgi natija: ${levelText(snapshot.level, lang)}.\n\nMuhimi profil emas, u nima so'rayotgani: kod, pul, karta, APK yoki bosim bo'lsa — to'xtang va xabarni yuboring.`;
    }
    return `100% kafolat emas: men faqat ko'rinib turgan belgilarni tekshiraman. Hozirgi natija bo'yicha ${levelText(snapshot.level, lang)}.\n\nAgar kod, karta, APK, login yoki to'lov so'ralsa — to'xtang va shu xabarni yuboring.`;
  }

  if (lang === "en") {
    if (snapshot.context === "image_unreadable") {
      return "I cannot be sure from that image: the text or QR was not readable enough.\n\nI will not invent a risk from a blurry picture. For a precise check, send the SMS/chat text, the link opened by the QR, or what they ask you to do.";
    }
    if (snapshot.context === "qr_menu") {
      return `I cannot guarantee it 100%. Based on the visible screenshot, ${levelText(snapshot.level, lang)}: it looks like a menu or informational QR.\n\nIf you open it, check the page address. If it asks for an SMS code, card data, login, or payment, stop and send me the next screen.`;
    }
    if (snapshot.context === "delivery") {
      return `Not a 100% guarantee, but from the visible details ${levelText(snapshot.level, lang)}.\n\nIf a link, payment, APK, or code request appears, send that separately.`;
    }
    if (snapshot.context === "phone") {
      return `The number alone is not final proof: ${levelText(snapshot.level, lang)}.\n\nIf the caller asked for a code, money, card data, or an app, briefly describe the call.`;
    }
    if (snapshot.context === "telegram_profile") {
      return `I cannot guarantee it 100%: for a Telegram profile or channel I can only check visible/public signs. Previous result: ${levelText(snapshot.level, lang)}.\n\nWhat matters is the request: codes, money, card data, APKs, or pressure are the real danger signs.`;
    }
    return `Not a 100% guarantee: I check only visible risk signs. In the previous result, ${levelText(snapshot.level, lang)}.\n\nIf someone asks for a code, card data, APK, login, or payment, stop and send that message.`;
  }

  if (snapshot.context === "image_unreadable") {
    return "По этой картинке я не могу сказать точно: текст или QR не прочитались достаточно надёжно.\n\nЯ не буду выдумывать риск по мутному скрину. Для точной проверки пришлите текст из SMS/чата, ссылку, которая открывается по QR, или коротко: что вас просят сделать.";
  }
  if (snapshot.context === "qr_menu") {
    return `Не могу гарантировать на 100%. По видимому скриншоту ${levelText(snapshot.level, lang)}: это похоже на меню или информационный QR.\n\nЕсли открываете QR — проверьте адрес страницы. Если попросят SMS-код, карту, логин или оплату, остановитесь и пришлите следующий экран.`;
  }
  if (snapshot.context === "delivery") {
    return `Это не 100% гарантия, но по видимым данным ${levelText(snapshot.level, lang)}.\n\nЕсли появится ссылка, оплата, APK или просьба назвать код — пришлите это отдельно.`;
  }
  if (snapshot.context === "phone") {
    return `Сам номер не даёт 100% вывода: ${levelText(snapshot.level, lang)}.\n\nЕсли в разговоре просили код, деньги, данные карты или приложение — кратко опишите, что именно сказали.`;
  }
  if (snapshot.context === "telegram_profile") {
    return `Не могу гарантировать на 100%: по Telegram-профилю или каналу я вижу только открытые признаки. По прошлой проверке ${levelText(snapshot.level, lang)}.\n\nГлавное — не сам профиль, а что он просит: код, деньги, карту, APK или давление. Если это есть, остановитесь и пришлите сообщение.`;
  }
  return `Это не 100% гарантия: я проверяю только видимые признаки. По прошлой проверке ${levelText(snapshot.level, lang)}.\n\nЕсли просят код, карту, APK, логин или оплату — остановитесь и пришлите это сообщение.`;
}

function nextStepsText(snapshot: LastCheckSnapshot, lang: Lang): string {
  if (lang === "uz") {
    if (snapshot.context === "image_unreadable") {
      return "Keyingi qadam:\n1. SMS/chat matnini qo'lda yuboring.\n2. QR ochilsa, ochilgan havolani yuboring.\n3. Agar faqat video/rasm bo'lsa, QR, username, rekvizit yoki va'da ko'ringan yaqinroq skrin yuboring.";
    }
    if (snapshot.level === "high_risk") {
      return "Keyingi xavfsiz qadam:\n1. Muloqotni to'xtating.\n2. SMS-kod, karta yoki parol bermang.\n3. Bankka faqat rasmiy raqam orqali qo'ng'iroq qiling.\n4. Keyingi xabar yoki ekranni menga yuboring.";
    }
    if (snapshot.context === "qr_menu") {
      return "Keyingi qadam:\n1. QR ochilsa, manzilni tekshiring.\n2. Kod, karta, login yoki to'lov so'ralsa — to'xtang.\n3. Shubhali ekran chiqsa, skrinshot yuboring.";
    }
    if (snapshot.context === "phone") {
      return "Keyingi qadam:\n1. Raqamga qarab xulosa qilmang.\n2. Agar qo'ng'iroq bo'lgan bo'lsa, nima so'rashganini yozing.\n3. Kod, pul yoki ilova so'ralsa — suhbatni to'xtating va rasmiy raqamga qo'ng'iroq qiling.";
    }
    if (snapshot.context === "telegram_profile") {
      return "Keyingi qadam:\n1. Profilga qarab yakuniy xulosa qilmang.\n2. U so'ragan narsani tekshiring: kod, pul, karta, APK yoki havola.\n3. Shubhali xabar, skrinshot yoki linkni alohida yuboring.";
    }
    return "Keyingi qadam:\n1. Agar havola, kod, karta yoki to'lov bo'lmasa — kuzating.\n2. Yangi xabar yoki so'rov paydo bo'lsa, alohida yuboring.\n3. Shoshirishsa yoki qo'rqitishsa — bu xavf belgisi.";
  }

  if (lang === "en") {
    if (snapshot.context === "image_unreadable") {
      return "Next step:\n1. Paste the SMS/chat text manually.\n2. If it is a QR, send the link it opens.\n3. If it is only a video/image, send a closer screenshot showing the QR, username, payment details, or promise.";
    }
    if (snapshot.level === "high_risk") {
      return "Next safe step:\n1. Stop the conversation.\n2. Do not share SMS codes, card data, or passwords.\n3. Call your bank only using an official number.\n4. Send me the next message or screen.";
    }
    if (snapshot.context === "qr_menu") {
      return "Next step:\n1. If you open the QR, check the page address.\n2. If it asks for a code, card, login, or payment — stop.\n3. If another screen looks suspicious, send a screenshot.";
    }
    if (snapshot.context === "phone") {
      return "Next step:\n1. Do not judge by the number alone.\n2. If it was a call, write what they asked you to do.\n3. If they ask for a code, money, or an app — hang up and call an official number.";
    }
    if (snapshot.context === "telegram_profile") {
      return "Next step:\n1. Do not judge by the profile alone.\n2. Check what it asks for: codes, money, card data, APKs, or links.\n3. Send the suspicious message, screenshot, or link separately.";
    }
    return "Next step:\n1. If there is no link, code, card, or payment request, watch calmly.\n2. Send any new message or request separately.\n3. Pressure or threats are a warning sign.";
  }

  if (snapshot.context === "image_unreadable") {
    return "Следующий шаг:\n1. Пришлите текст из SMS/чата вручную.\n2. Если это QR — пришлите ссылку, которая открывается.\n3. Если это видео/картинка — пришлите более близкий скрин, где видны QR, username, реквизиты или обещание.";
  }
  if (snapshot.level === "high_risk") {
    return "Следующий безопасный шаг:\n1. Остановите разговор.\n2. Не сообщайте SMS-код, карту или пароль.\n3. Перезвоните в банк только по официальному номеру.\n4. Пришлите мне следующий экран или сообщение.";
  }
  if (snapshot.context === "qr_menu") {
    return "Следующий шаг:\n1. Если открываете QR — проверьте адрес страницы.\n2. Если просят код, карту, логин или оплату — остановитесь.\n3. Если появится новый подозрительный экран, пришлите скриншот.";
  }
  if (snapshot.context === "phone") {
    return "Следующий шаг:\n1. Не делайте вывод только по номеру.\n2. Если был звонок — напишите, что именно просили сделать.\n3. Если просят код, деньги или приложение — завершите разговор и звоните по официальному номеру.";
  }
  if (snapshot.context === "telegram_profile") {
    return "Следующий шаг:\n1. Не делайте вывод только по профилю.\n2. Смотрите, что именно он просит: код, деньги, карту, APK или ссылку.\n3. Подозрительное сообщение, скриншот или ссылку пришлите отдельно.";
  }
  return "Следующий шаг:\n1. Если нет ссылки, кода, карты или оплаты — спокойно наблюдайте.\n2. Новое сообщение или просьбу пришлите отдельно.\n3. Давление, срочность и угрозы — тревожный признак.";
}

function contactsText(lang: Lang): string {
  const contacts = bankContacts(lang);

  if (lang === "uz") {
    return `Rasmiy qayta qo'ng'iroq:\n1. Shubhali xabardagi yoki qo'ng'iroqdagi raqamga qo'ng'iroq qilmang.\n2. Raqamni karta orqasidan, bank ilovasidan yoki rasmiy saytdan oling.\n\nTekshirilgan qisqa raqamlar:\n${contacts}`;
  }
  if (lang === "en") {
    return `Official callback:\n1. Do not call the number from the suspicious message or incoming call.\n2. Use the number on your card, in the bank app, or on the official website.\n\nVerified short numbers:\n${contacts}`;
  }
  return `Официальный обратный звонок:\n1. Не звоните по номеру из подозрительного сообщения или входящего звонка.\n2. Возьмите номер с карты, из приложения банка или с официального сайта.\n\nПроверенные короткие номера:\n${contacts}`;
}

function explainText(snapshot: LastCheckSnapshot, lang: Lang): string {
  if (lang === "uz") {
    if (snapshot.context === "image_unreadable") {
      return "Sabab: rasmda matn/QR yetarlicha aniq ko'rinmadi. Bunday holatda men xavfni taxmin qilib aytmayman.\n\nEng yaxshi dalil: xabar matni, QR havolasi yoki sizdan nima so'ralgani.";
    }
    return `Qisqacha: men oldingi xabarda ko'rinib turgan xavf belgilarini tekshirdim. Natija: ${levelText(snapshot.level, lang)}.\n\nMen ichki ballarni ko'rsatmayman. Muhimi: kod, karta, parol, APK, pul o'tkazish yoki bosim bo'lsa — xavf oshadi. Bunday narsa yo'q bo'lsa, xulosa ehtiyotkor bo'ladi.`;
  }
  if (lang === "en") {
    if (snapshot.context === "image_unreadable") {
      return "Reason: the image did not show readable text/QR clearly enough. In that case I do not guess or invent a threat.\n\nBest evidence: the message text, QR link, or what they ask you to do.";
    }
    return `Briefly: I checked the visible risk signs in the previous item. Result: ${levelText(snapshot.level, lang)}.\n\nI do not show internal scores. What matters: codes, card data, passwords, APKs, money transfers, and pressure increase risk. Without those, the verdict stays cautious.`;
  }
  if (snapshot.context === "image_unreadable") {
    return "Причина: на изображении не было достаточно читаемого текста или QR. В такой ситуации я не угадываю и не придумываю угрозу.\n\nЛучшее доказательство: текст сообщения, ссылка из QR или короткое описание, что вас просят сделать.";
  }
  return `Коротко: я проверил видимые признаки риска в прошлом сообщении. Итог: ${levelText(snapshot.level, lang)}.\n\nЯ не показываю внутренние баллы. Главное: коды, карта, пароль, APK, перевод денег и давление повышают риск. Если этого нет, вывод остаётся осторожным.`;
}

export function buildLastCheckFollowUpText(
  action: LastCheckFollowUpAction,
  snapshot: LastCheckSnapshot,
  lang: Lang,
): string {
  switch (action) {
    case "confidence":
      return confidenceText(snapshot, lang);
    case "next_steps":
      return nextStepsText(snapshot, lang);
    case "contacts":
      return contactsText(lang);
    case "explain":
      return explainText(snapshot, lang);
  }
}

export function buildOrphanCheckFollowUpText(action: LastCheckFollowUpAction, lang: Lang): string {
  if (action === "contacts") return contactsText(lang);

  if (lang === "uz") {
    if (action === "confidence") {
      return "Qaysi tekshiruv haqida so'rayotganingiz ko'rinmayapti. Link, raqam, skrinshot yoki xabarni qayta yuboring — shu bo'yicha aniq javob beraman.\n\nAgar savol QR haqida bo'lsa: QRning o'zi xavf emas. Ochilgandan keyin kod, karta, login yoki to'lov so'ralsa — to'xtang va shu ekranni yuboring.";
    }
    if (action === "explain") {
      return "Men sababni faqat aniq tekshiruv bo'yicha tushuntira olaman. Iltimos, link, raqam, username, skrinshot yoki xabar matnini yuboring.\n\nAgar hozir bosim bo'lsa: kod, PIN, CVV, parol yoki karta ma'lumotlarini bermang.";
    }
    return "Hozir xavfsiz yo'l:\n1. SMS-kod, PIN, CVV, parol yoki karta ma'lumotlarini bermang.\n2. Noma'lum APK/ilovani o'rnatmang.\n3. Pul o'tkazmang va QR orqali login qilmang.\n4. Link, raqam, skrinshot yoki xabar matnini yuboring — men aniq tekshiraman.";
  }

  if (lang === "en") {
    if (action === "confidence") {
      return "I cannot see which previous check you mean. Send the link, number, screenshot, or message again and I will answer about that exact item.\n\nIf this is about a QR: the QR itself is not dangerous. If the next page asks for a code, card data, login, or payment, stop and send that screen.";
    }
    if (action === "explain") {
      return "I can explain the reason only for a concrete check. Please send the link, number, username, screenshot, or message text.\n\nIf someone is pressuring you now: do not share SMS codes, PIN, CVV, passwords, or card data.";
    }
    return "Safe step right now:\n1. Do not share SMS codes, PIN, CVV, passwords, or card data.\n2. Do not install unknown APKs/apps.\n3. Do not transfer money or log in through QR.\n4. Send the link, number, screenshot, or message text — I will check it precisely.";
  }

  if (action === "confidence") {
    return "Я не вижу, к какой именно проверке относится вопрос. Пришлите ссылку, номер, скриншот или сообщение ещё раз — отвечу по нему точно.\n\nЕсли вопрос про QR: сам QR не опасен. Опасно, если после открытия просят код, карту, логин или оплату. В таком случае остановитесь и пришлите следующий экран.";
  }
  if (action === "explain") {
    return "Я могу объяснить причину только по конкретной проверке. Пришлите ссылку, номер, username, скриншот или текст сообщения.\n\nЕсли на вас сейчас давят: не сообщайте SMS-код, PIN, CVV, пароль или данные карты.";
  }
  return "Безопасный шаг прямо сейчас:\n1. Не сообщайте SMS-код, PIN, CVV, пароль или данные карты.\n2. Не устанавливайте неизвестные APK/приложения.\n3. Не переводите деньги и не входите через QR.\n4. Пришлите ссылку, номер, скриншот или текст — я проверю точнее.";
}

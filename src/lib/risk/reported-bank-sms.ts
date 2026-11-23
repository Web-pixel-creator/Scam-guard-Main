import type { Lang } from "@/lib/i18n";
import { normalizeIntentTextForMatching } from "@/lib/telegram/intent-text-normalization";
import { uzbekLatinMatchingVariant } from "./uz-cyrillic-translit";

// Presentation hint, not an identity claim or a stored risk reason. Bind the
// sender, request and optional callback to the same reported message. Leave
// a warning, quoted hypothetical or additional completed incident to normal triage.
export type BankSmsKind = "code" | "callback";
const ru =
  /^(?:в (?:sms|смс|сообщении) от имени банка просят (?:продиктовать|назвать|сообщить)|банк (?:пишет|прислал (?:смс|sms|сообщение)):\s*(?:скажите|назовите|сообщите)) код из (?:sms|смс|сообщения)(?<callback> и перезвонить по номеру из сообщения)?[.!?]?$/iu;
const uz =
  /^(?:bankdan|bank nomidan) (?:sms|xabar) keldi[.:]\s*sms (?:kod(?:i|ingiz)?ni ayting|kod(?:im|i)ni aytishimni(?<callback> va xabardagi raqamga qo'ng'iroq qilishimni)? so'ra(?:shdi|di))[.!?]?$/iu;
const en =
  /^(?:i (?:got|received) )?(?:a |the )?(?:text|sms|message)(?: message)? (?:claiming to be |supposedly )?from (?:my |the |a |our )?bank (?:asking|asks) (?:me )?to (?:share|send|give|read(?: out)?|tell) (?:my |the |a )?(?:sms |verification |confirmation )?(?:code|pin|otp)(?<callback> and call(?: back)? (?:the )?number in (?:the )?(?:text|sms|message))?[.!?]?$/iu;

export function matchBankSmsScript(text: string): BankSmsKind | null {
  const m = ru.exec(text) ?? uz.exec(text) ?? en.exec(text);
  return m ? (m.groups?.callback ? "callback" : "code") : null;
}
export function reportedBankSms(input: string): BankSmsKind | null {
  if (!/(?:bank|банк)/iu.test(input)) return null;
  const text = normalizeIntentTextForMatching(input);
  return matchBankSmsScript(text) ?? matchBankSmsScript(uzbekLatinMatchingVariant(text) ?? "");
}

export function bankSmsAdvice(kind: BankSmsKind, lang: Lang): string {
  const first = {
    ru: "Никому не говорите код из SMS.",
    uz: "SMS kodini hech kimga aytmang.",
    en: "Do not share the SMS code.",
  };
  const callback = {
    ru: "Не звоните по номеру из сообщения.",
    uz: "Xabardagi raqamga qo‘ng‘iroq qilmang.",
    en: "Do not call the number in the message.",
  };
  const support = {
    ru: "Откройте приложение своего банка: «Поддержка».",
    uz: "Bank ilovasidagi yordam xizmatiga yozing.",
    en: "Open your own banking app and contact support.",
  };
  return [first[lang], ...(kind === "callback" ? [callback[lang]] : []), support[lang]].join(" ");
}

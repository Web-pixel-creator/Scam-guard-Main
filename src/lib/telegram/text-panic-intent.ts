import type { LiveCallContext, PanicScenarioId } from "@/lib/telegram/emergency";
import type { TelegramForwardSourceContext } from "@/lib/telegram/forward-context";
import { transliterateRuLatin } from "@/lib/telegram/ru-translit";
export function normalizeVoiceIntentText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[ўӯ]/g, "у")
    .replace(/қ/g, "к")
    .replace(/ғ/g, "г")
    .replace(/ҳ/g, "х")
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
const NEGATED_VOICE_DONE_INTENT_RE =
  /(?:^|\s)(?:не|net|yo'q|yoq)\s+(?:уже\s+)?(?:отправил[аи]?|отправлял[аи]?|сообщил[аи]?|назвал[аи]?|сказал[аи]?|передал[аи]?|установил[аи]?|поставил[аи]?|скачал[аи]?|запустил[аи]?|открыл[аи]?|перевел[аи]?|перевёл[аи]?|оплатил[аи]?|пополнил[аи]?|ввел[аи]?|ввёл[аи]?|указал[аи]?|продиктовал[аи]?|отсканировал[аи]?|сканировал[аи]?|подтвердил[аи]?|yubormadim|jo'natmadim|jonatmadim|aytmadim|bermadim|kiritmadim|o'rnatmadim|ornatmadim|yuklamadim|skaner\s+qilmadim|scan\s+qilmadim)/;
const UZ_NEGATED_VOICE_DONE_INTENT_RE =
  /(?:^|\s)(?:yubormadim|yubarmadim|yub[oa]r\s+madim|jo'natmadim|jo'nat\s+madim|jonatmadim|jonat\s+madim|aytmadim|ayt\s+madim|bermadim|ber\s+madim|kiritmadim|kirit\s+madim|o'rnatmadim|o'rnat\s+madim|ornatmadim|ornat\s+madim|yuklamadim|yukla\s+madim|ochmadim|och\s+madim|o'tkazmadim|o'tkaz\s+madim|otkazmadim|otkaz\s+madim|to'lamadim|to'la\s+madim|tolamadim|tola\s+madim|tasdiqlamadim|tasdiqla\s+madim|ruxsat\s+bermadim|ruxsat\s+ber\s+madim|skaner\s+qilmadim|scan\s+qilmadim|yubormayman|yubarmayman|jo'natmayman|jonatmayman|aytmayman|bermayman|kiritmayman|o'rnatmayman|ornatmayman|yuklamayman|ochmayman|o'tkazmayman|otkazmayman|to'lamayman|tolamayman|tasdiqlamayman|ruxsat\s+bermayman|skaner\s+qilmayman|scan\s+qilmayman)(?=\s|[.!?,;:]|$)/;
const UZ_CYRILLIC_NEGATED_VOICE_DONE_INTENT_RE =
  /(?:^|\s)(?:юбормадим|жунатмадим|айтмадим|бермадим|киритмадим|урнатмадим|юкламадим|очмадим|утказмадим|толамадим|сканер\s+килмадим|scan\s+килмадим|тасдикламадим)(?=\s|[.!?,;:]|$)/;
const EN_NEGATED_VOICE_DONE_INTENT_RE =
  /(?:^|\s)(?:i|we)\s+(?:(?:have|did|do)\s+not|haven't|didn't|don't)\s+(?:already\s+)?(?:send|sent|share|shared|give|gave|given|tell|told|say|said|read|dictate|dictated|install|installed|download|downloaded|open|opened|allow|allowed|enable|enabled|transfer|transferred|pay|paid|top\s+up|topped\s+up|enter|entered|type|typed|scan|scanned|confirm|confirmed|approve|approved|link|linked)\b/;
const ABORTED_VOICE_DONE_INTENT_RE =
  /(?:(?:почти|чуть\s+не|едва\s+не).{0,60}(?:сказал|назвал|сообщил|отправил|передал|продиктовал|дал|перевел|перевёл|установил)|(?:almost|nearly).{0,60}(?:shared|sent|gave|told|said|read|dictated|transferred|paid|installed)|(?:shared|sent|gave|told|said|read|dictated).{0,60}but\s+(?:stopped|did\s+not\s+finish))/;

export function isNegatedVoiceDoneIntent(transcript: string): boolean {
  const text = normalizeVoiceIntentText(transcript);
  if (!text) return false;
  return (
    NEGATED_VOICE_DONE_INTENT_RE.test(text) ||
    UZ_NEGATED_VOICE_DONE_INTENT_RE.test(text) ||
    UZ_CYRILLIC_NEGATED_VOICE_DONE_INTENT_RE.test(text) ||
    EN_NEGATED_VOICE_DONE_INTENT_RE.test(text) ||
    ABORTED_VOICE_DONE_INTENT_RE.test(text)
  );
}

const UZ_REQUESTED_ACTION_VOICE_RE =
  /(?:yuborish(?:imni|ni)|jo['’]?natish(?:imni|ni)|jonatish(?:imni|ni)|aytish(?:imni|ni)|berish(?:imni|ni)|kiritish(?:imni|ni)|o['’]?tkazish(?:imni|ni)|otkazish(?:imni|ni)|to['’]?lash(?:imni|ni)|tolash(?:imni|ni)).{0,70}(?:so['’]?ra|sora|talab)|(?:so['’]?ra|sora|talab).{0,100}(?:yuborish(?:imni|ni)|jo['’]?natish(?:imni|ni)|jonatish(?:imni|ni)|aytish(?:imni|ni)|berish(?:imni|ni)|kiritish(?:imni|ni)|o['’]?tkazish(?:imni|ni)|otkazish(?:imni|ni)|to['’]?lash(?:imni|ni)|tolash(?:imni|ni))/;
const UZ_EXPLICIT_DONE_VOICE_RE =
  /(?:^|\s)(?:men|biz)\s+.{0,50}(?:yub[oa]rdim|jo['’]?natdim|jonatdim|aytdim|berdim|kiritdim|o['’]?rnatdim|ornatdim|yukladim|ochdim|ruxsat berdim|o['’]?tkazdim|otkazdim|to['’]?ladim|toladim|skaner qildim|scan qildim|tasdiqladim)(?=\s|[.!?,;:]|$)/;

function isRequestedActionVoiceText(text: string): boolean {
  return UZ_REQUESTED_ACTION_VOICE_RE.test(text) && !UZ_EXPLICIT_DONE_VOICE_RE.test(text);
}

export function classifyVoicePanicIntent(transcript: string): PanicScenarioId | null {
  const text = normalizeVoiceIntentText(transcript);
  if (!text) return null;
  if (isNegatedVoiceDoneIntent(text)) return null;
  const requestedAction = isRequestedActionVoiceText(text);
  if (requestedAction) {
    if (
      /(?:hozir|xozir).{0,80}(qo'ng'iroq|qongiroq|telefon|zvon|call)/.test(text) ||
      /(?:menga|bizga).{0,80}(qo'ng'iroq|qongiroq|telefon|zvon|call).{0,80}(qilyap|qilish(?:yapti|moqda)|qilmoqda|kel(?:yapti|moqda))/u.test(
        text,
      ) ||
      /(?:хозир|xozir).{0,80}(кунгирок|телефон|звон|call)/.test(text) ||
      /(?:менга|бизга).{0,80}(кунгирок|телефон|звон|call).{0,80}(киляп|килиш(?:япти|мокда)|килмокда|кел(?:япти|мокда))/u.test(
        text,
      )
    ) {
      return 6;
    }
    return null;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(?:назвал[аи]?|сказал[аи]?|передал[аи]?|продиктовал[аи]?|показал[аи]?|отправил[аи]?|дал[аи]?).{0,80}(cvv|cvc|pin|пин|код безопасности|три цифры|3 цифры|оборот[ае] карт|парол[ья]\s+от\s+(?:онлайн\s+)?банк)/.test(
      text,
    ) ||
    /(?:cvv|cvc|pin|пин|код безопасности|три цифры|3 цифры|оборот[ае] карт|парол[ья]\s+от\s+(?:онлайн\s+)?банк).{0,80}(назвал[аи]?|сказал[аи]?|передал[аи]?|продиктовал[аи]?|показал[аи]?|отправил[аи]?|дал[аи]?)/.test(
      text,
    ) ||
    /(?:kartaning|karta|card|cvv|cvc|pin|maxfiy\s+kod|uch\s+raqam|3\s+raqam).{0,80}(ayt|ber|yubor|jo'nat|jonat|ko'rsat|korsat)/.test(
      text,
    ) ||
    /(?:ayt|ber|yubor|jo'nat|jonat|ko'rsat|korsat).{0,80}(kartaning|karta|card|cvv|cvc|pin|maxfiy\s+kod|uch\s+raqam|3\s+raqam)/.test(
      text,
    ) ||
    /(?:карта|card|cvv|cvc|pin|пин|махфий\s+код|уч\s+ракам|3\s+ракам).{0,80}(айт|бер|юбор|жунат|курсат|кирит)/.test(
      text,
    ) ||
    /(?:айт|бер|юбор|жунат|курсат|кирит).{0,80}(карта|card|cvv|cvc|pin|пин|махфий\s+код|уч\s+ракам|3\s+ракам)/.test(
      text,
    ) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:gave|given|shared|sent|said|told|read|dictated|entered|typed|showed).{0,80}(?:cvv|cvc|pin|security\s+code|three\s+digits|3\s+digits|back\s+of\s+(?:the\s+|my\s+)?card|card\s+number|card\s+details|expiry|expiration|online\s+bank\s+password|bank\s+password)/.test(
      text,
    ) ||
    /(?:cvv|cvc|pin|security\s+code|three\s+digits|3\s+digits|back\s+of\s+(?:the\s+|my\s+)?card|card\s+number|card\s+details|expiry|expiration|online\s+bank\s+password|bank\s+password).{0,80}(?:gave|given|shared|sent|said|told|read|dictated|entered|typed|showed)/.test(
      text,
    )
  ) {
    return 4;
  }

  if (
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:scanned|scan|confirmed|approved|allowed|linked|entered|typed).{0,80}(?:telegram|tg).{0,80}(?:qr|login|log\s+in|device|code)/.test(
      text,
    ) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:scanned|scan|confirmed|approved|allowed|linked|entered|typed).{0,80}(?:qr|login|log\s+in|device|code).{0,80}(?:telegram|tg)/.test(
      text,
    ) ||
    /(?:telegram|tg).{0,80}(?:qr|login|log\s+in|device|code).{0,80}(?:scanned|scan|confirmed|approved|allowed|linked|entered|typed)/.test(
      text,
    ) ||
    /(?:telegram|tg|телеграм).{0,80}(?:qr|куар|код|логин|кириш|устройств).{0,80}(?:сканер|scan|тасдик|улаш|богла|кирит|рухсат)/.test(
      text,
    ) ||
    /(?:сканер|scan|тасдик|улаш|богла|кирит|рухсат).{0,80}(?:telegram|tg|телеграм).{0,80}(?:qr|куар|код|логин|кириш|устройств)/.test(
      text,
    )
  ) {
    return 5;
  }

  if (
    /(?:ilova|programma|app|apk|anydesk|teamviewer|rustdesk).{0,100}(?:smsga|sms|xabarnoma|bildirishnoma|ekran|ruxsat)/.test(
      text,
    ) ||
    /(?:smsga|sms|xabarnoma|bildirishnoma|ekran).{0,80}ruxsat\s+ber/.test(text) ||
    /ruxsat\s+ber.{0,80}(?:smsga|sms|xabarnoma|bildirishnoma|ekran)/.test(text)
  ) {
    return 2;
  }

  if (
    /(?:^|\s)(я|мы)\s+(?:уже\s+|только\s+что\s+|недавно\s+)?(отправил[аи]?|сообщил[аи]?|назвал[аи]?|сказал[аи]?|передал[аи]?|продиктовал[аи]?|скинул[аи]?|дал[аи]?).{0,60}(смс|sms|otp|код|code|цифр[аы]?)/.test(
      text,
    ) ||
    /(?:смс|sms|otp|код|code|цифр[аы]?).{0,60}(отправил[аи]?|сообщил[аи]?|назвал[аи]?|сказал[аи]?|передал[аи]?|продиктовал[аи]?|скинул[аи]?)/.test(
      text,
    ) ||
    /^(?:уже\s+)?(?:отправил|сообщил|назвал|сказал|передал|продиктовал|скинул|дал)[аи]?\s+(?:им\s+|ему\s+|ей\s+)?.{0,30}(?:смс|sms|otp|код|code)/.test(
      text,
    ) ||
    /(?:^|\s)(men|biz).{0,40}(yub[oa]r(?!\s*ma)|jo'nat(?!\s*ma)|jonat(?!\s*ma)|ayt(?!\s*ma)|ber(?!\s*ma)|kirit(?!\s*ma)).{0,60}(sms|kod|code|otp)/.test(
      text,
    ) ||
    /(?:sms|kod|code|otp).{0,60}(yub[oa]r(?!\s*ma)|jo'nat(?!\s*ma)|jonat(?!\s*ma)|ayt(?!\s*ma)|ber(?!\s*ma)|kirit(?!\s*ma))/.test(
      text,
    ) ||
    /(?:^|\s)(мен|биз).{0,40}(юбор|жунат|айт|бер|кирит).{0,60}(sms|смс|kod|код|code|otp)/.test(
      text,
    ) ||
    /(?:sms|смс|kod|код|code|otp).{0,60}(юбор|жунат|айт|бер|кирит)/.test(text) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:sent|shared|gave|given|told|read|entered|typed|confirmed).{0,60}(?:sms|otp|verification|login)?\s*(?:code|number|digits)/.test(
      text,
    ) ||
    /(?:sms|otp|verification|login).{0,30}(?:code|number|digits).{0,60}(?:sent|shared|gave|given|told|read|entered|typed|confirmed)/.test(
      text,
    )
  ) {
    return 1;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(установил[аи]?|поставил[аи]?|скачал[аи]?|запустил[аи]?|открыл[аи]?|разрешил[аи]?|включил[аи]?|дал[аи]?).{0,80}(apk|апк|приложени[ея]|anydesk|teamviewer|rustdesk|удаленн(?:ый|ого)\s+доступ|доступ\s+к\s+(?:экрану|телефон[у]?|устройств[у]?|sms|смс|уведомлени)|спец\.?\s*возможност|специальн(?:ые|ых)\s+возможност)/.test(
      text,
    ) ||
    /(?:apk|апк|приложени[ея]|anydesk|teamviewer|rustdesk).{0,80}(доступ к sms|доступ к смс|доступ к экрану|уведомлени|спец\.?\s*возможност|специальн(?:ые|ых)\s+возможност|accessibility|удаленн(?:ый|ого)\s+доступ)/.test(
      text,
    ) ||
    /(?:^|\s)(men|biz).{0,40}(o'rnat|ornat|yukla|skachat|och|ishga tushir|ruxsat ber).{0,80}(apk|ilova|programma|app|anydesk|teamviewer|rustdesk|masofaviy|ekran)/.test(
      text,
    ) ||
    /(?:apk|ilova|programma|app|anydesk|teamviewer|rustdesk|masofaviy|ekran).{0,80}(o'rnat|ornat|yukla|skachat|och|smsga ruxsat|xabarnoma|ruxsat ber)/.test(
      text,
    ) ||
    /(?:^|\s)(мен|биз).{0,40}(урнат|юкла|скач|оч|ишга\s+тушир|рухсат\s+бер).{0,80}(apk|апк|илова|программа|app|anydesk|teamviewer|rustdesk|масофавий|экран)/.test(
      text,
    ) ||
    /(?:apk|апк|илова|программа|app|anydesk|teamviewer|rustdesk|масофавий|экран).{0,80}(урнат|юкла|скач|оч|smsга\s+рухсат|хабарнома|рухсат\s+бер)/.test(
      text,
    ) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:installed|downloaded|opened|started|allowed|enabled|gave).{0,80}(?:apk|anydesk|teamviewer|rustdesk|remote\s+access|screen\s+access|access\s+to\s+(?:my\s+)?screen|accessibility|special\s+permissions|unknown\s+app|app\s+from\s+(?:a\s+)?link)/.test(
      text,
    ) ||
    /(?:apk|anydesk|teamviewer|rustdesk|remote\s+access|screen\s+access|access\s+to\s+(?:my\s+)?screen|accessibility|special\s+permissions|unknown\s+app|app\s+from\s+(?:a\s+)?link).{0,80}(?:installed|downloaded|opened|started|allowed|enabled|gave)/.test(
      text,
    )
  ) {
    return 2;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(перевел[аи]?|перевёл[аи]?|сделал[аи]?|отправил[аи]?|скинул[аи]?|оплатил[аи]?|пополнил[аи]?).{0,80}(ден[ьи]?г|перевод|сум|сумов|uzs|кар[тд]|баланс|комисс)/.test(
      text,
    ) ||
    /(?:ден[ьи]?г|перевод|сум|сумов|uzs|кар[тд]|баланс|комисс).{0,80}(перевел[аи]?|перевёл[аи]?|сделал[аи]?|отправил[аи]?|скинул[аи]?|оплатил[аи]?|пополнил[аи]?)/.test(
      text,
    ) ||
    /(?:pul|sum|som|uzs|karta|balans).{0,80}(yubor|jo'nat|jonat|o'tkaz|otkaz|to'la|tola|tolad|to'lad)/.test(
      text,
    ) ||
    /(?:yubor|jo'nat|jonat|o'tkaz|otkaz|to'la|tola|tolad|to'lad).{0,80}(pul|sum|som|uzs|karta|balans)/.test(
      text,
    ) ||
    /(?:пул|сум|som|uzs|карта|баланс).{0,80}(юбор|жунат|утказ|тола|тула|оплат|попол)/.test(text) ||
    /(?:юбор|жунат|утказ|тола|тула|оплат|попол).{0,80}(пул|сум|som|uzs|карта|баланс)/.test(text) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:transferred|sent|paid|topped\s+up).{0,80}(?:money|transfer|sum|uzs|card|account|balance|wallet|phone\s+number|their\s+number)/.test(
      text,
    ) ||
    /(?:money|transfer|sum|uzs|card|account|balance|wallet|phone\s+number|their\s+number).{0,80}(?:transferred|sent|paid|topped\s+up)/.test(
      text,
    )
  ) {
    return 3;
  }

  if (
    /(?:^|\s)(я|мы)\s+(уже\s+)?(ввел[аи]?|ввёл[аи]?|вбил[аи]?|указал[аи]?|назвал[аи]?|отправил[аи]?|дал[аи]?).{0,80}(карт[уы]|номер карты|cvv|cvc|срок карты|данные карты)/.test(
      text,
    ) ||
    /(?:karta|card|cvv|cvc|pin).{0,80}(kirit|ber|ayt|yubor|jo'nat|jonat)/.test(text) ||
    /(?:kirit|ber|ayt|yubor|jo'nat|jonat).{0,80}(karta|card|cvv|cvc|pin)/.test(text) ||
    /(?:карта|card|cvv|cvc|pin|пин).{0,80}(кирит|бер|айт|юбор|жунат)/.test(text) ||
    /(?:кирит|бер|айт|юбор|жунат).{0,80}(карта|card|cvv|cvc|pin|пин)/.test(text) ||
    /(?:^|\s)(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:entered|typed|gave|given|shared|sent).{0,80}(?:card|card\s+number|card\s+details|cvv|cvc|pin|expiry|expiration)/.test(
      text,
    ) ||
    /(?:card|card\s+number|card\s+details|cvv|cvc|pin|expiry|expiration).{0,80}(?:entered|typed|gave|given|shared|sent)/.test(
      text,
    )
  ) {
    return 4;
  }

  if (
    /(?:потерял[аи]?|украли|взломали|угнали|забрали).{0,80}(telegram|телеграм|аккаунт)/.test(
      text,
    ) ||
    /(?:не могу|не получается).{0,40}(зайти|войти).{0,60}(telegram|телеграм)/.test(text) ||
    /(?:^|\s)(я|мы)\s+(уже\s+)?(отсканировал[аи]?|сканировал[аи]?|подтвердил[аи]?|разрешил[аи]?).{0,80}(qr|куар|код).{0,80}(telegram|телеграм|вход|устройств)/.test(
      text,
    ) ||
    /(?:telegram|телеграм).{0,80}(qr|куар|код).{0,80}(отсканировал[аи]?|сканировал[аи]?|подтвердил[аи]?|разрешил[аи]?)/.test(
      text,
    ) ||
    /(?:telegram|akkaunt|account).{0,80}(kira olmay|yo'qot|yoqot|o'g'ir|ogir|vzlom|hack)/.test(
      text,
    ) ||
    /(?:telegram).{0,80}(qr|kod).{0,80}(skaner|scan|tasdiq|ulash|bog'la|bogla)/.test(text) ||
    /(?:skaner|scan|tasdiq|ulash|bog'la|bogla).{0,80}(telegram).{0,80}(qr|kod)/.test(text) ||
    /(?:telegram|телеграм).{0,80}(qr|куар|код).{0,80}(сканер|scan|тасдик|улаш|богла)/.test(text) ||
    /(?:сканер|scan|тасдик|улаш|богла).{0,80}(telegram|телеграм).{0,80}(qr|куар|код)/.test(text) ||
    /(?:lost|stolen|hacked|taken\s+over|can't\s+log\s+in|cannot\s+log\s+in|can\s+not\s+log\s+in).{0,80}(?:telegram|tg|account)/.test(
      text,
    ) ||
    /(?:telegram|tg|account).{0,80}(?:lost|stolen|hacked|taken\s+over|can't\s+log\s+in|cannot\s+log\s+in|can\s+not\s+log\s+in)/.test(
      text,
    )
  ) {
    return 5;
  }

  if (
    /(?:^|\s)(мне|нам)\s+(сейчас\s+)?звон(?:ят|ит(?!ь))/.test(text) ||
    /(?:^|\s)(я|мы)\s+(сейчас\s+)?на звонке/.test(text) ||
    /(?:^|\s)звон(?:ит(?!ь)|ят|ил[аи]?).{0,80}(?:из\s+)?(?:банк|банка|налогов|полици|милици|мвд|прокуратур|суд|кадастр|госорган|оператор|связи)/.test(
      text,
    ) ||
    /(?:банк|банка|налогов|полици|милици|мвд|прокуратур|суд|кадастр|госорган|оператор|связи).{0,80}звон(?:ит(?!ь)|ят|ил[аи]?)/.test(
      text,
    ) ||
    /(?:^|\s)звон(?:ит(?!ь)|ят|ил[аи]?).{0,50}(?:мошен|скам|обман|развод|фишинг)/.test(text) ||
    /(?:^|\s)(?:мошен|скам|обман|развод|фишинг).{0,50}звон(?:ит(?!ь)|ят|ил[аи]?)/.test(text) ||
    /не кладите трубку/.test(text) ||
    /(?:hozir|xozir).{0,50}(qo'ng'iroq|qongiroq|telefon|zvon|call)/.test(text) ||
    /(?:menga|bizga).{0,80}(qo'ng'iroq|qongiroq|telefon|zvon|call).{0,80}(qilyap|qilish(?:yapti|moqda)|qilmoqda|kel(?:yapti|moqda))/u.test(
      text,
    ) ||
    /(?:menga|bizga).{0,80}(?:qo'ng'iroq|qongiroq|telefon|zvon|call).{0,40}qil(?:di|gan|ishdi).{0,100}(?:so['’]?ra|deyap|talab|kod|pul|o['’]?tkaz|blok|karta)/u.test(
      text,
    ) ||
    /(?:хозир|xozir).{0,50}(кунгирок|телефон|звон|call)/.test(text) ||
    /(?:менга|бизга).{0,80}(кунгирок|телефон|звон|call).{0,80}(киляп|килиш(?:япти|мокда)|килмокда|кел(?:япти|мокда))/u.test(
      text,
    ) ||
    /(?:менга|бизга).{0,80}(?:кунгирок|телефон|звон|call).{0,40}кил(?:ди|ган|ишди).{0,100}(?:сура|деяп|талаб|код|пул|утказ|блок|карта)/u.test(
      text,
    ) ||
    /(?:^|\s)(?:i|we)(?:'m| am|'re| are)?\s+(?:still\s+)?(?:on|in)\s+(?:a\s+)?(?:phone\s+)?(?:call|line)|(?:^|\s)(?:i|we)(?:'m| am|'re| are)?\s+(?:still\s+)?on\s+the\s+phone/.test(
      text,
    ) ||
    /(?:they|someone|the\s+caller|bank\s+caller).{0,40}(?:is|are|keeps?\s+)?(?:calling|on\s+the\s+phone|on\s+the\s+line)/.test(
      text,
    ) ||
    /(?:do\s+not|don't).{0,30}(?:hang\s+up|end\s+the\s+call)/.test(text)
  ) {
    return 6;
  }

  return null;
}

const QUOTED_OR_THIRD_PARTY_DONE_INTENT_PREFIX_RE =
  /(?:переслал|переслали|перешл|forward|forwarded|цитат|quote|скрин|screenshot|сообщени[ея]|message|xabar|он|она|они|мошенник|человек|клиент|пользователь|пострадавш|родственник|мама|папа|друг|they|he|she|someone|scammer|caller|user|client|victim|u\s+kishi).{0,80}(?:напис|пишет|сказ|говорит|сообщ|прислал|said|told|sent|wrote|yozdi|aytdi)/;

function isQuotedOrThirdPartyDoneIntent(text: string): boolean {
  const normalized = normalizeVoiceIntentText(text);
  if (
    /^(?:u\s+kishi|ular|scammer|caller|user|client|victim).{0,80}(?:yozdi|aytdi|said|told).{0,80}(?:men|biz|i|we)\s+/iu.test(
      normalized,
    )
  ) {
    return true;
  }
  const firstPersonIndex = normalized.search(/(?:^|\s)(?:я|мы|men|biz|i|we)\s+/);
  if (firstPersonIndex <= 0) return false;
  const prefix = normalized.slice(0, firstPersonIndex);
  return QUOTED_OR_THIRD_PARTY_DONE_INTENT_PREFIX_RE.test(prefix);
}

const TEXT_PANIC_DONE_INTENT_RE =
  /(?:^|\s)(?:(?:\u044f|\u043c\u044b)\s+(?:\u0443\u0436\u0435\s+)?.{0,50}(?:\u043e\u0442\u043f\u0440\u0430\u0432|\u0441\u043e\u043e\u0431\u0449|\u043d\u0430\u0437\u0432\u0430|\u0441\u043a\u0430\u0437\u0430|\u043f\u0435\u0440\u0435\u0434\u0430|\u043f\u0440\u043e\u0434\u0438\u043a\u0442|\u0443\u0441\u0442\u0430\u043d\u043e\u0432|\u0441\u043a\u0430\u0447|\u0437\u0430\u043f\u0443\u0441\u0442|\u043e\u0442\u043a\u0440|\u0440\u0430\u0437\u0440\u0435\u0448|\u0432\u043a\u043b\u044e\u0447|\u0434\u0430\u043b|\u0441\u0434\u0435\u043b\u0430|\u043f\u0435\u0440\u0435\u0432|\u043e\u043f\u043b\u0430\u0442|\u043f\u043e\u043f\u043e\u043b\u043d|\u0432\u0432\u0435|\u0432\u0432\u0451|\u0432\u0431\u0438|\u0443\u043a\u0430\u0437|\u0441\u043a\u0430\u043d|\u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434)|(?:men|biz).{0,50}(?:yub[oa]rdim|jo['\u2019]?natdim|jonatdim|aytdim|berdim|kiritdim|o['\u2019]?rnatdim|ornatdim|yukladim|ochdim|ruxsat berdim|o['\u2019]?tkazdim|otkazdim|to['\u2019]?ladim|toladim|skaner qildim|scan qildim|tasdiqladim)|(?:мен|биз).{0,50}(?:юбордим|жунатдим|айтдим|бердим|киритдим|урнатдим|юкладим|очдим|рухсат бердим|утказдим|толадим|сканер килдим|scan килдим|тасдикладим)|(?:i|we)\s+(?:(?:have|has)\s+)?(?:already\s+)?(?:sent|shared|gave|given|told|read|dictated|entered|typed|confirmed|approved|installed|downloaded|opened|started|allowed|enabled|transferred|paid|topped\s+up|scanned))/i;

// First-person "already done" phrasings that omit an explicit subject. The
// Uzbek -dim suffix is first person by itself, and Russian victims often drop
// «я» («отправил код»). Anchored/whole-word so forwarded scam imperatives
// («отправьте код», «yuboring») do not pass the done-intent gate.
const TEXT_PANIC_DONE_INTENT_BARE_RE =
  /(?:^|[\s,.;:!?])(?:yub[oa]rdim|jo['’]?natdim|jonatdim|aytdim|berdim|kiritdim|o['’]?rnatdim|ornatdim|yukladim|ochdim|ruxsat\s+berdim|o['’]?tkazdim|otkazdim|to['’]?ladim|toladim|skaner\s+qildim|scan\s+qildim|tasdiqladim|юбордим|жунатдим|айтдим|бердим|киритдим|урнатдим|юкладим|очдим|рухсат\s+бердим|утказдим|толадим|тасдикладим)(?=$|[\s,.;:!?])|^(?:уже\s+)?(?:отправил|сообщил|назвал|сказал|передал|продиктовал|скинул|дал)[аи]?\s/i;

export function classifyLiveCallContext(text: string | undefined): LiveCallContext {
  const normalized = normalizeVoiceIntentText(text ?? "");
  if (!normalized) return "generic";

  if (
    /(?:родствен|близк|мама|папа|бабушк|дедушк|сын|дочь|брат|сестр|внук|внуч|друг|подруг|ona(?:m|ngiz)?|ota(?:m|ngiz)?|aka(?:m|ngiz)?|uka(?:m|ngiz)?|opa(?:m|ngiz)?|sing(?:il|lim|lingiz)|qarindosh|yaqin|mother|father|mom|dad|sister|brother|grandma|grandpa|relative|friend|loved\s+one).{0,180}(?:сроч|деньг|перевод|помощ|авар|машин|больниц|операци|лечение|код|карта|shoshil|zudlik|muammo|pul|o['’]?tkaz|yordam|avariya|mashina|kasalxona|kod|karta|urgent|money|transfer|help|accident|car|hospital|code|card)|(?:сроч|деньг|перевод|помощ|авар|машин|больниц|операци|лечение|код|карта|shoshil|zudlik|muammo|pul|o['’]?tkaz|yordam|avariya|mashina|kasalxona|kod|karta|urgent|money|transfer|help|accident|car|hospital|code|card).{0,180}(?:родствен|близк|мама|папа|бабушк|дедушк|сын|дочь|брат|сестр|внук|внуч|друг|подруг|ona(?:m|ngiz)?|ota(?:m|ngiz)?|aka(?:m|ngiz)?|uka(?:m|ngiz)?|opa(?:m|ngiz)?|sing(?:il|lim|lingiz)|qarindosh|yaqin|mother|father|mom|dad|sister|brother|grandma|grandpa|relative|friend|loved\s+one)/iu.test(
      normalized,
    )
  ) {
    return "relative";
  }

  if (
    /(?:налогов|налог|фнс|солик|солиқ|soliq|one\s?id|oneid|my\.gov|id\.gov|gov\.uz|госуслуг|госорган|давлат|pinfl|пинфл|jshshir|полици|милици|мвд|ииб|iib|прокуратур|prokuratura|суд|court|sud|кадастр|kadastr|нотариус|notary|юрист|lawyer|коллектор|tax|government|police|prosecutor)/iu.test(
      normalized,
    )
  ) {
    return "government";
  }

  if (
    /(?:оператор|связи|сим|sim|билайн|beeline|ucell|юселл|мобиуз|mobiuz|uzmobile|узмобайл|uztelecom|узтелеком|telecom|operator|aloqa|raqamni\s+ko['’]?chir|nomer)/iu.test(
      normalized,
    )
  ) {
    return "operator";
  }

  if (
    /(?:банк|bank|карта|karta|card|humo|uzcard|kapitalbank|uzum|anorbank|hamkor|ипотека\s*банк|нацбанк|нбу|central\s+bank|марказий\s+банк)/iu.test(
      normalized,
    )
  ) {
    return "bank";
  }

  return "generic";
}

export function classifyTextPanicIntent(
  text: string,
  source?: TelegramForwardSourceContext,
): PanicScenarioId | null {
  if (source) return null;
  // Do not let the Latin-keyboard fallback reinterpret a quoted third-party
  // statement as the current user's own completed action.
  if (isQuotedOrThirdPartyDoneIntent(text)) return null;
  const direct = classifyGatedTextPanicIntent(text);
  if (direct !== null) return direct;
  // Latin-keyboard fallback: «ya perevel dengi», «vzlomali telegram».
  const translit = transliterateRuLatin(normalizeVoiceIntentText(text));
  return translit === null ? null : classifyGatedTextPanicIntent(translit);
}

function classifyGatedTextPanicIntent(text: string): PanicScenarioId | null {
  if (isQuotedOrThirdPartyDoneIntent(text)) return null;
  const normalized = normalizeVoiceIntentText(text);
  const panicId = classifyVoicePanicIntent(text);
  if (panicId === null) return null;
  if (panicId === 6) return panicId;
  if (
    panicId === 5 &&
    /(?:потерял[аи]?|украли|взломали|угнали|забрали|не\s+могу|не\s+получается).{0,80}(?:telegram|телеграм|аккаунт)/.test(
      normalized,
    )
  ) {
    return panicId;
  }
  return TEXT_PANIC_DONE_INTENT_RE.test(normalized) ||
    TEXT_PANIC_DONE_INTENT_BARE_RE.test(normalized)
    ? panicId
    : null;
}

import { describe, expect, it } from "vitest";
import { classifyVictimIntent } from "@/lib/telegram/victim-intent";

describe("classifyVictimIntent", () => {
  it.each([
    ["помогите", "emotional_help"],
    ["мне нужна помощь", "emotional_help"],
    ["я боюсь", "emotional_help"],
    ["меня пытаются обмануть", "general_scam_concern"],
    ["звонил мошенник", "general_scam_concern"],
    ["я думаю это мошенники", "general_scam_concern"],
    ["мне пишут в телеграме", "telegram_message"],
    ["мне что то прислали", "telegram_message"],
    ["мне звонит неизвестный номер", "unknown_call"],
    ["мне звонят прямо сейчас", "unknown_call"],
    ["звонят с незнакомого номера", "unknown_call"],
    ["menga noma'lum raqamdan qo'ng'iroq qilishyapti", "unknown_call"],
    ["мне прислали ссылку", "link_received"],
    ["мне прислали файл", "file_received"],
    ["у меня просят код", "code_request"],
    ["нужно ли давать код", "code_request"],
    ["у меня просят карту", "card_request"],
    ["мне сказали перевести деньги", "transfer_request"],
    ["меня просят установить приложение", "apk_request"],
    ["у меня просят ссылку", "link_request"],
    ["у меня просят паспорт", "personal_data_request"],
    ["у меня просят пинфл", "personal_data_request"],
    ["menga pasport so'rashyapti", "personal_data_request"],
    ["мне звонили из банка", "bank_call"],
    ["звонили и говорили что карта заблокирована", "bank_call"],
    ["мне звонит фейковый майор", "authority_impersonation"],
    ["мне звонят из прокуратуры", "authority_impersonation"],
    ["мне пишет следователь", "authority_impersonation"],
    ["мне пишет тот кто говорит что он из кадастра", "authority_impersonation"],
    ["мне пишет незнакомый человек", "unknown_contact"],
    ["мне пишет одноклассник но я не уверен что это он", "identity_uncertain"],
    ["мне написал друг и просит деньги", "friend_money"],
    ["мне пишет кто-то из техподдержки", "support_impersonation"],
    ["мне пишет девушка из интернета", "romance_contact"],
    ["девушка из интернета просит деньги на билет", "romance_money"],
    ["новый знакомый говорит любит и просит деньги на билет", "romance_money"],
    ["мне пишет работодатель", "job_offer"],
    ["работодатель просит оплатить обучение перед работой", "job_offer"],
    ["работа просит внести депозит за форму", "job_offer"],
    ["меня приглашают в канал для заработка", "job_offer"],
    ["мне предлагают инвестировать в крипту через телеграм канал", "investment_offer"],
    ["зовут в крипто канал с платными сигналами", "investment_offer"],
    ["агентство обещает визу в Корею но просит предоплату", "travel_migration_prepayment"],
    ["турфирма просит оплатить хадж заранее", "travel_migration_prepayment"],
    ["menga Koreyaga viza uchun oldindan to'lov so'rashyapti", "travel_migration_prepayment"],
    ["мне пишет тот кто представляется нотариусом", "legal_impersonation"],
    ["мне пишет нотариус и требует оплатить штраф", "legal_impersonation"],
    ["как мне связаться с банком", "bank_contact_question"],
    ["какой номер банка", "bank_contact_question"],
    ["куда пожаловаться на мошенника", "report_question"],
    ["куда звонить если меня обманули", "report_question"],
    ["спасибо", "acknowledgement"],
    ["хорошо сделаю", "acknowledgement"],
    ["Salom", "trust_or_greeting"],
    ["salom sizga ishonsam boladimi", "trust_or_greeting"],
    ["meni aldayapti", "general_scam_concern"],
    ["menga kod so'rashyapti", "code_request"],
    ["menga nimadir yuborishdi", "telegram_message"],
    ["hello are you a scam", "trust_or_greeting"],
    ["what should I do", "advice_question"],
    ["someone asked me for a verification code", "code_request"],
  ])("maps '%s' to %s", (text, kind) => {
    expect(classifyVictimIntent(text)?.kind).toBe(kind);
  });

  it("keeps concrete artifacts on the risk pipeline", () => {
    expect(classifyVictimIntent("https://kapitalbank.uz.evil.example/login")).toBeNull();
    expect(classifyVictimIntent("+998901234567")).toBeNull();
    expect(classifyVictimIntent("@lucky_promo")).toBeNull();
  });

  it("keeps direct scammer payloads on the risk pipeline", () => {
    expect(
      classifyVictimIntent(
        "Служба безопасности Kapitalbank. Ваша карта заблокирована. Назовите код из SMS.",
      ),
    ).toBeNull();
    expect(classifyVictimIntent("Salom, men bank xodimi, kodingizni ayting.")).toBeNull();
  });
});

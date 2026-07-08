# Telegram Live Victim Phrase Corpus

Status: WIP QA corpus for Telegram chat and inline behavior.

Regression lock: 201 live phrases are currently enforced through
`src/lib/telegram/live-phrase-cases.ts` and
`src/lib/telegram/handlers/check.followup-routing.test.ts`.

Goal: make the bot understand victim-framed, human phrases before the risk engine. These are not always scam payloads. They are user intents: fear, uncertainty, context, advice request, or "what should I do now?"

Expected behavior:

- Do not answer with a cold "insufficient data" card.
- Do not invent a verdict when there is no artifact.
- Ask for the missing artifact or route to an immediate safe step.
- Keep direct scam payloads in the normal risk engine.

## Emergency / Emotion

Expected intent: `emotional_help` or `general_scam_concern`.

```text
помогите
срочно помогите
мне нужна помощь
я не знаю что делать
я боюсь
мне страшно
меня обманывают
меня пытаются обмануть
я думаю это мошенники
похоже это скам
кажется меня разводят
я запутался
я волнуюсь
мне сейчас плохо, что делать
помогите мне звонят
не понимаю, можно ли им верить
meni aldayapti
meni aldashmoqchi
yordam kerak
qo'rqyapman
hello I need help
I think this is a scam
someone is trying to scam me
I am scared
```

## Situation Description

Expected intent: collect context, ask for the exact request, or route to live-call help.

```text
мне звонят прямо сейчас
мне звонят с незнакомого номера
мне звонит неизвестный номер
звонят с другого города
звонят с зарубежного номера
мне звонят ночью
мне звонили из банка
мне позвонила служба безопасности
со мной связался сотрудник банка
звонили и говорили что карта заблокирована
мне звонит майор
мне звонит фейковый майор
мне звонят из полиции
мне звонят из прокуратуры
мне звонят из налоговой
мне пишут в телеграме
мне написал незнакомый человек
мне прислали ссылку
мне скинули линк
мне прислали файл
мне отправили APK
мне прислали QR
у меня просят код
у меня просят ссылку
у меня просят карту
у меня просят перевод
у меня просят установить приложение
у меня просят паспорт
у меня просят ПИНФЛ
у меня просят фото документов
у меня просят адрес прописки
у меня просят дату рождения
menga qo'ng'iroq qilishyapti
menga noma'lum raqamdan qo'ng'iroq qilishyapti
menga politsiyadan qo'ng'iroq qilishdi
menga mayor qilib qo'ng'iroq qildi
menga telegramda yozishyapti
menga havola yuborishdi
menga fayl yuborishdi
menga kod so'rashyapti
menga karta so'rashyapti
menga pasport so'rashyapti
menga JSHSHIR so'rashyapti
menga pul o'tkaz deyapti
someone is calling me
an unknown number is calling me
someone says they are police
someone sent me a link
someone sent me a file
they asked me for a code
they asked for my card
they asked for my passport
they told me to transfer money
```

## Advice Questions

Expected intent: answer with a safe step, not a risk score.

```text
что мне делать
что мне делать если меня обманули
как понять что это мошенник
это точно мошенник
нужно ли давать код
можно ли ему отвечать
что отвечать мошеннику
что мне ей ответить
как мне проверить номер
как мне проверить ссылку
как мне связаться с банком
какой номер банка
какой номер полиции
куда звонить если я дал код
куда звонить если меня обманули
куда обращаться если обманули
куда пожаловаться на мошенника
как пожаловаться на номер
можно ли открыть ссылку
можно ли сканировать QR
что делать если я открыл ссылку
что делать если мне угрожают
nima qilay
kodni aytishim kerakmi
havolani ochsam bo'ladimi
bankka qanday bog'lansam bo'ladi
politsiyaga qanday murojaat qilaman
meni aldagani qayerga shikoyat qilaman
what should I do
should I give the code
should I open the link
how do I call the bank
where do I report a scam
how do I know if this is a scam
```

## Contact / Identity Uncertainty

Expected intent: ask for username, message text, screenshot, or verify identity out-of-band.

```text
мне пишет незнакомый человек
мне пишет какой-то человек
мне пишет одноклассник но я не уверен что это он
мне написал друг и просит деньги
мне пишет родственник и просит срочно помочь
мне пишет бот от имени банка
мне пишет кто-то из техподдержки
мне пишет служба безопасности
мне пишет девушка из интернета
мне пишет парень из телеграма
мне пишет работодатель
мне пишет нотариус
мне пишет юрист
мне пишет коллектор
мне пишет полиция
мне пишет фейковый майор
мне пишет следователь
мне пишет прокуратура
мне пишет налоговая
мне пишет тот кто говорит что он из кадастра
menga notanish odam yozdi
menga mayor qilib yozdi
menga prokuratura nomidan yozdi
do'stim pul so'rayapti
bank nomidan bot yozdi
menga ish beruvchi yozdi
someone I don't know messaged me
my friend is asking for money
someone says they are bank support
a girl from the internet is asking for help
an employer is messaging me
```

## Personal Data Requests

Expected intent: `personal_data_request`.

```text
у меня просят паспорт
у меня просят фото паспорта
у меня просят ПИНФЛ
у меня просят JSHSHIR
у меня просят ИНН
у меня просят дату рождения
у меня просят адрес
у меня просят прописку
у меня просят фото ID
мне сказали отправить документы
мне сказали заполнить анкету с паспортом
menga pasport so'rashyapti
menga hujjat rasmini so'rashyapti
menga JSHSHIR so'rashyapti
menga manzil so'rashyapti
they asked for my passport
they asked for my ID
they asked for my address
they asked for my date of birth
```

## Already Did Something

Expected intent: SOS/panic route, not generic context request.

```text
я уже перевёл деньги
я перевёл деньги мошеннику
я уже отправил код
я уже назвал код из смс
я отправил им код
я уже дал номер карты
я уже дал cvv
я уже ввёл данные карты
я уже установил приложение
я установил apk
я уже открыл ссылку и ввёл пароль
я уже сканировал QR
я уже подтвердил операцию
я уже сказал паспортные данные
men kodni yubordim
men pul o'tkazdim
men kartani berdim
men apk o'rnatdim
I already sent the code
I already transferred money
I already installed the app
I already gave my card details
```

## Trust / Bot Identity / Greeting

Expected intent: reassure and explain scope.

```text
Salom
salom sizga ishonsam boladimi
привет
привет это точно бот
что это за бот
а вы кто
как ты работаешь
вы настоящий бот?
можно вам доверять?
ты не мошенник?
hello
hello are you a scam
who are you
can I trust this bot
how do you work
```

## Acknowledgements After Safety Advice

Expected intent: `acknowledgement`; answer warmly, do not run a fake risk check.

```text
спасибо
хорошо
хорошо сделаю
понял
понятно
ок
готово
сделаю
рахмат
rahmat
tushunarli
mayli
thanks
done
```

## Direct Scam Payloads

Expected behavior: keep in risk engine. Should be at least suspicious/high risk.

```text
Служба безопасности Kapitalbank. Ваша карта заблокирована. Назовите код из SMS.
Центральный банк: ваш счёт заморожен. Переведите на безопасный счёт.
Поздравляем! Вы выиграли 5000$. Оплатите комиссию 50$ для получения.
Здравствуйте, это OneID. Ваш аккаунт заблокирован. Перейдите по ссылке.
Курьер не может доставить посылку. Оплатите пошлину по ссылке.
Это поддержка Telegram. Ваш аккаунт будет удалён. Отмена здесь: [ссылка]
Вам одобрен кредит без справок. Установите приложение для получения.
Мама, у меня авария, срочно нужны деньги на операцию.
Ваш родственник задержан. Срочно переведите деньги.
Установите AnyDesk для проверки безопасности карты.
Salom, men bank xodimi, kodingizni ayting.
Ваш PNFL заблокирован, перейдите на gov-verify.xyz
Заработок на крипте, +30% в день. Регистрируйтесь: t.me/+abc
NFT раздача Stars, проголосуйте капчей: [ссылка]
Введите последние 4 цифры вашей карты для подтверждения.
Ваш аккаунт Telegram истекает. Войдите через QR для продления.
```

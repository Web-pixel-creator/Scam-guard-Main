// Last-resort page when server rendering itself fails. The visitor's language
// may be unknown here, so it speaks all three. It must work under the site CSP:
// no inline handlers or <style> blocks (only style attributes are allowed), so
// "reload" is a plain link to the same URL.
const H = "font-size:1.25rem;margin:0 0 0.5rem";
const P = "color:#4b5563;margin:0 0 1rem";
const A =
  "display:inline-block;padding:0.75rem 1rem;min-height:44px;box-sizing:border-box;border-radius:0.375rem;font:inherit;text-decoration:none;border:1px solid";

export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>Страница не загрузилась · Sahifa yuklanmadi · This page didn't load</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font:15px/1.5 system-ui,-apple-system,sans-serif;background:#fafafa;color:#111;display:grid;place-items:center;min-height:100vh;margin:0;padding:1.5rem;box-sizing:border-box">
    <div style="max-width:28rem;width:100%;text-align:center;padding:2rem">
      <h1 style="${H}">Страница не загрузилась</h1>
      <p style="${P}">Что-то пошло не так на нашей стороне. Обновите страницу или вернитесь на главную.</p>
      <h2 lang="uz" style="${H}">Sahifa yuklanmadi</h2>
      <p lang="uz" style="${P}">Biz tomonda nimadir xato ketdi. Sahifani yangilang yoki bosh sahifaga qayting.</p>
      <h2 lang="en" style="${H}">This page didn't load</h2>
      <p lang="en" style="${P}">Something went wrong on our end. Reload the page or go back home.</p>
      <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;margin-top:1.5rem">
        <a class="primary" href="" style="${A} #111;background:#111;color:#fff">Обновить · Yangilash · Reload</a>
        <a class="secondary" href="/" style="${A} #d1d5db;background:#fff;color:#111">На главную · Bosh sahifa · Home</a>
      </div>
    </div>
  </body>
</html>`;
}

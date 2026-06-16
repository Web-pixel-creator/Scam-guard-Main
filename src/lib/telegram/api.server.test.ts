// Unit-тесты для getFile / downloadFileAsDataUrl из api.server.ts (Task 5.3).
//
// Покрывают серверные хелперы скачивания файлов Bot API:
//   - getFile: разбор конверта Bot API в { filePath, fileSize } и все
//     отказные ветки (нет file_path, не-ok HTTP, нет токена).
//   - downloadFileAsDataUrl: лимит 6 МБ (MAX_FILE_BYTES) по Content-Length и
//     потоково, MIME-резолвинг (Content-Type → расширение → octet-stream),
//     обе ветки readCapped (body.getReader и fallback на arrayBuffer),
//     не-ok HTTP и отсутствие токена.
//
// Изоляция от сети и секретов:
//   - глобальный fetch подменяется через vi.stubGlobal('fetch', vi.fn());
//   - getTelegramBotToken мокается (vi.mock на "@/lib/config.server"), по
//     умолчанию возвращает фиктивный токен; для кейса «нет токена» —
//     vi.mocked(...).mockReturnValue(undefined). Это детерминированнее, чем
//     полагаться на TELEGRAM_BOT_TOKEN из vitest.setup.ts.
//
// _Requirements: 5.3, 5.5_
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTelegramBotToken } from "@/lib/config.server";
import { getFile, downloadFileAsDataUrl, answerInlineQuery } from "./api.server";

// Мокаем источник токена. Фабрика hoisted наверх — реализацию переопределяем
// в каждом тесте через vi.mocked(getTelegramBotToken).
vi.mock("@/lib/config.server", () => ({
  getTelegramBotToken: vi.fn(() => "fake-token"),
}));

const TOKEN = "fake-token";
const MAX_FILE_BYTES = 6 * 1024 * 1024;

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  vi.mocked(getTelegramBotToken).mockReturnValue(TOKEN);
  // Хелперы логируют ошибки через console.error — глушим, чтобы не зашумлять вывод.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// getFile
// ---------------------------------------------------------------------------

describe("getFile", () => {
  it("успешный ответ { ok:true, result:{ file_path, file_size } } → { filePath, fileSize }", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          result: { file_path: "photos/file_42.jpg", file_size: 2048 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await getFile("AgACfileid");

    expect(result).toEqual({ filePath: "photos/file_42.jpg", fileSize: 2048 });

    // Форма запроса к Bot API: POST <base><token>/getFile с JSON-телом { file_id }.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/getFile`);
    expect(init).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    expect(JSON.parse(init.body)).toEqual({ file_id: "AgACfileid" });
  });

  it("file_size отсутствует → fileSize по умолчанию 0", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { file_path: "docs/x.png" } }), {
        status: 200,
      }),
    );

    const result = await getFile("id");
    expect(result).toEqual({ filePath: "docs/x.png", fileSize: 0 });
  });

  it("ответ без file_path → null", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: { file_size: 10 } }), { status: 200 }),
    );

    expect(await getFile("id")).toBeNull();
  });

  it("конверт с ok:false → null", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: false, description: "bad" }), { status: 200 }),
    );

    expect(await getFile("id")).toBeNull();
  });

  it("не-ok HTTP → null", async () => {
    fetchMock.mockResolvedValue(new Response("server error", { status: 500 }));

    expect(await getFile("id")).toBeNull();
  });

  it("отсутствие токена → null, fetch не вызывается", async () => {
    vi.mocked(getTelegramBotToken).mockReturnValue(undefined);

    expect(await getFile("id")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// answerInlineQuery
// ---------------------------------------------------------------------------

describe("answerInlineQuery", () => {
  it("posts article results to Telegram with inline-mode options", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, result: true }), { status: 200 }),
    );

    const result = await answerInlineQuery({
      inlineQueryId: "inline-1",
      cacheTime: 2,
      isPersonal: true,
      results: [
        {
          type: "article",
          id: "check-high",
          title: "High risk",
          description: "Do not send codes",
          input_message_content: {
            message_text: "High risk",
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true,
          },
          reply_markup: {
            inline_keyboard: [[{ text: "Open", url: "https://t.me/scamguard_bot" }]],
          },
        },
      ],
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/answerInlineQuery`);
    expect(JSON.parse(init.body)).toEqual({
      inline_query_id: "inline-1",
      cache_time: 2,
      is_personal: true,
      results: [
        {
          type: "article",
          id: "check-high",
          title: "High risk",
          description: "Do not send codes",
          input_message_content: {
            message_text: "High risk",
            parse_mode: "MarkdownV2",
            disable_web_page_preview: true,
          },
          reply_markup: {
            inline_keyboard: [[{ text: "Open", url: "https://t.me/scamguard_bot" }]],
          },
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// downloadFileAsDataUrl
// ---------------------------------------------------------------------------

describe("downloadFileAsDataUrl", () => {
  it("отсутствие токена → null, fetch не вызывается", async () => {
    vi.mocked(getTelegramBotToken).mockReturnValue(undefined);

    expect(await downloadFileAsDataUrl("photos/x.jpg")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("не-ok HTTP при скачивании → null", async () => {
    fetchMock.mockResolvedValue(new Response("not found", { status: 404 }));

    expect(await downloadFileAsDataUrl("photos/x.jpg")).toBeNull();

    // URL скачивания идёт на file-эндпоинт: <fileBase><token>/<filePath>.
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.telegram.org/file/bot${TOKEN}/photos/x.jpg`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("Content-Length > 6 МБ → null без буферизации (body.cancel вызван, тело не дочитано)", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const getReader = vi.fn();
    const arrayBuffer = vi.fn();

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({
        "content-length": String(MAX_FILE_BYTES + 1),
        "content-type": "image/jpeg",
      }),
      body: { cancel, getReader },
      arrayBuffer,
    });

    const result = await downloadFileAsDataUrl("photos/big.jpg");

    expect(result).toBeNull();
    // Тело отменено и НЕ дочитано: ни getReader, ни arrayBuffer не вызывались.
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(getReader).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it("потоковое превышение лимита (нет Content-Length, тело > 6 МБ) → null, reader.cancel вызван", async () => {
    const oneMb = new Uint8Array(1024 * 1024);
    let reads = 0;
    const read = vi.fn(async () => {
      reads += 1;
      // 7 чанков по 1 МБ = 7 МБ > 6 МБ — лимит будет превышен потоково.
      if (reads <= 7) return { done: false, value: oneMb };
      return { done: true, value: undefined };
    });
    const cancel = vi.fn().mockResolvedValue(undefined);

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      // Без content-length — ранняя проверка по заголовку не срабатывает.
      headers: new Headers({ "content-type": "image/jpeg" }),
      body: { getReader: () => ({ read, cancel }) },
    });

    const result = await downloadFileAsDataUrl("photos/stream.jpg");

    expect(result).toBeNull();
    expect(cancel).toHaveBeenCalledTimes(1);
    // Чтение прервано на 7-м чанке (6 МБ == лимит не превышает, 7-й даёт 7 МБ).
    expect(read).toHaveBeenCalledTimes(7);
  });

  it("валидный небольшой файл (ветка body.getReader) → data:<mime>;base64,... с корректным base64", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    fetchMock.mockResolvedValue(
      new Response(bytes, { status: 200, headers: { "content-type": "image/png" } }),
    );

    const result = await downloadFileAsDataUrl("photos/small.png");

    expect(result).not.toBeNull();
    expect(result!.startsWith("data:image/png;base64,")).toBe(true);

    // Декодируем base64 обратно и сверяем байты.
    const b64 = result!.slice("data:image/png;base64,".length);
    const decoded = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual([1, 2, 3, 4, 5]);
  });

  it("MIME из расширения файла при отсутствии Content-Type (ветка arrayBuffer fallback): photo.jpg → image/jpeg", async () => {
    const bytes = new Uint8Array([10, 20, 30]);
    const arrayBuffer = vi.fn(async () => bytes.buffer);

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(), // нет content-type и content-length
      body: undefined, // нет getReader → readCapped уходит в fallback arrayBuffer
      arrayBuffer,
    });

    const result = await downloadFileAsDataUrl("uploads/photo.jpg");

    expect(arrayBuffer).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result!.startsWith("data:image/jpeg;base64,")).toBe(true);

    const b64 = result!.slice("data:image/jpeg;base64,".length);
    const decoded = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(Array.from(decoded)).toEqual([10, 20, 30]);
  });

  it("Content-Type application/octet-stream игнорируется → MIME из расширения: image.png → image/png", async () => {
    const bytes = new Uint8Array([42]);
    fetchMock.mockResolvedValue(
      new Response(bytes, {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      }),
    );

    const result = await downloadFileAsDataUrl("uploads/image.png");

    expect(result).not.toBeNull();
    expect(result!.startsWith("data:image/png;base64,")).toBe(true);
  });
});

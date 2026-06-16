import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type QaSection = {
  index: number;
  title: string;
  text: string;
  buttons: Array<{ label: string; target: string }>;
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPORT_PATH = resolve(ROOT, "ai_docs", "TELEGRAM_BOT_QA_REPORT.md");
const OUTPUT_DIR = resolve(ROOT, "output", "playwright");
const OUTPUT_PATH = resolve(OUTPUT_DIR, "telegram-bot-qa.html");

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function stripMarkdown(value: string): string {
  return value
    .replaceAll("\\.", ".")
    .replaceAll("\\-", "-")
    .replaceAll("\\_", "_")
    .replaceAll("\\*", "*")
    .replaceAll("\\(", "(")
    .replaceAll("\\)", ")")
    .replaceAll("\\!", "!")
    .replaceAll("\\[", "[")
    .replaceAll("\\]", "]")
    .replaceAll("\\+", "+")
    .replaceAll("\\=", "=")
    .replaceAll("\\|", "|")
    .replaceAll("\\#", "#");
}

function parseSections(markdown: string): QaSection[] {
  const sectionPattern = /^##\s+(\d+)\.\s+(.+)$/gm;
  const matches = [...markdown.matchAll(sectionPattern)];

  return matches.map((match, position) => {
    const start = match.index ?? 0;
    const end = matches[position + 1]?.index ?? markdown.length;
    const body = markdown.slice(start, end);
    const text = body.match(/```text\s*([\s\S]*?)```/)?.[1]?.trim() ?? "";
    const buttons = [...body.matchAll(/- \[(.+?)\] \((.+?)\)/g)].map((button) => ({
      label: stripMarkdown(button[1]),
      target: button[2],
    }));

    return {
      index: Number(match[1]),
      title: stripMarkdown(match[2]),
      text: stripMarkdown(text),
      buttons,
    };
  });
}

function cardClass(section: QaSection): string {
  const haystack = `${section.title}\n${section.text}`.toLowerCase();
  if (haystack.includes("высокий риск") || haystack.includes("high_risk")) return "risk-high";
  if (haystack.includes("требуется осторожность") || haystack.includes("suspicious")) {
    return "risk-warn";
  }
  if (haystack.includes("безопасно") || haystack.includes("safe")) return "risk-safe";
  return "risk-unknown";
}

function renderButtons(section: QaSection): string {
  if (section.buttons.length === 0) {
    return `<div class="no-buttons">No buttons</div>`;
  }

  return `<div class="keyboard">${section.buttons
    .map((button) => {
      const target = escapeHtml(button.target);
      return `<button title="${target}">${escapeHtml(button.label)}</button>`;
    })
    .join("")}</div>`;
}

function renderCard(section: QaSection): string {
  return `<article class="card ${cardClass(section)}">
    <div class="meta">
      <span>#${section.index}</span>
      <strong>${escapeHtml(section.title)}</strong>
    </div>
    <pre>${escapeHtml(section.text)}</pre>
    ${renderButtons(section)}
  </article>`;
}

function renderHtml(sections: QaSection[]): string {
  const longSections = sections.filter((section) => section.text.length > 1200).length;
  const withManyButtons = sections.filter((section) => section.buttons.length > 6).length;

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Ishonch Guard Telegram QA</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #d8ebbf;
      --bubble: #fff;
      --ink: #111827;
      --muted: #64748b;
      --line: #d7dee8;
      --button: rgba(84, 132, 66, 0.72);
      --button-text: #fff;
      --safe: #16a34a;
      --warn: #f59e0b;
      --high: #dc2626;
      --unknown: #94a3b8;
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at 16px 16px, rgba(80, 120, 70, .12) 0 2px, transparent 3px),
        linear-gradient(135deg, #d6ebb8, #b8d79f);
      background-size: 44px 44px, auto;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 10;
      padding: 18px 24px;
      border-bottom: 1px solid rgba(0, 0, 0, .08);
      background: rgba(245, 250, 241, .92);
      backdrop-filter: blur(14px);
    }
    header h1 {
      margin: 0 0 8px;
      font-size: 22px;
      line-height: 1.2;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
    }
    .summary span {
      padding: 6px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #fff;
    }
    main {
      width: min(1180px, calc(100% - 24px));
      margin: 18px auto 36px;
      columns: 2 420px;
      column-gap: 18px;
    }
    .card {
      display: inline-block;
      width: 100%;
      margin: 0 0 18px;
      break-inside: avoid;
    }
    .meta {
      display: flex;
      gap: 10px;
      align-items: center;
      margin: 0 0 8px 18px;
      color: var(--muted);
      font-size: 12px;
    }
    .meta span {
      min-width: 34px;
      padding: 3px 8px;
      border-radius: 999px;
      color: #fff;
      text-align: center;
      background: var(--unknown);
    }
    .risk-safe .meta span { background: var(--safe); }
    .risk-warn .meta span { background: var(--warn); }
    .risk-high .meta span { background: var(--high); }
    .meta strong {
      color: #334155;
      font-weight: 700;
    }
    pre {
      margin: 0;
      padding: 18px 20px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: inherit;
      font-size: 16px;
      line-height: 1.42;
      background: var(--bubble);
      border-radius: 18px;
      box-shadow: 0 2px 1px rgba(15, 23, 42, .04), 0 12px 28px rgba(15, 23, 42, .08);
    }
    .keyboard {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 2px;
      margin-top: 3px;
      overflow: hidden;
      border-radius: 8px;
    }
    .keyboard button {
      min-height: 38px;
      padding: 8px 10px;
      border: 0;
      color: var(--button-text);
      background: var(--button);
      font: inherit;
      font-weight: 700;
      line-height: 1.15;
    }
    .keyboard button:nth-last-child(1):nth-child(odd) {
      grid-column: 1 / -1;
    }
    .no-buttons {
      margin: 6px 0 0 18px;
      color: var(--muted);
      font-size: 12px;
    }
  </style>
</head>
<body>
  <header>
    <h1>Ishonch Guard Telegram QA</h1>
    <div class="summary">
      <span>${sections.length} responses</span>
      <span>${longSections} over 1200 chars</span>
      <span>${withManyButtons} with 7+ buttons</span>
      <span>Generated from ai_docs/TELEGRAM_BOT_QA_REPORT.md</span>
    </div>
  </header>
  <main>
    ${sections.map(renderCard).join("\n")}
  </main>
</body>
</html>`;
}

const markdown = readFileSync(REPORT_PATH, "utf8");
const sections = parseSections(markdown);
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT_PATH, renderHtml(sections), "utf8");

console.log(`Telegram visual QA report written: ${OUTPUT_PATH}`);

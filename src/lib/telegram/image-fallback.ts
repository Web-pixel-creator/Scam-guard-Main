import type { Lang } from "@/lib/i18n";
import type { InlineKeyboard } from "@/lib/telegram/api.server";
import { bt, type BotStringKey } from "@/lib/telegram/bot-i18n";
import { CB } from "@/lib/telegram/format";

export type ImageTriageKind =
  | "gift"
  | "casino"
  | "wallet"
  | "bank"
  | "telegram_profile"
  | "qr_menu";

const IMAGE_TRIAGE_PREFIX = "imgtriage:";

const IMAGE_TRIAGE_KINDS: readonly ImageTriageKind[] = [
  "gift",
  "casino",
  "wallet",
  "bank",
  "telegram_profile",
  "qr_menu",
];

const TRIAGE_TEXT_KEY: Record<ImageTriageKind, BotStringKey> = {
  gift: "image_triage_gift",
  casino: "image_triage_casino",
  wallet: "image_triage_wallet",
  bank: "image_triage_bank",
  telegram_profile: "image_triage_telegram_profile",
  qr_menu: "image_triage_qr_menu",
};

export function imageTriageCallback(kind: ImageTriageKind): string {
  return `${IMAGE_TRIAGE_PREFIX}${kind}`;
}

export function parseImageTriageCallback(data: string): ImageTriageKind | null {
  if (!data.startsWith(IMAGE_TRIAGE_PREFIX)) return null;
  const kind = data.slice(IMAGE_TRIAGE_PREFIX.length);
  return (IMAGE_TRIAGE_KINDS as readonly string[]).includes(kind)
    ? (kind as ImageTriageKind)
    : null;
}

export function buildImageTriageKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: bt("btn_image_triage_gift", lang), callback_data: imageTriageCallback("gift") },
      { text: bt("btn_image_triage_casino", lang), callback_data: imageTriageCallback("casino") },
    ],
    [
      { text: bt("btn_image_triage_wallet", lang), callback_data: imageTriageCallback("wallet") },
      { text: bt("btn_image_triage_bank", lang), callback_data: imageTriageCallback("bank") },
    ],
    [
      {
        text: bt("btn_image_triage_telegram_profile", lang),
        callback_data: imageTriageCallback("telegram_profile"),
      },
      {
        text: bt("btn_image_triage_qr_menu", lang),
        callback_data: imageTriageCallback("qr_menu"),
      },
    ],
    [{ text: bt("btn_media_tips", lang), callback_data: CB.mediaTips }],
    [
      { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
      { text: bt("btn_emergency", lang), callback_data: CB.emergency },
    ],
  ];
}

export function buildImageTriageFollowUpKeyboard(lang: Lang): InlineKeyboard {
  return [
    [
      { text: bt("btn_check_another", lang), callback_data: CB.checkAnother },
      { text: bt("btn_media_tips", lang), callback_data: CB.mediaTips },
    ],
    [{ text: bt("btn_emergency", lang), callback_data: CB.emergency }],
  ];
}

export function buildImageTriageText(kind: ImageTriageKind, lang: Lang): string {
  return bt(TRIAGE_TEXT_KEY[kind], lang);
}

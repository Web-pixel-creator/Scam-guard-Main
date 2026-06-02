import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { detectInputType, normalize, maskForDisplay, redactText } from "./risk/detect";
import { hashIdentifier } from "./risk/hash";

const reportSchema = z.object({
  value: z.string().min(1).max(500),
  type: z.enum(["phone", "telegram", "url", "text", "payment", "apk", "unknown"]).optional(),
  description: z.string().min(5).max(5000),
  scamType: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  amountLostUzs: z.number().int().nonnegative().max(10_000_000_000).optional(),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

export const submitReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => reportSchema.parse(d))
  .handler(async ({ data }) => {
    const detected = data.type && data.type !== "unknown" ? data.type : detectInputType(data.value);
    const normalized = normalize(data.value, detected);
    const display = maskForDisplay(normalized, detected);
    const description = redactText(data.description);
    const hash = await hashIdentifier(normalized);

    const { error } = await supabaseAdmin.from("reports").insert({
      entity_type: detected,
      entity_hash: hash,
      redacted_value: display,
      description,
      scam_type: data.scamType ?? null,
      city: data.city ?? null,
      amount_lost_uzs: data.amountLostUzs ?? null,
      language: data.lang,
    });

    if (error) {
      console.error("submit report failed", error);
      return { ok: false, error: "Не удалось отправить жалобу. Попробуйте позже." };
    }

    // Bump entity counter (server-managed)
    try {
      const { data: existing } = await supabaseAdmin
        .from("entities")
        .select("id, report_count")
        .eq("entity_hash", hash)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("entities")
          .update({
            report_count: existing.report_count + 1,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("entities").insert({
          entity_type: detected,
          entity_hash: hash,
          display_mask: display,
          risk_level: "suspicious",
          report_count: 1,
          moderation_status: "new",
        });
      }
    } catch (e) {
      console.error("entity upsert failed", e);
    }

    return { ok: true };
  });

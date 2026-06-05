import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestIP, getRequestHeader } from "@tanstack/react-start/server";
import { runCheck, ocrExtractCore } from "./risk/check-core";
import { classifyMetaIntent, getMetaIntentResponse, type MetaIntent } from "./meta-intent";

export interface MetaIntentCheckResult {
  metaIntent: MetaIntent;
  response: string;
}

const checkSchema = z.object({
  input: z.string().min(1).max(2000),
  type: z.enum(["phone", "telegram", "url", "text", "payment", "apk", "unknown"]).optional(),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

const ocrSchema = z.object({
  image: z.string().min(1).max(6_000_000),
  lang: z.enum(["ru", "uz", "en"]).default("ru"),
});

/** Resolve the caller IP from the request and build the web rate-limit key. */
function webRateLimitKey(): string {
  const ip =
    getRequestHeader("cf-connecting-ip") ||
    getRequestHeader("x-real-ip") ||
    getRequestIP({ xForwardedFor: true }) ||
    "unknown";
  return `check:${ip}`;
}

// Thin web wrapper: extract IP → build `check:<ip>` key → delegate to the core.
// Behaviour is unchanged: same rate-limit key, 10/60_000 limit, response shape
// and redacted+hashed `checks` write all live in `runCheck`.
export const checkInput = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => checkSchema.parse(data))
  .handler(async ({ data }) => {
    const metaIntent = classifyMetaIntent(data.input);
    if (metaIntent) {
      return {
        metaIntent,
        response: getMetaIntentResponse(metaIntent, data.lang),
      } satisfies MetaIntentCheckResult;
    }

    return runCheck({
      input: data.input,
      type: data.type,
      lang: data.lang,
      rateLimitKey: webRateLimitKey(),
      channel: "web",
    });
  });

// Thin web wrapper: same `check:<ip>` rate-limit key → delegate to OCR core.
export const ocrExtract = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ocrSchema.parse(data))
  .handler(async ({ data }) => {
    return ocrExtractCore(data.image, data.lang, webRateLimitKey());
  });

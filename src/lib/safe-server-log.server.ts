export type SafeServerErrorCategory =
  | "authorization"
  | "conflict"
  | "network"
  | "rate_limited"
  | "storage"
  | "timeout"
  | "unknown"
  | "validation";

export interface SafeServerErrorDetails {
  kind: "error" | "object" | "primitive";
  category: SafeServerErrorCategory;
  code?: string;
  status?: number;
}

function readProperty(error: unknown, key: string): unknown {
  if (error === null || (typeof error !== "object" && typeof error !== "function")) {
    return undefined;
  }
  try {
    return (error as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function errorTextForClassification(error: unknown): string {
  if (typeof error === "string") return error.slice(0, 2_000).toLowerCase();
  const message = readProperty(error, "message");
  return typeof message === "string" ? message.slice(0, 2_000).toLowerCase() : "";
}

function safeStatus(error: unknown): number | undefined {
  for (const key of ["status", "statusCode", "httpStatus"] as const) {
    const value = readProperty(error, key);
    if (typeof value === "number" && Number.isInteger(value) && value >= 400 && value <= 599) {
      return value;
    }
  }
  return undefined;
}

function safeCode(error: unknown): string | undefined {
  const value = readProperty(error, "code");
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toUpperCase();
  if (/^(?:[0-9A-Z]{5}|PGRST\d{3}|ERR_[A-Z0-9_]{1,32}|E[A-Z0-9_]{1,24})$/.test(normalized)) {
    return normalized;
  }
  return undefined;
}

function classifyError(
  error: unknown,
  status: number | undefined,
  code: string | undefined,
): SafeServerErrorCategory {
  const text = errorTextForClassification(error);
  const name = readProperty(error, "name");

  if (status === 429 || /rate.?limit|too many requests|quota exceeded/.test(text)) {
    return "rate_limited";
  }
  if (
    status === 401 ||
    status === 403 ||
    code === "42501" ||
    /unauthori[sz]ed|forbidden|permission denied|invalid (?:jwt|token)/.test(text)
  ) {
    return "authorization";
  }
  if (
    status === 408 ||
    status === 504 ||
    name === "AbortError" ||
    code === "ETIMEDOUT" ||
    /\btimeout|timed out|aborted\b/.test(text)
  ) {
    return "timeout";
  }
  if (status === 409 || code === "23505" || /duplicate|already exists|conflict/.test(text)) {
    return "conflict";
  }
  if (
    status === 400 ||
    status === 422 ||
    code?.startsWith("22") ||
    /\binvalid\b|validation|malformed|zod/.test(text)
  ) {
    return "validation";
  }
  if (
    code?.startsWith("ECONN") ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    /network|fetch failed|connection (?:failed|reset|refused)|dns/.test(text)
  ) {
    return "network";
  }
  if (
    code !== undefined ||
    /supabase|postgrest|database|relation|row-level security|\brpc\b|query failed|storage/.test(
      text,
    )
  ) {
    return "storage";
  }
  return "unknown";
}

/**
 * Convert an arbitrary thrown value into bounded operational metadata.
 *
 * Raw messages, stacks, details, hints, request bodies and nested objects are
 * deliberately omitted because they may contain credentials or user input.
 */
export function safeServerErrorDetails(error: unknown): SafeServerErrorDetails {
  const status = safeStatus(error);
  const code = safeCode(error);
  const details: SafeServerErrorDetails = {
    kind:
      error instanceof Error
        ? "error"
        : error !== null && typeof error === "object"
          ? "object"
          : "primitive",
    category: classifyError(error, status, code),
  };
  if (code !== undefined) details.code = code;
  if (status !== undefined) details.status = status;
  return details;
}

/**
 * Log a static event name plus scrubbed metadata only. Callers must keep the
 * event name constant and must not interpolate request or user data into it.
 */
export function logServerError(event: string, error: unknown): void {
  console.error(event, safeServerErrorDetails(error));
}

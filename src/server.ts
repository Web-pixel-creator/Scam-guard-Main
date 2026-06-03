import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleTelegramWebhook } from "./lib/telegram/webhook.server";

// ── Security headers applied to every response ──────────────────────────────
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

/** Add security headers to any Response. */
function withSecurityHeaders(response: Response): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

// Fixed public endpoint for Telegram updates.
//
// This version of TanStack Start (1.168.x) + Nitro v3 exposes NO file-based
// server-route API (no `createServerFileRoute` / `ServerRoute`), so there is no
// `src/routes/api/telegram/webhook.ts` to host the handler. Instead we bind the
// endpoint at the real Worker entry (this file — wired via vite.config.ts
// `tanstackStart.server.entry = "server"`), through which every request flows.
// We intercept `POST /api/telegram/webhook` BEFORE the SSR/server entry and
// delegate to the framework-agnostic core. The core still verifies the secret
// token FIRST and fails closed (R12 / R17.4) — this binding does not weaken it.
const TELEGRAM_WEBHOOK_PATH = "/api/telegram/webhook";

// Lightweight liveness endpoint for platform health checks (Railway, etc.).
// Answers 200 without touching the SSR renderer, so probes stay cheap and do
// not depend on React rendering or any downstream service.
const HEALTHZ_PATH = "/healthz";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    let response: Response;
    try {
      const { pathname } = new URL(request.url);

      // Health check: cheap 200, no SSR.
      if (pathname === HEALTHZ_PATH) {
        return withSecurityHeaders(
          new Response("ok", {
            status: 200,
            headers: { "content-type": "text/plain; charset=utf-8" },
          }),
        );
      }

      // Telegram webhook: handle POST /api/telegram/webhook.
      if (request.method === "POST" && pathname === TELEGRAM_WEBHOOK_PATH) {
        return withSecurityHeaders(await handleTelegramWebhook(request));
      }

      const handler = await getServerEntry();
      response = await handler.fetch(request, env, ctx);
      response = await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      response = new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return withSecurityHeaders(response);
  },
};

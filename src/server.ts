import "./lib/error-capture";

import { randomBytes } from "node:crypto";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { compressHttpResponse } from "./lib/http-compression.server";
import { logServerError } from "./lib/safe-server-log.server";
import { getEmbedAllowedFrameAncestors, getPublicAppUrl } from "./lib/config.server";
import { SITEMAP_PATHS } from "./lib/page-meta";
import { getTelegramUpdateDeliveryMode, getTelegramWebhookSecret } from "./lib/config.server";
import {
  addScriptNonceToContentSecurityPolicy,
  buildEmbedCheckContentSecurityPolicy,
  DEFAULT_CONTENT_SECURITY_POLICY,
  parseEmbedFrameAncestorAllowlist,
} from "./lib/security/csp";
import { handleTelegramWebhook } from "./lib/telegram/webhook.server";
import { startTelegramUpdatesPollingIfConfigured } from "./lib/telegram/updates-poller.server";
import { getTelegramUpdateLeaderStatus } from "./lib/telegram/update-lifecycle.server";

let telegramPollingInitialized = false;

function ensureTelegramPollingStarted(): void {
  if (telegramPollingInitialized) return;
  telegramPollingInitialized = true;
  const stopTelegramPolling = startTelegramUpdatesPollingIfConfigured();
  if (stopTelegramPolling) process.once("SIGTERM", stopTelegramPolling);
}

// ── Security headers applied to every response ──────────────────────────────
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "Content-Security-Policy": DEFAULT_CONTENT_SECURITY_POLICY,
};

// Pages render in the visitor's language (ig_lang cookie, else the browser's
// language list), so a shared cache must not hand one language to everyone.
function varyHtmlByLanguage(response: Response): Response {
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) return response;
  const current = response.headers.get("Vary") ?? "";
  const present = current.split(",").map((v) => v.trim().toLowerCase());
  const missing = ["Cookie", "Accept-Language"].filter((v) => !present.includes(v.toLowerCase()));
  if (missing.length > 0) {
    response.headers.set(
      "Vary",
      current ? `${current}, ${missing.join(", ")}` : missing.join(", "),
    );
  }
  return response;
}

function createCspNonce(): string {
  return randomBytes(16).toString("base64url");
}

/** Add security headers to any Response. */
function withSecurityHeaders(response: Response, pathname = "", cspNonce?: string): Response {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  if (cspNonce) {
    response.headers.set(
      "Content-Security-Policy",
      addScriptNonceToContentSecurityPolicy(DEFAULT_CONTENT_SECURITY_POLICY, cspNonce),
    );
  }
  if (pathname === EMBED_CHECK_PATH) {
    const embedPolicy = buildEmbedCheckContentSecurityPolicy(
      parseEmbedFrameAncestorAllowlist(getEmbedAllowedFrameAncestors()),
    );
    response.headers.delete("X-Frame-Options");
    response.headers.set(
      "Content-Security-Policy",
      cspNonce ? addScriptNonceToContentSecurityPolicy(embedPolicy, cspNonce) : embedPolicy,
    );
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
const TELEGRAM_POLLING_HEALTH_PATH = "/api/telegram/polling-health";

// Lightweight liveness endpoint for platform health checks (Railway, etc.).
// Answers 200 without touching the SSR renderer, so probes stay cheap and do
// not depend on React rendering or any downstream service.
const HEALTHZ_PATH = "/healthz";

// Crawlers: absolute sitemap URLs from PUBLIC_APP_URL. noindex pages (appeal,
// login, widget) stay crawlable so their meta robots tag is seen; only the
// authenticated admin area and the API are disallowed.
const ROBOTS_PATH = "/robots.txt";
const SITEMAP_PATH = "/sitemap.xml";

export function renderRobotsTxt(origin: string): string {
  return [
    "User-agent: *",
    "Disallow: /admin",
    "Disallow: /admin-mfa",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}${SITEMAP_PATH}`,
    "",
  ].join("\n");
}

export function renderSitemapXml(origin: string): string {
  const urls = SITEMAP_PATHS.map((path) => `  <url><loc>${origin}${path}</loc></url>`);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
    "",
  ].join("\n");
}
const EMBED_CHECK_PATH = "/embed/check";

type ServerEntry = {
  fetch: (
    request: Request,
    opts?: { context?: { nonce?: string } },
    ctx?: unknown,
  ) => Promise<Response> | Response;
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

  logServerError(
    "server.ssr_unhandled_response",
    consumeLastCapturedError() ?? new Error("h3_swallowed_ssr_error"),
  );
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, _env: unknown, ctx: unknown) {
    ensureTelegramPollingStarted();
    const cspNonce = createCspNonce();
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
          pathname,
        );
      }

      if (request.method === "GET" && (pathname === ROBOTS_PATH || pathname === SITEMAP_PATH)) {
        const robots = pathname === ROBOTS_PATH;
        const origin = getPublicAppUrl();
        return withSecurityHeaders(
          new Response(robots ? renderRobotsTxt(origin) : renderSitemapXml(origin), {
            status: 200,
            headers: {
              "content-type": robots
                ? "text/plain; charset=utf-8"
                : "application/xml; charset=utf-8",
              "cache-control": "public, max-age=3600",
            },
          }),
          pathname,
        );
      }

      // Telegram webhook: handle POST /api/telegram/webhook.
      if (request.method === "POST" && pathname === TELEGRAM_WEBHOOK_PATH) {
        return withSecurityHeaders(await handleTelegramWebhook(request), pathname);
      }

      if (request.method === "GET" && pathname === TELEGRAM_POLLING_HEALTH_PATH) {
        const secret = getTelegramWebhookSecret();
        const header = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
        if (!secret || header !== secret) {
          return withSecurityHeaders(new Response("unauthorized", { status: 401 }), pathname);
        }
        if (getTelegramUpdateDeliveryMode() !== "polling") {
          return withSecurityHeaders(new Response("disabled", { status: 503 }), pathname);
        }
        const leader = await getTelegramUpdateLeaderStatus();
        return withSecurityHeaders(
          new Response(leader?.active ? "ok" : "unavailable", {
            status: leader?.active ? 200 : 503,
          }),
          pathname,
        );
      }

      const handler = await getServerEntry();
      response = await handler.fetch(request, { context: { nonce: cspNonce } }, ctx);
      response = await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      logServerError("server.request_failed", error);
      response = new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    return compressHttpResponse(
      request,
      withSecurityHeaders(varyHtmlByLanguage(response), new URL(request.url).pathname, cspNonce),
    );
  },
};

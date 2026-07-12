// Production smoke for Telegram inline-mode webhook handling.
//
// Usage:
//   railway run npm run prod:telegram-inline-smoke -- https://your-app.example.com
//   PUBLIC_APP_URL=https://your-app.example.com npm run prod:telegram-inline-smoke
//
// Security: uses synthetic Telegram users only, never prints secrets or user ids,
// sends no chat messages, and removes its own webhook/session rows. Synthetic
// inline query ids cannot be delivered to Telegram clients, so this validates
// the production transport boundary and non-persistence invariants, not visual
// client rendering or polling-mode handler delivery.
import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { detectInputType, normalize } from "@/lib/risk/detect";
import { hashIdentifier } from "@/lib/risk/hash";
import {
  expectedAuthenticatedWebhookStatus,
  parseTelegramDeliveryMode,
  type TelegramDeliveryMode,
} from "@/lib/security/telegram-delivery-policy";

const WEBHOOK_PATH = "/api/telegram/webhook";
const SECRET_HEADER = "X-Telegram-Bot-Api-Secret-Token";
const NO_CHECK_WAIT_MS = 3_000;

interface CheckRow {
  id: string;
  created_at: string;
  redacted_input: string | null;
  input_hash: string | null;
  input_type: string | null;
  risk_level: string | null;
  reason_codes: string[] | null;
}

interface TelegramSessionRow {
  telegram_user_id: number;
  lang: string;
  scenario: string;
  scenario_step: number;
  scenario_data: unknown;
}

interface SmokeContext {
  checkIds: Set<string>;
  updateIds: number[];
  userIds: number[];
}

interface InlineSmokeCase {
  label: string;
  query: string;
  languageCode: "ru" | "uz" | "en";
}

function fail(message: string): never {
  throw new Error(message);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} is not set`);
  return value;
}

function parsePublicUrl(): string {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(
      [
        "Usage: npm run prod:telegram-inline-smoke -- <https-public-url>",
        "",
        "Required env: TELEGRAM_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.",
        "Use railway run for production env. The smoke sends synthetic inline_query updates only.",
      ].join("\n"),
    );
    process.exit(0);
  }

  const raw = args.find((value) => !value.startsWith("--")) ?? process.env.PUBLIC_APP_URL;
  if (!raw) {
    fail(
      "missing public URL. Pass it as the first argument or set PUBLIC_APP_URL. " +
        "Example: npm run prod:telegram-inline-smoke -- https://your-app.example.com",
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    fail(`invalid public URL: ${raw}`);
  }

  if (parsed.protocol !== "https:") {
    fail(`public URL must use https, got ${parsed.protocol}`);
  }

  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

function untypedSupabase(): SupabaseClient {
  return supabaseAdmin as unknown as SupabaseClient;
}

function randomLetters(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return value;
}

function nextUpdateId(): number {
  return 1_785_000_000 + Math.floor(Math.random() * 1_000_000);
}

function syntheticTelegramUserId(offset: number): number {
  return 8_885_000_000_000 + Math.floor(Math.random() * 1_000_000) + offset;
}

function inlineQueryUpdate(options: {
  updateId: number;
  inlineQueryId: string;
  userId: number;
  query: string;
  languageCode: "ru" | "uz" | "en";
}) {
  return {
    update_id: options.updateId,
    inline_query: {
      id: options.inlineQueryId,
      from: {
        id: options.userId,
        is_bot: false,
        first_name: "QA",
        language_code: options.languageCode,
      },
      query: options.query,
      offset: "",
    },
  };
}

async function postWebhook(
  publicUrl: string,
  webhookSecret: string,
  update: unknown,
): Promise<Response> {
  return fetch(`${publicUrl}${WEBHOOK_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [SECRET_HEADER]: webhookSecret,
    },
    body: JSON.stringify(update),
  });
}

async function readChecksByHash(hash: string, startedAtIso: string): Promise<CheckRow[]> {
  const { data, error } = await untypedSupabase()
    .from("checks")
    .select("id,created_at,redacted_input,input_hash,input_type,risk_level,reason_codes")
    .gte("created_at", startedAtIso)
    .eq("input_hash", hash)
    .order("created_at", { ascending: false });
  if (error) fail(`check lookup failed by hash: ${error.message}`);
  return (data as CheckRow[] | null) ?? [];
}

async function readSession(userId: number): Promise<TelegramSessionRow | null> {
  const { data, error } = await untypedSupabase()
    .from("telegram_sessions")
    .select("telegram_user_id,lang,scenario,scenario_step,scenario_data")
    .eq("telegram_user_id", userId)
    .maybeSingle();
  if (error) fail(`telegram session lookup failed: ${error.message}`);
  return (data as TelegramSessionRow | null) ?? null;
}

async function assertNoCheckByInput(
  ctx: SmokeContext,
  query: string,
  startedAtIso: string,
  label: string,
): Promise<void> {
  const detected = detectInputType(query);
  const hash = await hashIdentifier(normalize(query, detected));
  const deadline = Date.now() + NO_CHECK_WAIT_MS;
  let rows: CheckRow[] = [];

  while (Date.now() < deadline) {
    rows = await readChecksByHash(hash, startedAtIso);
    if (rows.length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (rows.length === 0) return;
  rows.forEach((row) => ctx.checkIds.add(row.id));
  fail(`${label} unexpectedly created ${rows.length} check row(s)`);
}

async function assertNoSession(userId: number, label: string): Promise<void> {
  const row = await readSession(userId);
  if (!row) return;
  fail(`${label} unexpectedly persisted a telegram session`);
}

async function cleanup(ctx: SmokeContext): Promise<void> {
  if (ctx.checkIds.size > 0) {
    const { error } = await untypedSupabase()
      .from("checks")
      .delete()
      .in("id", [...ctx.checkIds]);
    if (error) console.error(`WARN cleanup checks failed: ${error.message}`);
  }

  if (ctx.updateIds.length > 0) {
    const { error } = await untypedSupabase()
      .from("telegram_webhook_updates")
      .delete()
      .in("update_id", ctx.updateIds);
    if (error) console.error(`WARN cleanup telegram_webhook_updates failed: ${error.message}`);
  }

  if (ctx.userIds.length > 0) {
    const { error } = await untypedSupabase()
      .from("telegram_sessions")
      .delete()
      .in("telegram_user_id", ctx.userIds);
    if (error) console.error(`WARN cleanup telegram_sessions failed: ${error.message}`);
  }
}

async function runCase(options: {
  ctx: SmokeContext;
  publicUrl: string;
  webhookSecret: string;
  testCase: InlineSmokeCase;
  index: number;
  markerRoot: string;
  deliveryMode: TelegramDeliveryMode;
}): Promise<void> {
  const userId = syntheticTelegramUserId(options.index * 1_000);
  const updateId = nextUpdateId();
  const startedAtIso = new Date().toISOString();
  const inlineQueryId = `qa-inline-${options.markerRoot}-${options.index}`;

  options.ctx.updateIds.push(updateId);
  options.ctx.userIds.push(userId);

  const res = await postWebhook(
    options.publicUrl,
    options.webhookSecret,
    inlineQueryUpdate({
      updateId,
      inlineQueryId,
      userId,
      query: options.testCase.query,
      languageCode: options.testCase.languageCode,
    }),
  );
  const expectedStatus = expectedAuthenticatedWebhookStatus(options.deliveryMode);
  if (res.status !== expectedStatus) {
    fail(
      `${options.testCase.label} webhook returned status=${res.status}, expected=${expectedStatus}`,
    );
  }

  await assertNoCheckByInput(
    options.ctx,
    options.testCase.query,
    startedAtIso,
    options.testCase.label,
  );
  await assertNoSession(userId, options.testCase.label);
  console.log(
    `OK ${options.testCase.label}: mode=${options.deliveryMode}, webhook=${expectedStatus}, no checks/session persisted`,
  );
}

async function main(): Promise<void> {
  const publicUrl = parsePublicUrl();
  const webhookSecret = getRequiredEnv("TELEGRAM_WEBHOOK_SECRET");
  const deliveryMode = parseTelegramDeliveryMode(process.env.TELEGRAM_UPDATE_DELIVERY_MODE);
  getRequiredEnv("SUPABASE_URL");
  getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const markerRoot = `QAINLINE${randomLetters(8)}`;
  const ctx: SmokeContext = {
    checkIds: new Set<string>(),
    updateIds: [],
    userIds: [],
  };
  const cases: InlineSmokeCase[] = [
    {
      label: "high-risk text inline preview",
      query: `${markerRoot} Срочно назовите SMS-код от банка для отмены операции`,
      languageCode: "ru",
    },
    {
      label: "low-signal phone inline preview",
      query: "+998 90 123 45 67",
      languageCode: "ru",
    },
    {
      label: "low-signal Telegram username inline preview",
      query: "@lucky_promo_qa",
      languageCode: "en",
    },
  ];

  console.log(`Production Telegram inline smoke target: ${publicUrl}`);
  console.log("Secret values and synthetic Telegram ids are not printed.");
  console.log(
    "Synthetic inline query ids validate webhook handling, not visual Telegram client delivery.",
  );

  try {
    for (const [index, testCase] of cases.entries()) {
      await runCase({
        ctx,
        publicUrl,
        webhookSecret,
        testCase,
        index: index + 1,
        markerRoot,
        deliveryMode,
      });
    }
  } finally {
    await cleanup(ctx);
  }

  console.log("OK cleanup done");
  if (deliveryMode === "polling") {
    console.log(
      "OK polling transport boundary passed; real Inline handler/client delivery remains a separate real-client check",
    );
  } else {
    console.log("OK production Telegram inline webhook smoke passed");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL production Telegram inline smoke: ${message}`);
  process.exitCode = 1;
});

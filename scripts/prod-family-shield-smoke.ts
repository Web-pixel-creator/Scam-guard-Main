// Production smoke test for Family Shield storage and safe failure paths.
//
// This script creates a synthetic invite, accepts it with synthetic Telegram
// ids, verifies that notification handling does not throw, revokes the link,
// and confirms no open synthetic relationship remains.
//
// Security: this script never prints secrets, invite URLs, raw tokens, real
// Telegram user ids or chat ids.

import process from "node:process";
import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  acceptFamilyInvite,
  createFamilyInvite,
  notifyTrustedContact,
  parseFamilyStartArg,
  revokeFamilyShield,
} from "@/lib/telegram/family-shield.server";

const TABLE = "telegram_family_shield";
const SYNTHETIC_ID_BASE = 9_120_000_000_000;

interface SmokeResult {
  name: string;
  ok: boolean;
  detail: string;
}

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function printResult(result: SmokeResult): void {
  const mark = result.ok ? "OK" : "FAIL";
  console.log(`${mark} ${result.name}: ${result.detail}`);
}

function syntheticGuardianId(): number {
  return SYNTHETIC_ID_BASE + Math.floor(Date.now() % 1_000_000_000);
}

function familyTable() {
  return (supabaseAdmin as unknown as SupabaseClient).from(TABLE);
}

function tokenFromInviteUrl(inviteUrl: string): string | null {
  try {
    const url = new URL(inviteUrl);
    return parseFamilyStartArg(url.searchParams.get("start") ?? "");
  } catch {
    return null;
  }
}

async function notifySyntheticTrustedContact(guardianTelegramUserId: number) {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (String(args[0] ?? "").startsWith("telegram sendMessage non-ok")) {
      return;
    }
    originalError(...args);
  };

  try {
    return await notifyTrustedContact({ guardianTelegramUserId, lang: "ru" });
  } finally {
    console.error = originalError;
  }
}

async function openLinkCount(guardianTelegramUserId: number): Promise<number> {
  const { data, error } = await familyTable()
    .select("id,status")
    .eq("guardian_telegram_user_id", guardianTelegramUserId)
    .in("status", ["pending", "active"]);

  if (error) {
    throw new Error(`cleanup verification failed: ${error.message}`);
  }

  return Array.isArray(data) ? data.length : 0;
}

async function main(): Promise<void> {
  const guardianTelegramUserId = syntheticGuardianId();
  const trustedTelegramUserId = guardianTelegramUserId + 1;
  const trustedChatId = guardianTelegramUserId + 2;
  const results: SmokeResult[] = [];

  try {
    const invite = await createFamilyInvite(guardianTelegramUserId);
    results.push({
      name: "create synthetic invite",
      ok: invite.ok,
      detail: invite.ok ? "created (token not printed)" : `reason=${invite.reason}`,
    });
    if (!invite.ok) return;

    const token = tokenFromInviteUrl(invite.inviteUrl);
    results.push({
      name: "parse invite token",
      ok: Boolean(token),
      detail: token ? "parsed (token not printed)" : "missing token",
    });
    if (!token) return;

    const accepted = await acceptFamilyInvite({
      token,
      trustedTelegramUserId,
      trustedChatId,
    });
    results.push({
      name: "accept synthetic invite",
      ok: accepted.ok,
      detail: accepted.ok ? "accepted" : `reason=${accepted.reason}`,
    });
    if (!accepted.ok) return;

    const notified = await notifySyntheticTrustedContact(guardianTelegramUserId);
    results.push({
      name: "notify synthetic trusted contact",
      ok: notified.ok === false && notified.reason === "send_failed",
      detail:
        notified.ok === false
          ? `safe failure reason=${notified.reason}`
          : "unexpectedly sent to synthetic chat",
    });
  } finally {
    const revoked = await revokeFamilyShield(guardianTelegramUserId);
    results.push({
      name: "revoke synthetic relationship",
      ok: revoked.ok || revoked.reason === "not_linked",
      detail: revoked.ok ? "revoked" : `reason=${revoked.reason}`,
    });

    const remainingOpen = await openLinkCount(guardianTelegramUserId);
    results.push({
      name: "cleanup synthetic relationship",
      ok: remainingOpen === 0,
      detail: `open_rows=${remainingOpen}`,
    });

    for (const result of results) printResult(result);

    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      process.exitCode = 1;
    } else {
      console.log("OK Family Shield production smoke passed.");
    }
  }
}

main().catch((err: unknown) => {
  fail(err instanceof Error ? err.message : "unexpected error");
});

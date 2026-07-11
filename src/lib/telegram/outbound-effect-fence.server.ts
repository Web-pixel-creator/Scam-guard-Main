import { configureTelegramOutboundEffectGuard } from "@/lib/telegram/outbound-effect-guard";
import { currentTelegramUpdateLease } from "@/lib/telegram/update-execution.server";
import { isTelegramUpdateLeaseCurrent } from "@/lib/telegram/update-lifecycle.server";

let installed = false;

export function installTelegramOutboundEffectFence(): void {
  if (installed) return;
  installed = true;
  configureTelegramOutboundEffectGuard(async (method) => {
    const lease = currentTelegramUpdateLease();
    if (!lease) return true;
    const current = await isTelegramUpdateLeaseCurrent(lease);
    if (!current) console.error(`telegram ${method} skipped`, "stale_update_lease");
    return current;
  });
}

export function __resetTelegramOutboundEffectFenceForTests(): void {
  installed = false;
}

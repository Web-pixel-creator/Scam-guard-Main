type TelegramOutboundEffectGuard = (method: string) => Promise<boolean>;

let outboundEffectGuard: TelegramOutboundEffectGuard | undefined;

export function configureTelegramOutboundEffectGuard(guard: TelegramOutboundEffectGuard): void {
  outboundEffectGuard = guard;
}

export async function telegramOutboundEffectAllowed(method: string): Promise<boolean> {
  return outboundEffectGuard ? outboundEffectGuard(method) : true;
}

export function __resetTelegramOutboundEffectGuardForTests(): void {
  outboundEffectGuard = undefined;
}

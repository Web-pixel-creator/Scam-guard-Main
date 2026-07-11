const userUpdateTails = new Map<number, Promise<void>>();

export async function serializeTelegramUserUpdate<T>(
  userId: number,
  work: () => Promise<T>,
): Promise<T> {
  const previous = userUpdateTails.get(userId) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  userUpdateTails.set(userId, current);

  await previous.catch(() => undefined);
  try {
    // Do not release the same-user queue on a wall-clock timeout: JavaScript
    // cannot cancel arbitrary handler work, so releasing here would allow the
    // old work to keep producing messages/side effects beside the next update.
    // External Telegram/provider/media operations own their bounded timeouts.
    return await work();
  } finally {
    releaseCurrent();
    if (userUpdateTails.get(userId) === current) userUpdateTails.delete(userId);
  }
}

export function __resetTelegramUserUpdateQueuesForTests(): void {
  userUpdateTails.clear();
}

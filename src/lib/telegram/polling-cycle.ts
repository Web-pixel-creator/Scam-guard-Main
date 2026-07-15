import { telegramUpdateSchema, type TelegramUpdate } from "@/lib/telegram/router";
import { inlineDeliveryRetryAfterMs } from "@/lib/telegram/inline-answer-delivery-error";
import type {
  BeginTelegramUpdateResult,
  TelegramUpdateLeaderLease,
} from "@/lib/telegram/update-lifecycle.server";

const POLL_RETRY_MS = 2_000;
const MAX_INLINE_CONCURRENCY = 4;

export interface TelegramPollingCycleDeps {
  fetchUpdates: (offset?: number) => Promise<unknown[] | null>;
  begin: (
    updateId: number,
    leader: TelegramUpdateLeaderLease,
  ) => Promise<BeginTelegramUpdateResult>;
  execute: (
    update: TelegramUpdate,
    lease: Extract<
      BeginTelegramUpdateResult,
      {
        decision: "acquired";
      }
    >["lease"],
  ) => Promise<boolean>;
  prepareHandlers?: () => void;
}

export interface TelegramPollingCycleResult {
  offset?: number;
  retryAfterMs: number;
}

export async function runTelegramPollingCycleCore(
  offset: number | undefined,
  leader: TelegramUpdateLeaderLease,
  deps: TelegramPollingCycleDeps,
): Promise<TelegramPollingCycleResult> {
  const updates = await deps.fetchUpdates(offset);
  if (updates === null) return { offset, retryAfterMs: POLL_RETRY_MS };
  if (updates.length === 0) return { offset, retryAfterMs: 0 };

  const records = validateOrderedBatch(updates, offset);
  if (!records) {
    console.error("telegram polling received invalid update batch", "update_id_order");
    return { offset, retryAfterMs: POLL_RETRY_MS };
  }

  const parsed = records.map(({ raw, updateId }) => ({
    updateId,
    parsed: telegramUpdateSchema.safeParse(raw),
  }));
  if (parsed.some((record) => record.parsed.success)) deps.prepareHandlers?.();

  let frontier = offset;
  for (let index = 0; index < parsed.length; ) {
    const record = parsed[index];

    // A payload with a valid ordered update_id but an unsupported shape is
    // safe to acknowledge: there is no handler contract that could process it.
    // Keep these records sequential so an unsupported item remains an explicit
    // frontier boundary rather than being hidden inside a concurrent segment.
    if (!record.parsed.success) {
      console.error("telegram polling ignored unsupported update", "schema");
      frontier = record.updateId + 1;
      index += 1;
      continue;
    }

    if (!isStrictInlineOnly(record.parsed.data)) {
      const windowEnd = strictInlineWindowEnd(parsed, index + 1);
      const statefulUserId = telegramUpdateUserId(record.parsed.data);
      const readAheadOutcomes = new Map<number, UpdateOutcome>();
      const eligibleReadAhead =
        statefulUserId === null
          ? []
          : eligibleInlineReadAheadIndices(parsed, index + 1, windowEnd, statefulUserId);

      let stopReadAhead = false;
      const statefulOutcomePromise = processClaimedUpdate(record.parsed.data, leader, deps).then(
        (outcome) => {
          // Read-ahead exists only while this causal barrier is in flight. Once
          // it settles, stop claiming future chunks and resume the window in
          // update order (including the same user's Inline queries).
          stopReadAhead = true;
          return outcome;
        },
      );
      const readAheadPromise = processInlineReadAhead(
        parsed,
        eligibleReadAhead,
        leader,
        deps,
        readAheadOutcomes,
        () => stopReadAhead,
      );
      const [outcome] = await Promise.all([statefulOutcomePromise, readAheadPromise]);
      if (!outcome.acknowledged) {
        return {
          offset: frontier,
          retryAfterMs: maxFailedRetryAfterMs(outcome, readAheadOutcomes.values()),
        };
      }
      frontier = record.updateId + 1;

      const inlineWindow = await processInlineWindowInOrder(
        parsed,
        index + 1,
        windowEnd,
        leader,
        deps,
        frontier,
        readAheadOutcomes,
      );
      frontier = inlineWindow.frontier;
      if (inlineWindow.failure) {
        return { offset: frontier, retryAfterMs: inlineWindow.failure.retryAfterMs };
      }
      index = windowEnd;
      continue;
    }

    // Only one contiguous, inline-only segment may execute concurrently. A
    // stateful/unsupported boundary is never crossed and claims for a future
    // chunk are not acquired until the current chunk is fully acknowledged.
    let segmentEnd = index + 1;
    while (segmentEnd < parsed.length) {
      const nextRecord = parsed[segmentEnd];
      if (!nextRecord.parsed.success || !isStrictInlineOnly(nextRecord.parsed.data)) break;
      segmentEnd += 1;
    }

    const inlineWindow = await processInlineWindowInOrder(
      parsed,
      index,
      segmentEnd,
      leader,
      deps,
      frontier,
    );
    frontier = inlineWindow.frontier;
    if (inlineWindow.failure) {
      return { offset: frontier, retryAfterMs: inlineWindow.failure.retryAfterMs };
    }

    index = segmentEnd;
  }

  return { offset: frontier, retryAfterMs: 0 };
}

interface OrderedUpdateRecord {
  raw: unknown;
  updateId: number;
}

interface UpdateOutcome {
  acknowledged: boolean;
  retryAfterMs: number;
}

type ParsedUpdateRecord = {
  updateId: number;
  parsed: ReturnType<typeof telegramUpdateSchema.safeParse>;
};

interface InlineWindowOutcome {
  frontier: number | undefined;
  failure?: UpdateOutcome;
}

function strictInlineWindowEnd(records: readonly ParsedUpdateRecord[], start: number): number {
  let end = start;
  while (end < records.length) {
    const record = records[end];
    if (!record.parsed.success || !isStrictInlineOnly(record.parsed.data)) break;
    end += 1;
  }
  return end;
}

function eligibleInlineReadAheadIndices(
  records: readonly ParsedUpdateRecord[],
  start: number,
  end: number,
  statefulUserId: number,
): number[] {
  const eligible: number[] = [];
  for (let index = start; index < end; index += 1) {
    const record = records[index];
    if (!record.parsed.success || !isStrictInlineOnly(record.parsed.data)) break;
    const inlineUserId = telegramUpdateUserId(record.parsed.data);
    if (inlineUserId !== null && inlineUserId !== statefulUserId) eligible.push(index);
  }
  return eligible;
}

async function processInlineReadAhead(
  records: readonly ParsedUpdateRecord[],
  eligibleIndices: readonly number[],
  leader: TelegramUpdateLeaderLease,
  deps: TelegramPollingCycleDeps,
  outcomesByIndex: Map<number, UpdateOutcome>,
  shouldStop: () => boolean,
): Promise<void> {
  for (
    let chunkStart = 0;
    chunkStart < eligibleIndices.length;
    chunkStart += MAX_INLINE_CONCURRENCY
  ) {
    if (shouldStop()) return;
    const indices = eligibleIndices.slice(chunkStart, chunkStart + MAX_INLINE_CONCURRENCY);
    const outcomes = await Promise.all(
      indices.map((index) => processInlineRecord(records[index], leader, deps)),
    );
    let failed = false;
    for (let item = 0; item < indices.length; item += 1) {
      outcomesByIndex.set(indices[item], outcomes[item]);
      if (!outcomes[item].acknowledged) failed = true;
    }
    if (failed || shouldStop()) return;
  }
}

async function processInlineWindowInOrder(
  records: readonly ParsedUpdateRecord[],
  start: number,
  end: number,
  leader: TelegramUpdateLeaderLease,
  deps: TelegramPollingCycleDeps,
  initialFrontier: number | undefined,
  precomputed = new Map<number, UpdateOutcome>(),
): Promise<InlineWindowOutcome> {
  let frontier = initialFrontier;
  let index = start;
  while (index < end) {
    const knownOutcome = precomputed.get(index);
    if (knownOutcome) {
      if (!knownOutcome.acknowledged) {
        return {
          frontier,
          failure: {
            acknowledged: false,
            retryAfterMs: maxFailedRetryAfterMs(knownOutcome, precomputed.values()),
          },
        };
      }
      frontier = records[index].updateId + 1;
      index += 1;
      continue;
    }

    const indices: number[] = [];
    while (
      index + indices.length < end &&
      indices.length < MAX_INLINE_CONCURRENCY &&
      !precomputed.has(index + indices.length)
    ) {
      indices.push(index + indices.length);
    }
    const outcomes = await Promise.all(
      indices.map((candidateIndex) => processInlineRecord(records[candidateIndex], leader, deps)),
    );
    const failedRetryAfterMs = maxFailedRetryAfterMs({ acknowledged: false, retryAfterMs: 0 }, [
      ...outcomes,
      ...precomputed.values(),
    ]);
    for (let item = 0; item < indices.length; item += 1) {
      const outcome = outcomes[item];
      if (!outcome.acknowledged) {
        // Work later in this already-started chunk may have completed. The
        // durable lifecycle marker makes replay skip it, but the local frontier
        // must never jump over the first unacknowledged update.
        return {
          frontier,
          failure: { acknowledged: false, retryAfterMs: failedRetryAfterMs },
        };
      }
      frontier = records[indices[item]].updateId + 1;
    }
    index += indices.length;
  }
  return { frontier };
}

function maxFailedRetryAfterMs(primary: UpdateOutcome, related: Iterable<UpdateOutcome>): number {
  let retryAfterMs = primary.acknowledged ? 0 : primary.retryAfterMs;
  for (const outcome of related) {
    if (!outcome.acknowledged) retryAfterMs = Math.max(retryAfterMs, outcome.retryAfterMs);
  }
  return retryAfterMs > 0 ? retryAfterMs : POLL_RETRY_MS;
}

function processInlineRecord(
  record: ParsedUpdateRecord,
  leader: TelegramUpdateLeaderLease,
  deps: TelegramPollingCycleDeps,
): Promise<UpdateOutcome> {
  if (!record.parsed.success || !isStrictInlineOnly(record.parsed.data)) {
    return Promise.resolve({ acknowledged: false, retryAfterMs: POLL_RETRY_MS });
  }
  return processClaimedUpdate(record.parsed.data, leader, deps);
}

function validateOrderedBatch(
  updates: readonly unknown[],
  offset: number | undefined,
): OrderedUpdateRecord[] | null {
  if (offset !== undefined && (!Number.isSafeInteger(offset) || offset < 0)) {
    return null;
  }

  const records: OrderedUpdateRecord[] = [];
  let previous: number | undefined;
  for (const raw of updates) {
    const updateId = updateIdFromUnknown(raw);
    if (
      updateId === null ||
      (previous !== undefined && updateId <= previous) ||
      (offset !== undefined && updateId < offset)
    ) {
      return null;
    }
    records.push({ raw, updateId });
    previous = updateId;
  }
  return records;
}

function isStrictInlineOnly(update: TelegramUpdate): boolean {
  return Boolean(update.inline_query) && !update.message && !update.callback_query;
}

function telegramUpdateUserId(update: TelegramUpdate): number | null {
  return (
    update.inline_query?.from.id ??
    update.callback_query?.from.id ??
    update.message?.from?.id ??
    null
  );
}

async function processClaimedUpdate(
  update: TelegramUpdate,
  leader: TelegramUpdateLeaderLease,
  deps: TelegramPollingCycleDeps,
): Promise<UpdateOutcome> {
  try {
    const claim = await deps.begin(update.update_id, leader);
    if (claim.decision === "completed") return { acknowledged: true, retryAfterMs: 0 };
    if (claim.decision !== "acquired") {
      return {
        acknowledged: false,
        retryAfterMs: Math.max(1_000, claim.retryAfterSec * 1_000),
      };
    }
    const completed = await deps.execute(update, claim.lease);
    return completed
      ? { acknowledged: true, retryAfterMs: 0 }
      : { acknowledged: false, retryAfterMs: POLL_RETRY_MS };
  } catch (error) {
    console.error("telegram polling update failed", "exception");
    return {
      acknowledged: false,
      retryAfterMs: inlineDeliveryRetryAfterMs(error) ?? POLL_RETRY_MS,
    };
  }
}

function updateIdFromUnknown(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const updateId = (value as Record<string, unknown>).update_id;
  return typeof updateId === "number" && Number.isSafeInteger(updateId) && updateId >= 0
    ? updateId
    : null;
}

// Durable job dispatch + atomic list draining. Standalone (only structural
// Redis interfaces) so it works with ioredis in both web and worker and stays
// unit-testable with a fake client.

/** Redis LIST used as a durable job queue (replaces fire-and-forget pub/sub). */
export const JOBS_QUEUE = "quorum:jobs:queue";

export interface JobPayload {
  runId: string;
}

export function serializeJob(p: JobPayload): string {
  return JSON.stringify(p);
}

export function parseJob(raw: string | null | undefined): JobPayload | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v.runId === "string" ? { runId: v.runId } : null;
  } catch {
    return null;
  }
}

// Minimal structural interfaces — avoids a hard ioredis dependency in the engine.
export interface ListPusher {
  lpush(key: string, ...values: string[]): Promise<number>;
}

export interface MultiChain {
  lrange(key: string, start: number, stop: number): MultiChain;
  del(key: string): MultiChain;
  exec(): Promise<Array<[Error | null, unknown]> | null>;
}

export interface AtomicDrainer {
  multi(): MultiChain;
}

/** Durably enqueue a job. Survives worker restarts (unlike pub/sub). */
export async function enqueueJob(client: ListPusher, payload: JobPayload): Promise<void> {
  await client.lpush(JOBS_QUEUE, serializeJob(payload));
}

/**
 * Atomically read AND clear a list in a single MULTI/EXEC transaction, so a
 * concurrent push between the read and the clear can't be silently discarded.
 * Returns the raw string entries in insertion order (oldest first).
 */
export async function drainListAtomic(client: AtomicDrainer, key: string): Promise<string[]> {
  const res = await client.multi().lrange(key, 0, -1).del(key).exec();
  if (!res) return []; // transaction aborted / connection issue
  const first = res[0];
  if (first && first[0]) throw first[0]; // lrange error
  const items = first ? first[1] : [];
  return Array.isArray(items) ? (items as string[]) : [];
}

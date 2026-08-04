// Pure helper for SSE replay: decide which seq to resume after. Prefer the
// browser's Last-Event-ID header (auto-sent on reconnect); fall back to an
// explicit ?after= query (used on a fresh load after client-side replay).
export function resumeAfter(lastEventId: string | null, afterQuery: string | null): number {
  const h = Number(lastEventId ?? "");
  if (Number.isFinite(h) && h > 0) return h;
  const q = Number(afterQuery ?? "");
  if (Number.isFinite(q) && q > 0) return q;
  return 0;
}

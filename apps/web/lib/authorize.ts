// Shared owner-scoped authorization guard for run routes. Pure (the run finder
// is injected) so it's unit-testable without Next/Prisma.

export interface SessionLike {
  userId: string;
}

export interface OwnedRun {
  company: { ownerId: string };
}

export type Authz<T> =
  | { ok: true; run: T }
  | { ok: false; status: 401 | 404; error: string };

/**
 * Deny unless there's a session AND the run exists AND it belongs to that user.
 * Returns 404 (not 403) for wrong-owner so run ids aren't enumerable.
 */
export async function authorizeRun<T extends OwnedRun>(
  session: SessionLike | null,
  runId: string,
  findRun: (id: string) => Promise<T | null>
): Promise<Authz<T>> {
  if (!session) return { ok: false, status: 401, error: "unauthorized" };
  const run = await findRun(runId);
  if (!run || run.company.ownerId !== session.userId) {
    return { ok: false, status: 404, error: "not found" };
  }
  return { ok: true, run };
}

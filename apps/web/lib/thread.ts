// Prisma `where` for fetching every run in a continuation thread.
// `id: threadId` also pulls in a legacy root whose own threadId is null (it was
// created before the feature, then continued — so children carry threadId =
// rootId, but the root itself was never stamped).
export function threadRunsWhere(threadId: string) {
  return { deletedAt: null, OR: [{ threadId }, { id: threadId }] };
}

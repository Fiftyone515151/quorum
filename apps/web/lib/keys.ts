// Must match apps/orchestrator/src/keys.ts
export const JOBS_CHANNEL = "quorum:jobs";
export const eventsChannel = (runId: string) => `quorum:run:${runId}:events`;
export const inboxKey = (runId: string) => `quorum:run:${runId}:inbox`;

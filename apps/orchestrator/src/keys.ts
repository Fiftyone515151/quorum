export const JOBS_CHANNEL = "quorum:jobs";
export const eventsChannel = (runId: string) => `quorum:run:${runId}:events`;
export const inboxKey = (runId: string) => `quorum:run:${runId}:inbox`;
export const pauseKey = (runId: string) => `quorum:run:${runId}:pause`;
export const controlInboxKey = (runId: string) => `quorum:run:${runId}:control`;

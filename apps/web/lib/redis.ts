import Redis from "ioredis";

const url = process.env.REDIS_URL ?? "redis://localhost:6379";
const g = globalThis as unknown as { __redis?: Redis };

function make(): Redis {
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 3 });
  client.on("error", (e) => console.error("[redis]", e.message));
  return client;
}

export const redis: Redis = g.__redis ?? (g.__redis = make());

/** SSE needs a dedicated subscriber connection per request. */
export function makeSubscriber(): Redis {
  const client = new Redis(url);
  client.on("error", (e) => console.error("[redis:sub]", e.message));
  return client;
}

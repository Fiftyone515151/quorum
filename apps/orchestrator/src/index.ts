import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "../../.env") });
config();

import Redis from "ioredis";
import { prisma, RunStatus } from "@quorum/db";
import {
  runMode,
  resolvePersona,
  JOBS_QUEUE,
  parseJob,
  drainListAtomic,
  type RunContext,
  type RunEvent,
  type Persona,
  type Dimension,
  type RiskAxis,
} from "@quorum/engine";
import { eventsChannel, inboxKey } from "./keys.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const queueConn = new Redis(REDIS_URL); // dedicated blocking connection for BRPOP
const cmd = new Redis(REDIS_URL);
queueConn.on("error", (e) => console.error("[redis:queue]", e.message));
cmd.on("error", (e) => console.error("[redis:cmd]", e.message));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const running = new Set<string>();

function toStatus(s: string): RunStatus {
  switch (s) {
    case "done": return RunStatus.done;
    case "failed": return RunStatus.failed;
    case "awaiting_founder": return RunStatus.awaiting_founder;
    default: return RunStatus.running;
  }
}

async function loadContext(runId: string): Promise<RunContext> {
  const run = await prisma.modeRun.findUnique({
    where: { id: runId },
    include: {
      roles: { include: { persona: true }, orderBy: { order: "asc" } },
      inheritedFrom: true,
    },
  });
  if (!run) throw new Error(`ModeRun ${runId} not found`);
  const c = run.companySnapshot as {
    name: string; bp: string; fundingCurrency?: string | null; valuation?: string | null;
    roundSize?: string | null; stage: string; topic?: string | null;
  };

  const panel = run.roles.map((r) => {
    const p = r.persona;
    const spec: Persona = {
      id: p.id,
      name: p.name,
      seatId: p.seatId,
      skinId: p.skinId,
      avatar: p.avatar ?? undefined,
      dimensionsOverride: p.dimensionsOverride.length ? (p.dimensionsOverride as Dimension[]) : undefined,
      riskAxesOverride: p.riskAxesOverride.length ? (p.riskAxesOverride as RiskAxis[]) : undefined,
    };
    return resolvePersona(spec);
  });

  const inherited =
    run.inheritedFrom?.result && typeof run.inheritedFrom.result === "object"
      ? (run.inheritedFrom.result as any)
      : undefined;

  return {
    runId: run.id,
    mode: run.mode,
    stage: run.stage,
    company: {
      name: c.name,
      bp: c.bp,
      fundingCurrency: c.fundingCurrency ?? undefined,
      valuation: c.valuation ?? undefined,
      roundSize: c.roundSize ?? undefined,
      stage: run.stage,
      topic: c.topic ?? undefined,
    },
    panel,
    inherited: inherited
      ? { crux: inherited.crux, byRole: inherited.by_role, willAdvance: undefined }
      : undefined,
  };
}

async function persist(runId: string, e: RunEvent): Promise<void> {
  if (e.type === "turn.completed") {
    await prisma.turn.create({
      data: { runId, seq: e.seq, actor: e.actor, segment: e.segment, content: e.content, fields: (e.fields as any) ?? undefined },
    });
  } else if (e.type === "result") {
    await prisma.modeRun.update({ where: { id: runId }, data: { result: e.payload as any } });
  } else if (e.type === "status") {
    await prisma.modeRun.update({ where: { id: runId }, data: { status: toStatus(e.status) } });
  }
}

// Event types that the UI replays on (re)connect. Streaming deltas are excluded
// to keep the log lean — the client renders turns only when completed.
const REPLAY_TYPES = new Set([
  "run.started", "segment", "turn.completed", "notice", "await_founder", "result", "status", "run.failed", "run.completed",
]);

async function handleRun(runId: string): Promise<void> {
  if (running.has(runId)) return;
  running.add(runId);
  console.log(`[orchestrator] starting run ${runId}`);
  try {
    const ctx = await loadContext(runId);
    // Monotonic per-run sequence for the durable replay log. Resume from the
    // existing max so re-processing a run can't collide on @@unique([runId, seq]).
    const lastEvent = await prisma.runEvent.findFirst({ where: { runId }, orderBy: { seq: "desc" } });
    let seq = lastEvent?.seq ?? 0;
    const emit = async (event: RunEvent) => {
      try { await persist(runId, event); } catch (err) { console.error("[orchestrator] persist error", err); }
      let outbound: RunEvent & { seq?: number } = event;
      if (REPLAY_TYPES.has(event.type)) {
        seq += 1;
        outbound = { ...event, seq };
        try {
          await prisma.runEvent.create({ data: { runId, seq, type: event.type, payload: event as any } });
        } catch (err) { console.error("[orchestrator] runEvent persist error", err); }
      }
      await cmd.publish(eventsChannel(runId), JSON.stringify(outbound));
    };
    await runMode(ctx, {
      emit,
      // Blocking founder input (Board per-item responses). Pauses the run.
      waitForFounder: async (kind, payload) => {
        await emit({ type: "await_founder", kind, payload });
        await prisma.modeRun.update({ where: { id: runId }, data: { status: RunStatus.awaiting_founder } }).catch(() => {});
        const blocker = new Redis(REDIS_URL);
        try {
          // block until the UI pushes a message to the inbox
          // (BLPOP returns [key, value]); loop guards against spurious wakeups
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const res = await blocker.blpop(inboxKey(runId), 0);
            if (res && res[1]) {
              await prisma.modeRun.update({ where: { id: runId }, data: { status: RunStatus.running } }).catch(() => {});
              try { return JSON.parse(res[1]); } catch { return { content: res[1] }; }
            }
          }
        } finally {
          blocker.quit().catch(() => {});
        }
      },
      // Non-blocking founder interjections (Founder Tea). Read + clear in one
      // atomic transaction so a concurrent push can't be lost.
      drainInterjections: async () => {
        const items = await drainListAtomic(cmd, inboxKey(runId));
        return items.map((s) => { try { return JSON.parse(s); } catch { return { content: s }; } });
      },
    });
  } catch (e) {
    console.error(`[orchestrator] run ${runId} failed`, e);
    // Don't leave the run wedged in "running": mark it failed and tell the UI.
    await prisma.modeRun.update({ where: { id: runId }, data: { status: RunStatus.failed } }).catch(() => {});
    await cmd
      .publish(eventsChannel(runId), JSON.stringify({ type: "run.failed", error: String((e as Error)?.message ?? e) }))
      .catch(() => {});
  } finally {
    running.delete(runId);
    console.log(`[orchestrator] finished run ${runId}`);
  }
}

async function main() {
  // Log the host only — REDIS_URL contains the password.
  const redisHost = (() => { try { return new URL(REDIS_URL).host; } catch { return "redis"; } })();
  console.log(`[orchestrator] listening on ${JOBS_QUEUE} (redis: ${redisHost})`);
  // Durable queue: BRPOP blocks until a job is available. Jobs LPUSH'd while the
  // worker was down are still here on reconnect (unlike pub/sub, which drops them).
  while (true) {
    try {
      const res = await queueConn.brpop(JOBS_QUEUE, 0); // [key, value] | null
      const job = parseJob(res?.[1]);
      if (job) void handleRun(job.runId);
    } catch (e) {
      console.error("[orchestrator] queue error", (e as Error).message);
      await sleep(1000); // avoid a hot loop if the connection is flapping
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

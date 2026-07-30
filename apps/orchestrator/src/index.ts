import { config } from "dotenv";
import { resolve } from "node:path";
config({ path: resolve(process.cwd(), "../../.env") });
config();

import Redis from "ioredis";
import { prisma, RunStatus } from "@quorum/db";
import {
  runMode,
  resolvePersona,
  type RunContext,
  type RunEvent,
  type Persona,
  type Dimension,
  type RiskAxis,
} from "@quorum/engine";
import { JOBS_CHANNEL, eventsChannel, inboxKey } from "./keys.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const sub = new Redis(REDIS_URL);
const cmd = new Redis(REDIS_URL);
sub.on("error", (e) => console.error("[redis:sub]", e.message));
cmd.on("error", (e) => console.error("[redis:cmd]", e.message));

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

async function handleRun(runId: string): Promise<void> {
  if (running.has(runId)) return;
  running.add(runId);
  console.log(`[orchestrator] starting run ${runId}`);
  try {
    const ctx = await loadContext(runId);
    const emit = async (event: RunEvent) => {
      try { await persist(runId, event); } catch (err) { console.error("[orchestrator] persist error", err); }
      await cmd.publish(eventsChannel(runId), JSON.stringify(event));
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
      // Non-blocking founder interjections (Founder Tea).
      drainInterjections: async () => {
        const items = await cmd.lrange(inboxKey(runId), 0, -1);
        if (items.length) await cmd.del(inboxKey(runId));
        return items.map((s) => { try { return JSON.parse(s); } catch { return { content: s }; } });
      },
    });
  } catch (e) {
    console.error(`[orchestrator] run ${runId} failed`, e);
  } finally {
    running.delete(runId);
    console.log(`[orchestrator] finished run ${runId}`);
  }
}

async function main() {
  await sub.subscribe(JOBS_CHANNEL);
  sub.on("message", (_ch, message) => {
    try {
      const { runId } = JSON.parse(message);
      if (runId) void handleRun(runId);
    } catch (e) {
      console.error("[orchestrator] bad job message", e);
    }
  });
  console.log(`[orchestrator] listening on ${JOBS_CHANNEL} (redis: ${REDIS_URL})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

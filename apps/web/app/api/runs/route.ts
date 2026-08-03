import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Mode } from "@quorum/db";
import { MIN_PANELISTS, MAX_PANELISTS, findDuplicates } from "@quorum/engine";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  companyId: z.string(),
  mode: z.enum(["screening", "ic", "board", "tea"]),
  participants: z
    .array(z.string())
    .min(MIN_PANELISTS)
    .max(MAX_PANELISTS)
    // Reject duplicate personas up front — otherwise the RunRole @@unique
    // constraint throws a 500 at insert time.
    .refine((ids) => findDuplicates(ids).length === 0, {
      message: "Duplicate panelists are not allowed.",
    }),
  inheritedFromId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  const company = await prisma.company.findUnique({ where: { id: b.companyId } });
  if (!company || company.ownerId !== s.userId)
    return NextResponse.json({ error: "company not found" }, { status: 404 });

  const companySnapshot = {
    name: company.name,
    bp: company.bp,
    fundingCurrency: company.fundingCurrency,
    valuation: company.valuation,
    roundSize: company.roundSize,
    stage: company.stage,
    topic: company.topic,
  };

  const run = await prisma.modeRun.create({
    data: {
      companyId: company.id,
      companySnapshot,
      mode: b.mode as Mode,
      stage: company.stage,
      inheritedFromId: b.inheritedFromId,
      roles: { create: b.participants.map((personaId, i) => ({ personaId, order: i })) },
    },
  });
  return NextResponse.json({ runId: run.id });
}

type Tone = "good" | "warn" | "bad" | "neutral";
/** Compact one-line preview of a run's outcome for the history list. */
function summarize(mode: string, result: any, status: string): { badge: string; tone: Tone; line: string } {
  if (!result) {
    if (status === "failed") return { badge: "Failed", tone: "bad", line: "This run did not finish." };
    if (status === "awaiting_founder") return { badge: "Awaiting you", tone: "warn", line: "Waiting for your input." };
    return { badge: status === "done" ? "Done" : "In progress", tone: "neutral", line: "" };
  }
  const tri = (v: string): Tone => (v === "ADVANCE" || v === "INVEST" ? "good" : v === "WATCH" || v === "CONDITIONAL" ? "warn" : "bad");
  if (mode === "screening") return { badge: result.outcome, tone: tri(result.outcome), line: result.reason ?? "" };
  if (mode === "ic") return { badge: result.verdict, tone: tri(result.verdict), line: result.rationale ?? "" };
  if (mode === "board") {
    const n = result.action_list?.length ?? 0;
    return { badge: `${n} action${n === 1 ? "" : "s"}`, tone: "neutral", line: result.action_list?.[0]?.suggestion ?? "" };
  }
  if (mode === "tea") {
    const n = result.theme_map?.length ?? 0;
    return { badge: `${n} theme${n === 1 ? "" : "s"}`, tone: "neutral", line: result.theme_map?.[0] ?? result.surprising_angles?.[0] ?? "" };
  }
  return { badge: status, tone: "neutral", line: "" };
}

/** History: runs for the current user, optionally filtered by company. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
  const runs = await prisma.modeRun.findMany({
    where: { company: { ownerId: s.userId }, ...(companyId ? { companyId } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { company: { select: { id: true, name: true } } },
  });
  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id, mode: r.mode, status: r.status, createdAt: r.createdAt,
      companyId: r.companyId, companyName: (r.companySnapshot as any)?.name ?? r.company.name,
      preview: summarize(r.mode, r.result, r.status),
    })),
  });
}

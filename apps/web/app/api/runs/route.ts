import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, Mode } from "@quorum/db";
import { MIN_PANELISTS, MAX_PANELISTS, findDuplicates } from "@quorum/engine";
import { getSession } from "@/lib/auth";
import { isDemoUser, DEMO_MAX_RUNS } from "@/lib/demo";
import { summarize } from "@/lib/runSummary";

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
  // Continuation (③): continue any prior run of the same company (any mode).
  parentRunId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const b = parsed.data;

  // Landing-page demo accounts run real LLM sessions on our dime: IC only,
  // and a hard cap per throwaway account (counting soft-deleted runs too, so
  // delete-and-retry doesn't reset the meter).
  if (isDemoUser(s.email)) {
    if (b.mode !== "ic")
      return NextResponse.json({ error: "The demo is limited to Investment Committee — sign up (free) to try every mode." }, { status: 403 });
    const used = await prisma.modeRun.count({ where: { company: { ownerId: s.userId } } });
    if (used >= DEMO_MAX_RUNS)
      return NextResponse.json({ error: `Demo limit reached (${DEMO_MAX_RUNS} sessions) — sign up (free) to keep going.` }, { status: 429 });
  }

  const company = await prisma.company.findUnique({
    where: { id: b.companyId },
    include: { documents: { select: { id: true, fileName: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!company || company.ownerId !== s.userId)
    return NextResponse.json({ error: "company not found" }, { status: 404 });

  // Continuation: the parent run must belong to this user and the same company
  // (any mode → any mode). The new run joins the parent's thread.
  let threadId: string | undefined;
  if (b.parentRunId) {
    const parent = await prisma.modeRun.findUnique({
      where: { id: b.parentRunId },
      include: { company: { select: { ownerId: true } } },
    });
    if (!parent || parent.company.ownerId !== s.userId || parent.companyId !== b.companyId)
      return NextResponse.json({ error: "parentRunId not found" }, { status: 404 });
    threadId = parent.threadId ?? parent.id;
  }

  // Inheritance: the upstream run must belong to this user (no cross-user leak)
  // and follow the only supported funnel, screening → IC.
  if (b.inheritedFromId) {
    const upstream = await prisma.modeRun.findUnique({
      where: { id: b.inheritedFromId },
      include: { company: { select: { ownerId: true } } },
    });
    if (!upstream || upstream.company.ownerId !== s.userId)
      return NextResponse.json({ error: "inheritedFromId not found" }, { status: 404 });
    if (b.mode !== "ic" || upstream.mode !== "screening")
      return NextResponse.json({ error: "incompatible inheritance (only screening → IC)" }, { status: 400 });
  }

  // Every chosen panelist must exist (else the RunRole insert 500s on the FK).
  const found = await prisma.persona.findMany({ where: { id: { in: b.participants } }, select: { id: true } });
  if (found.length !== b.participants.length)
    return NextResponse.json({ error: "one or more selected panelists do not exist" }, { status: 400 });

  const companySnapshot = {
    name: company.name,
    bp: company.bp,
    fundingCurrency: company.fundingCurrency,
    valuation: company.valuation,
    roundSize: company.roundSize,
    stage: company.stage,
    topic: company.topic,
    // Freeze the structured profile + document list as seen at run time.
    profile: company.profile ?? undefined,
    documentIds: company.documents.map((d) => d.id),
    documentNames: company.documents.map((d) => d.fileName),
  };

  const run = await prisma.modeRun.create({
    data: {
      companyId: company.id,
      companySnapshot,
      mode: b.mode as Mode,
      stage: company.stage,
      inheritedFromId: b.inheritedFromId,
      parentRunId: b.parentRunId,
      threadId,
      roles: { create: b.participants.map((personaId, i) => ({ personaId, order: i })) },
    },
  });
  // Every run belongs to a thread; a fresh run is a thread of one (itself).
  if (!threadId) await prisma.modeRun.update({ where: { id: run.id }, data: { threadId: run.id } });
  return NextResponse.json({ runId: run.id });
}

/** History: runs for the current user, optionally filtered by company. */
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const companyId = req.nextUrl.searchParams.get("companyId") ?? undefined;
  const deleted = req.nextUrl.searchParams.get("deleted") === "1";

  // Recently-deleted view: soft-deleted runs from the last 30 days.
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const where = deleted
    ? { company: { ownerId: s.userId }, deletedAt: { gte: cutoff }, ...(companyId ? { companyId } : {}) }
    : { company: { ownerId: s.userId }, deletedAt: null, ...(companyId ? { companyId } : {}) };

  const runs = await prisma.modeRun.findMany({
    where,
    orderBy: deleted ? { deletedAt: "desc" } : { createdAt: "desc" },
    take: 100,
    include: { company: { select: { id: true, name: true } } },
  });
  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id, mode: r.mode, status: r.status, createdAt: r.createdAt, deletedAt: r.deletedAt,
      companyId: r.companyId, companyName: (r.companySnapshot as any)?.name ?? r.company.name,
      preview: summarize(r.mode, r.result, r.status),
    })),
  });
}

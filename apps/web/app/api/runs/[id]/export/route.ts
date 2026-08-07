import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import { authorizeRun } from "@/lib/authorize";
import SessionReportPdf from "@/components/session/SessionReportPdf";
import type { ReportSegment, SessionReportData } from "@/components/session/reportTypes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODE_LABEL: Record<string, string> = {
  screening: "Screening", ic: "Investment Committee", board: "Board", tea: "Founder Tea",
};

const findRun = (id: string) => prisma.modeRun.findUnique({
  where: { id },
  include: {
    company: { select: { ownerId: true } },
    roles: { include: { persona: true }, orderBy: { order: "asc" } },
    turns: { orderBy: { seq: "asc" } },
    events: { where: { type: "segment" }, orderBy: { seq: "asc" } },
  },
});

function safeFilePart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "session";
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const authz = await authorizeRun(await getSession(), params.id, findRun);
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });

  const scope = req.nextUrl.searchParams.get("scope") === "full" ? "full" : "result";
  const run = authz.run;
  if (!run.result) return NextResponse.json({ error: "This session does not have a result yet." }, { status: 409 });

  const snapshot = run.companySnapshot as { name?: string; stage?: string };
  const actor = new Map(run.roles.map((role) => [role.personaId, role.persona.name]));
  const segments: ReportSegment[] = [];
  const byCode = new Map<string, ReportSegment>();
  for (const row of run.events) {
    const payload = row.payload as any;
    const code = payload.segment as string;
    if (!code || byCode.has(code)) continue;
    const segment = { code, label: payload.label ?? code, turns: [] };
    byCode.set(code, segment); segments.push(segment);
  }
  for (const turn of run.turns) {
    let segment = byCode.get(turn.segment);
    if (!segment) {
      segment = { code: turn.segment, label: turn.segment, turns: [] };
      byCode.set(turn.segment, segment); segments.push(segment);
    }
    segment.turns.push({
      id: turn.id,
      actor: turn.actor,
      actorName: turn.actor === "founder" ? "Founder" : turn.actor === "host" ? (run.mode === "tea" ? "Host" : "Chair") : actor.get(turn.actor) ?? "Investor",
      content: turn.content,
    });
  }

  const report: SessionReportData = {
    id: run.id,
    companyName: snapshot.name ?? "Startup",
    stage: snapshot.stage ?? run.stage,
    mode: run.mode,
    modeLabel: MODE_LABEL[run.mode] ?? run.mode,
    createdAt: run.createdAt.toISOString(),
    generatedAt: new Date().toISOString(),
    participants: run.roles.map((role) => role.persona.name),
    segments,
    result: run.result,
    scope,
  };

  // react-pdf's renderer accepts a component that returns <Document>, while its
  // public TypeScript signature narrowly asks for the <Document> element itself.
  const pdf = await renderToBuffer(createElement(SessionReportPdf, { report }) as any);
  const date = run.createdAt.toISOString().slice(0, 10);
  const filename = `quorum-${safeFilePart(report.companyName)}-${safeFilePart(run.mode)}-${date}-${scope === "full" ? "full-report" : "result"}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

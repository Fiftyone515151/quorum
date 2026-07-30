import Link from "next/link";
import { prisma } from "@quorum/db";
import { getSession } from "@/lib/auth";
import CompaniesManager from "@/components/CompaniesManager";

export const dynamic = "force-dynamic";

const MODES = [
  { id: "screening", label: "Screening", emoji: "🎯", blurb: "Fast triage → ADVANCE / WATCH / PASS + crux" },
  { id: "ic", label: "Investment Committee", emoji: "⚖️", blurb: "Adversarial verdict → INVEST / CONDITIONAL / PASS" },
  { id: "board", label: "Board", emoji: "🛠️", blurb: "Post-investment priority list + risk coverage" },
  { id: "tea", label: "Founder Tea", emoji: "🍵", blurb: "Open discussion, clues only" },
];

export default async function HomePage() {
  const session = await getSession();
  const companies = session
    ? await prisma.company.findMany({ where: { ownerId: session.userId }, orderBy: { updatedAt: "desc" } })
    : [];

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-2">
        <p className="label">Simulated VC panel</p>
        <h1 className="max-w-2xl text-2xl font-semibold leading-tight text-white">
          Save your startup once, then run it past a VC panel any time.
        </h1>
      </section>

      <CompaniesManager initial={companies as any} />

      <section className="flex flex-col gap-3">
        <p className="label">
          Pick a meeting to start
          {companies.length === 0 && <span className="ml-2 text-brass">— add a startup above first</span>}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {MODES.map((m) => {
            const disabled = companies.length === 0;
            const inner = (
              <>
                <div className="mb-1 flex items-center gap-2 text-white"><span>{m.emoji}</span><span className="font-medium">{m.label}</span></div>
                <p className="text-sm text-muted">{m.blurb}</p>
              </>
            );
            return disabled ? (
              <div key={m.id} className="card cursor-not-allowed p-5 opacity-50">{inner}</div>
            ) : (
              <Link key={m.id} href={`/new?mode=${m.id}`} className="card p-5 transition hover:border-accent">{inner}</Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

// Mirror of the engine constants (importing @quorum/engine here would pull
// server-only deps into the client bundle). The server still enforces the
// authoritative values in POST /api/runs.
const MIN_PANELISTS = 4;
const MAX_PANELISTS = 6;

interface PersonaDTO {
  id: string; name: string; avatar?: string; seat: string; stance: string; firm: string | null; isStar: boolean;
}
interface Company { id: string; name: string; stage: string; topic: string | null }
type Mode = "screening" | "ic" | "board" | "tea";

const MODE_LABEL: Record<Mode, string> = {
  screening: "Screening", ic: "Investment Committee", board: "Board", tea: "Founder Tea",
};
const STAGE_LABEL: Record<string, string> = { pre_seed: "Pre-seed", angel: "Angel", seed: "Seed", A: "Series A" };

function Pixel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-pixel leading-[1.7] text-brand ${className}`}>{children}</span>;
}

function PersonaCard({ p, selected, onToggle }: { p: PersonaDTO; selected: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex w-28 shrink-0 flex-col items-center gap-2 rounded-xl border-2 p-2 text-center transition ${selected ? "border-brand bg-brand-tint" : "border-transparent hover:bg-navy/5"}`}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-brand/30 bg-white text-2xl shadow-sm">
        {p.avatar ?? "🧠"}
      </div>
      <span className="text-xs font-medium leading-tight text-navy/85">{p.name}</span>
      <span className="text-[10px] leading-tight text-navy/45">
        {p.isStar ? `in the style of · ${p.firm ?? ""}` : `${p.seat} · ${p.stance}`}
      </span>
    </button>
  );
}

function NewSessionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = ((params.get("mode") as Mode) || "screening") as Mode;
  const from = params.get("from"); // continue from a prior run (parentRunId)
  const storeKey = `quorum:new:${mode}`;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [pool, setPool] = useState<{ defaults: PersonaDTO[]; stars: PersonaDTO[] } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  // Load companies + personas; restore a saved draft, or prefill from a parent
  // run when continuing (?from=…).
  useEffect(() => {
    let saved: { companyId?: string; selected?: string[] } = {};
    if (!from) { try { saved = JSON.parse(sessionStorage.getItem(storeKey) || "{}"); } catch { /* ignore */ } }
    const cookieCompany = document.cookie.split("; ").find((c) => c.startsWith("quorum_active_company="))?.split("=")[1];

    const parentP = from
      ? fetch(`/api/runs/${from}`).then((r) => r.json()).then((d) => d.run).catch(() => null)
      : Promise.resolve(null);

    Promise.all([
      fetch("/api/companies").then((r) => r.json()),
      fetch("/api/personas").then((r) => r.json()),
      parentP,
    ]).then(([cd, pd, parent]) => {
      const list: Company[] = cd.companies ?? [];
      setCompanies(list);
      setPool(pd);
      const all: PersonaDTO[] = [...(pd.defaults ?? []), ...(pd.stars ?? [])];

      if (parent) {
        // Continuation: lock to the parent's company, prefill its panel.
        setCompanyId(parent.companyId);
        const roleIds = (parent.roles ?? []).map((r: any) => r.persona?.id).filter(Boolean);
        const restore = roleIds.filter((id: string) => all.some((p) => p.id === id));
        setSelected(restore.length ? restore : pd.defaults.slice(0, 5).map((p: PersonaDTO) => p.id));
      } else {
        const pick = (saved.companyId && list.some((c) => c.id === saved.companyId) && saved.companyId)
          || (cookieCompany && list.some((c) => c.id === cookieCompany) && cookieCompany)
          || list[0]?.id || "";
        setCompanyId(pick);
        const restore = (saved.selected ?? []).filter((id) => all.some((p) => p.id === id));
        setSelected(restore.length ? restore : (pd.defaults ?? []).slice(0, 5).map((p: PersonaDTO) => p.id));
      }
      setRestored(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey, from]);

  // Persist the draft (fresh sessions only — don't pollute the draft while continuing).
  useEffect(() => {
    if (!restored || from) return;
    sessionStorage.setItem(storeKey, JSON.stringify({ companyId, selected }));
  }, [companyId, selected, restored, storeKey, from]);

  // Fetch the selected company's documents for the preview.
  useEffect(() => {
    if (!companyId) { setDocs([]); return; }
    fetch(`/api/documents?companyId=${companyId}`).then((r) => r.json())
      .then((d) => setDocs((d.documents ?? []).map((x: any) => x.fileName))).catch(() => setDocs([]));
  }, [companyId]);

  const company = useMemo(() => companies.find((c) => c.id === companyId) ?? null, [companies, companyId]);

  function selectCompany(id: string) {
    setCompanyId(id);
    document.cookie = `quorum_active_company=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }

  function toggle(id: string) {
    setNotice(null);
    setSelected((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (s.length >= MAX_PANELISTS) { setNotice(`At most ${MAX_PANELISTS} investors.`); return s; }
      return [...s, id];
    });
  }

  async function convene() {
    setNotice(null);
    if (!companyId) return setNotice("Select a startup first.");
    if (selected.length < MIN_PANELISTS) return setNotice(`Pick at least ${MIN_PANELISTS} investors to start.`);
    setBusy(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, companyId, participants: selected, parentRunId: from ?? undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Failed to create");
      await fetch(`/api/runs/${d.runId}/start`, { method: "POST" });
      sessionStorage.removeItem(storeKey);
      router.push(`/session/${d.runId}`);
    } catch (e: any) { setNotice(e.message); setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-white font-sans text-navy">
      {/* Top bar */}
      <div className="mx-auto flex max-w-5xl items-center px-6 py-3">
        <img src="/brand/lockup.png" alt="Quorum" className="h-9 w-auto sm:h-12" />
        <Link href="/" aria-label="Exit" className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-navy/50 transition hover:bg-navy/5 hover:text-navy">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></svg>
        </Link>
      </div>
      <div className="border-b border-navy/10" />

      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8">
        <h1 className="text-center"><Pixel className="text-xl sm:text-2xl">New Session: {MODE_LABEL[mode]}</Pixel></h1>

        {from && (
          <p className="rounded-lg bg-brand-tint px-4 py-2 text-center text-sm text-brand">
            Continuing from a previous {MODE_LABEL[mode]} session — update the info or panel, then reconvene.
          </p>
        )}

        {/* Company */}
        {companies.length === 0 ? (
          <p className="text-center text-sm text-navy/60">
            No startup yet — <Link href="/onboarding?add=1" className="text-brand underline">add one first</Link>.
          </p>
        ) : (
          <section className="flex flex-col gap-3">
            <select value={companyId} onChange={(e) => selectCompany(e.target.value)} disabled={!!from}
              className="max-w-sm rounded-lg border border-navy/15 bg-white p-3 text-sm text-navy outline-none focus:border-brand disabled:opacity-60">
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {company && (
              <div className="relative rounded-2xl border border-brand/60 p-5">
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex gap-2"><dt className="w-16 shrink-0 font-semibold text-navy/60">Name</dt><dd className="text-navy/90">{company.name}</dd></div>
                  <div className="flex gap-2"><dt className="w-16 shrink-0 font-semibold text-navy/60">Stage</dt><dd className="text-navy/90">{STAGE_LABEL[company.stage] ?? company.stage}</dd></div>
                  <div className="flex gap-2"><dt className="w-16 shrink-0 font-semibold text-navy/60">Topic</dt><dd className="text-navy/90">{company.topic || "—"}</dd></div>
                  <div className="flex gap-2"><dt className="w-16 shrink-0 font-semibold text-navy/60">Files</dt><dd className="text-navy/90">{docs.length ? docs.join(", ") : "—"}</dd></div>
                </dl>
                <Link href={`/profile?return=new&mode=${mode}`}
                  className="mt-3 block text-right text-sm font-medium text-brand underline underline-offset-2 hover:text-brand-dark">
                  Edit Startup info
                </Link>
              </div>
            )}
          </section>
        )}

        {/* Panel selection */}
        {pool && companies.length > 0 && (
          <section className="flex flex-col gap-5">
            <Pixel className="text-sm sm:text-base">Pick {MIN_PANELISTS}–{MAX_PANELISTS} investors from the Persona Library and Star Investors below.</Pixel>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Persona Library</p>
              <div className="flex flex-wrap gap-3">
                {pool.defaults.map((p) => <PersonaCard key={p.id} p={p} selected={selected.includes(p.id)} onToggle={() => toggle(p.id)} />)}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-navy/50">Star Investors</p>
              <div className="flex flex-wrap gap-3">
                {pool.stars.map((p) => <PersonaCard key={p.id} p={p} selected={selected.includes(p.id)} onToggle={() => toggle(p.id)} />)}
              </div>
            </div>

            <p className="text-sm text-navy/50">Selected {selected.length}/{MAX_PANELISTS}</p>
          </section>
        )}

        {/* Convene */}
        {companies.length > 0 && (
          <section className="flex flex-col items-center gap-3">
            <Pixel className="text-sm sm:text-base">Happy with your picks? Start below!</Pixel>
            {notice && <p className="text-sm font-medium text-brand-dark">{notice}</p>}
            <button onClick={convene} disabled={busy}
              className="rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50">
              {busy ? "Convening…" : "Convene the panel"}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={<p className="p-6 text-navy/50">Loading…</p>}>
      <NewSessionInner />
    </Suspense>
  );
}

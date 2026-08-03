"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface PersonaDTO {
  id: string; name: string; avatar?: string; seat: string;
  dimensions: string[]; stance: string; reasoning: string; identity: string | null; firm: string | null; isStar: boolean;
}
interface Company { id: string; name: string; stage: string }
type Mode = "screening" | "ic" | "board" | "tea";
const MODE_LABEL: Record<Mode, string> = { screening: "🎯 Screening", ic: "⚖️ Investment Committee", board: "🛠️ Board", tea: "🍵 Founder Tea" };

function NewSessionInner() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = (params.get("mode") as Mode) || "screening";

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [pool, setPool] = useState<{ defaults: PersonaDTO[]; stars: PersonaDTO[] } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/companies").then((r) => r.json()).then((d) => {
      setCompanies(d.companies ?? []);
      if (d.companies?.[0]) setCompanyId(d.companies[0].id);
    });
    fetch("/api/personas").then((r) => r.json()).then((d) => {
      setPool(d);
      setSelected(d.defaults.slice(0, 5).map((p: PersonaDTO) => p.id));
    });
  }, []);

  const rosterError = useMemo(() => {
    if (selected.length < 2) return "Pick at least 2 roles.";
    if (selected.length > 6) return "At most 6 roles.";
    return null;
  }, [selected]);

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 6 ? [...s, id] : s));
  }

  async function create() {
    setError(null);
    if (!companyId) return setError("Select a startup.");
    if (rosterError) return setError(rosterError);
    setBusy(true);
    try {
      const res = await fetch("/api/runs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, companyId, participants: selected }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Failed to create");
      await fetch(`/api/runs/${d.runId}/start`, { method: "POST" });
      router.push(`/session/${d.runId}`);
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  const card = (p: PersonaDTO) => (
    <button key={p.id} onClick={() => toggle(p.id)}
      className={`card p-3 text-left transition ${selected.includes(p.id) ? "border-accent ring-1 ring-accent" : "hover:border-muted"}`}>
      <div className="flex items-center gap-2 text-white"><span>{p.avatar ?? "🧠"}</span><span className="text-sm font-medium">{p.name}</span>
        <span className={`label ml-auto ${p.stance === "skeptic" ? "text-brass" : p.stance === "optimist" ? "text-accent" : ""}`}>{p.stance}</span></div>
      {p.firm && <div className="mt-0.5 text-xs italic text-muted">In the style of · {p.firm}</div>}
      <div className="mt-1 text-xs text-muted">{p.seat} · {p.dimensions.join("/") || "generalist"}</div>
    </button>
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-white">New session · <span className="text-accent">{MODE_LABEL[mode]}</span></h1>

      <section className="flex flex-col gap-3">
        <p className="label">1 · Which startup</p>
        {companies.length === 0 ? (
          <p className="text-sm text-brass">No startups yet — add one on the home page first.</p>
        ) : (
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="max-w-sm rounded-lg border border-line bg-ink p-3 text-sm text-white">
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.stage})</option>)}
          </select>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <p className="label">2 · Panel · {selected.length}/6</p>
        {pool && (
          <>
            <p className="text-xs text-muted">Default pool</p>
            <div className="grid gap-2 sm:grid-cols-2">{pool.defaults.map(card)}</div>
            <p className="mt-2 text-xs text-muted">Star investor archetypes</p>
            <div className="grid gap-2 sm:grid-cols-2">{pool.stars.map(card)}</div>
          </>
        )}
        {rosterError && <p className="text-xs text-brass">{rosterError}</p>}
      </section>

      {error && <p className="text-sm text-brass">{error}</p>}
      <button onClick={create} disabled={busy || companies.length === 0} className="btn-primary self-start">
        {busy ? "Convening…" : "Convene the panel"}
      </button>
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={<p className="text-muted">Loading…</p>}>
      <NewSessionInner />
    </Suspense>
  );
}

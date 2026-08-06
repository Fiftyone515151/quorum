"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PROFILE_QUESTIONS, type ProfileKey } from "@/lib/profile";

interface Company {
  id: string; name: string; docText?: string | null; bpFileName?: string | null; stage: string;
  fundingCurrency?: string | null; valuation?: string | null; roundSize?: string | null;
  topic?: string | null; profile?: Record<string, string> | null;
}
const STAGES = ["pre_seed", "angel", "seed", "A"];
const STAGE_LABEL: Record<string, string> = { pre_seed: "Pre-seed", angel: "Angel", seed: "Seed", A: "Series A" };
const blank = {
  name: "", topic: "", docText: "", bpFileName: "", stage: "seed",
  fundingCurrency: "USD", valuation: "", roundSize: "", profile: {} as Record<string, string>,
};

export default function CompaniesManager({ initial }: { initial: Company[] }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>(initial);
  const [editing, setEditing] = useState<string | "new" | null>(initial.length === 0 ? "new" : null);
  const [form, setForm] = useState<any>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(c: Company | null) {
    setError(null);
    if (c) { setEditing(c.id); setForm({ ...blank, ...c, profile: c.profile ?? {} }); }
    else { setEditing("new"); setForm(blank); }
  }

  async function uploadBp(file: File) {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (res.ok) setForm((f: any) => ({ ...f, docText: d.content, bpFileName: file.name, name: f.name || d.name.replace(/\.[^.]+$/, "") }));
    else setError(d.error ?? "Upload failed");
  }

  async function save() {
    setError(null);
    if (!form.name.trim()) return setError("Startup name is required.");
    if (!form.docText?.trim() && !form.topic?.trim()) return setError("Upload a business plan or add a one-liner.");
    setBusy(true);
    try {
      const isNew = editing === "new";
      const res = await fetch(isNew ? "/api/companies" : `/api/companies/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, topic: form.topic, docText: form.docText, bpFileName: form.bpFileName,
          stage: form.stage, fundingCurrency: form.fundingCurrency, valuation: form.valuation,
          roundSize: form.roundSize, profile: form.profile,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Save failed");
      setCompanies((cs) => isNew ? [d.company, ...cs] : cs.map((c) => (c.id === d.company.id ? d.company : c)));
      setEditing(null);
      router.refresh(); // re-render server home so the mode cards enable immediately
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this startup and its runs?")) return;
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    setCompanies((cs) => cs.filter((c) => c.id !== id));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <p className="label">Your startups</p>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/onboarding?add=1" className="text-xs text-muted underline hover:text-accent">Set up by chat instead</Link>
          <button onClick={() => startEdit(null)} className="btn-ghost">+ Add startup</button>
        </div>
      </div>

      {companies.map((c) =>
        editing === c.id ? (
          <Editor key={c.id} form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} onUpload={uploadBp} busy={busy} error={error} />
        ) : (
          <div key={c.id} className="card flex items-center gap-3 p-4">
            <span className="text-sm font-medium text-white">{c.name}</span>
            <span className="label">{c.stage}</span>
            <button onClick={() => startEdit(c)} className="btn-ghost ml-auto">Edit</button>
            <button onClick={() => remove(c.id)} className="text-muted hover:text-brass">✕</button>
          </div>
        )
      )}

      {editing === "new" && (
        <Editor form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} onUpload={uploadBp} busy={busy} error={error} isNew />
      )}
    </div>
  );
}

function Editor({ form, setForm, onSave, onCancel, onUpload, busy, error, isNew }: any) {
  const set = (k: string) => (e: any) => setForm((f: any) => ({ ...f, [k]: e.target.value }));
  const setProfile = (k: ProfileKey) => (e: any) =>
    setForm((f: any) => ({ ...f, profile: { ...(f.profile ?? {}), [k]: e.target.value } }));
  return (
    <div className="card flex flex-col gap-3 p-4">
      <p className="label">{isNew ? "New startup" : "Edit startup"}</p>
      <input value={form.name} onChange={set("name")} placeholder="Startup name" className="rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent" />
      <input value={form.topic ?? ""} onChange={set("topic")} placeholder="One-liner — what you do" className="rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent" />
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-line bg-ink p-3 text-sm hover:border-accent">
        <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        {form.bpFileName || form.docText ? (
          <>
            <span className="text-accent">📄</span>
            <span className="truncate text-white">{form.bpFileName || "BP on file"}</span>
            <span className="label text-muted ml-auto shrink-0">Replace</span>
          </>
        ) : (
          <>
            <span className="text-muted">Upload BP</span>
            <span className="label text-muted ml-auto shrink-0">.pdf .docx .txt .md</span>
          </>
        )}
      </label>
      <div className="flex flex-wrap gap-2">
        <select value={form.stage} onChange={set("stage")} className="rounded-lg border border-line bg-ink p-2 text-sm text-white">
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s] ?? s}</option>)}
        </select>
        <input value={form.fundingCurrency ?? ""} onChange={set("fundingCurrency")} placeholder="Currency" className="w-24 rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
        <input value={form.valuation ?? ""} onChange={set("valuation")} placeholder="Valuation" className="w-32 rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
        <input value={form.roundSize ?? ""} onChange={set("roundSize")} placeholder="Round size" className="w-32 rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Founding team — team composition, or the founder's background if solo</span>
        <textarea value={form.profile?.founderTeam ?? ""} onChange={setProfile("founderTeam")} rows={2}
          className="resize-y rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
      </label>

      <details className="rounded-lg border border-line bg-ink/40 p-3">
        <summary className="cursor-pointer text-xs font-medium text-muted">Startup profile — optional, sharpens the panel's read</summary>
        <div className="mt-3 flex flex-col gap-3">
          {PROFILE_QUESTIONS.map((q) => (
            <label key={q.key} className="flex flex-col gap-1">
              <span className="text-xs text-muted">{q.label} — {q.question}</span>
              <textarea value={form.profile?.[q.key] ?? ""} onChange={setProfile(q.key)} rows={2}
                className="resize-y rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
            </label>
          ))}
        </div>
      </details>

      {error && <p className="text-xs text-brass">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

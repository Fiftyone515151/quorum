"use client";

import { useState } from "react";

interface Company {
  id: string; name: string; bp: string; stage: string;
  fundingCurrency?: string | null; valuation?: string | null; roundSize?: string | null; topic?: string | null;
}
const STAGES = ["pre_seed", "seed", "A"];
const blank = { name: "", bp: "", stage: "seed", fundingCurrency: "USD", valuation: "", roundSize: "", topic: "" };

export default function CompaniesManager({ initial }: { initial: Company[] }) {
  const [companies, setCompanies] = useState<Company[]>(initial);
  const [editing, setEditing] = useState<string | "new" | null>(initial.length === 0 ? "new" : null);
  const [form, setForm] = useState<any>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(c: Company | null) {
    setError(null);
    if (c) { setEditing(c.id); setForm({ ...blank, ...c }); }
    else { setEditing("new"); setForm(blank); }
  }

  async function uploadBp(file: File) {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (res.ok) setForm((f: any) => ({ ...f, bp: d.content, name: f.name || d.name.replace(/\.[^.]+$/, "") }));
    else setError(d.error ?? "Upload failed");
  }

  async function save() {
    setError(null);
    if (!form.name.trim() || !form.bp.trim()) return setError("Name and BP are required.");
    setBusy(true);
    try {
      const isNew = editing === "new";
      const res = await fetch(isNew ? "/api/companies" : `/api/companies/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Save failed");
      setCompanies((cs) => isNew ? [d.company, ...cs] : cs.map((c) => (c.id === d.company.id ? d.company : c)));
      setEditing(null);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this startup and its runs?")) return;
    await fetch(`/api/companies/${id}`, { method: "DELETE" });
    setCompanies((cs) => cs.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <p className="label">Your startups</p>
        <button onClick={() => startEdit(null)} className="btn-ghost ml-auto">+ Add startup</button>
      </div>

      {companies.map((c) =>
        editing === c.id ? (
          <Editor key={c.id} form={form} setForm={setForm} onSave={save} onCancel={() => setEditing(null)} onUpload={uploadBp} busy={busy} error={error} />
        ) : (
          <div key={c.id} className="card flex items-center gap-3 p-4">
            <span className="text-sm font-medium text-white">{c.name}</span>
            <span className="label">{c.stage}</span>
            <span className="label text-muted">{c.bp.length} chars BP</span>
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
  return (
    <div className="card flex flex-col gap-3 p-4">
      <p className="label">{isNew ? "New startup" : "Edit startup"}</p>
      <input value={form.name} onChange={set("name")} placeholder="Startup name" className="rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent" />
      <textarea value={form.bp} onChange={set("bp")} placeholder="BP (paste, or upload — any language)" className="min-h-[110px] rounded-lg border border-line bg-ink p-3 text-sm text-white outline-none focus:border-accent" />
      <label className="btn-ghost cursor-pointer self-start">Upload / update BP
        <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
      </label>
      <div className="flex flex-wrap gap-2">
        <select value={form.stage} onChange={set("stage")} className="rounded-lg border border-line bg-ink p-2 text-sm text-white">
          {STAGES.map((s) => <option key={s} value={s}>{s === "A" ? "Series A" : s}</option>)}
        </select>
        <input value={form.fundingCurrency ?? ""} onChange={set("fundingCurrency")} placeholder="Currency" className="w-24 rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
        <input value={form.valuation ?? ""} onChange={set("valuation")} placeholder="Valuation" className="w-32 rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
        <input value={form.roundSize ?? ""} onChange={set("roundSize")} placeholder="Round size" className="w-32 rounded-lg border border-line bg-ink p-2 text-sm text-white outline-none focus:border-accent" />
      </div>
      {error && <p className="text-xs text-brass">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

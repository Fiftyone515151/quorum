"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StartupFields, { emptyStartupForm, companyToForm, toCompanyBody } from "./StartupFields";

interface Company {
  id: string; name: string; bp: string; bpFileName?: string | null; stage: string; profile?: any;
  fundingCurrency?: string | null; valuation?: string | null; roundSize?: string | null; topic?: string | null;
}

export default function CompaniesManager({ initial }: { initial: Company[] }) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>(initial);
  const [editing, setEditing] = useState<string | "new" | null>(initial.length === 0 ? "new" : null);
  const [form, setForm] = useState<any>(emptyStartupForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(c: Company | null) {
    setError(null);
    if (c) { setEditing(c.id); setForm(companyToForm(c)); }
    else { setEditing("new"); setForm(emptyStartupForm); }
  }

  async function uploadBp(file: File) {
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const d = await res.json();
    if (res.ok) setForm((f: any) => ({ ...f, bp: d.content, bpFileName: file.name, name: f.name || d.name.replace(/\.[^.]+$/, "") }));
    else setError(d.error ?? "Upload failed");
  }

  async function save() {
    setError(null);
    if (!form.name.trim() || !form.topic.trim()) return setError("Name and one-liner are required.");
    setBusy(true);
    try {
      const isNew = editing === "new";
      const res = await fetch(isNew ? "/api/companies" : `/api/companies/${editing}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCompanyBody(form)),
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

  const editor = (isNew: boolean) => (
    <div className="card flex flex-col gap-3 p-4">
      <p className="label">{isNew ? "New startup" : "Edit startup"}</p>
      <StartupFields form={form} setForm={setForm} onUpload={uploadBp} />
      {error && <p className="text-xs text-brass">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saving…" : "Save"}</button>
        <button onClick={() => setEditing(null)} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <p className="label">Your startups</p>
        <button onClick={() => startEdit(null)} className="btn-ghost ml-auto">+ Add startup</button>
      </div>

      {companies.map((c) =>
        editing === c.id ? (
          <div key={c.id}>{editor(false)}</div>
        ) : (
          <div key={c.id} className="card flex items-center gap-3 p-4">
            <span className="text-sm font-medium text-white">{c.name}</span>
            <span className="label">{c.stage}</span>
            <button onClick={() => startEdit(c)} className="btn-ghost ml-auto">Edit</button>
            <button onClick={() => remove(c.id)} className="text-muted hover:text-brass">✕</button>
          </div>
        )
      )}

      {editing === "new" && editor(true)}
    </div>
  );
}

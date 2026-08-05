"use client";

import { useEffect, useRef, useState } from "react";

interface Doc { id: string; fileName: string; ext: string }

// Overlays the right-column card. Talks to /api/documents (delivered in the
// document-library PR); until then it simply shows an empty library.
export default function FileLibraryPanel({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const r = await fetch(`/api/documents?companyId=${companyId}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setDocs(d.documents ?? []);
    } catch {
      setDocs([]); // API not available yet → empty library
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  async function upload(files: FileList) {
    setError(null);
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("companyId", companyId);
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Could not upload ${file.name}`);
      }
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) setDocs((d) => (d ? d.filter((x) => x.id !== id) : d));
  }

  return (
    <div className="absolute inset-0 z-20 flex flex-col gap-4 rounded-2xl border border-navy/10 bg-white p-5">
      <button onClick={onClose} className="flex items-center gap-1 self-start text-sm font-medium text-navy/60 transition hover:text-brand">
        <span>←</span> Back
      </button>

      <input ref={fileRef} type="file" multiple accept=".pdf,.docx,.txt,.md,.markdown" className="hidden"
        onChange={(e) => e.target.files?.length && upload(e.target.files)} />
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50">
        {busy ? "Working…" : "Upload"}
      </button>

      {error && <p className="text-xs text-brand-dark">{error}</p>}

      <div className="flex flex-col gap-2 overflow-y-auto">
        {docs === null ? (
          <p className="text-sm text-navy/40">Loading…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-navy/40">No files yet.</p>
        ) : (
          docs.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-lg border border-navy/10 px-3 py-2 text-sm">
              <span className="text-brand">📄</span>
              <span className="min-w-0 flex-1 truncate text-navy/90">{d.fileName}</span>
              <button onClick={() => remove(d.id)} aria-label="Delete file" className="shrink-0 text-navy/40 transition hover:text-brand">✕</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

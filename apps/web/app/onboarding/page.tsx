"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import StartupFields, { emptyStartupForm, toCompanyBody } from "@/components/StartupFields";

export default function OnboardingPage() {
  const router = useRouter();
  const [form, setForm] = useState<any>(emptyStartupForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCompanyBody(form)),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Save failed");
      router.push("/");
      router.refresh();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  return (
    <div className="mx-auto mt-8 flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Set up your startup</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          A name and one-liner are all you need to start. The more you add, the sharper the panel —
          and you can edit any of it later.
        </p>
      </div>
      <div className="card flex flex-col gap-3 p-5">
        <StartupFields form={form} setForm={setForm} onUpload={uploadBp} />
        {error && <p className="text-xs text-brass">{error}</p>}
        <button onClick={save} disabled={busy} className="btn-primary self-start">
          {busy ? "Saving…" : "Save & continue"}
        </button>
      </div>
    </div>
  );
}

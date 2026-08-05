"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PROFILE_QUESTIONS, type ProfileKey } from "@/lib/profile";

// ── Conversation script ───────────────────────────────────────────────────
type StepType = "text" | "stage" | "files";
interface Step {
  key: string; // "name" | "topic" | "stage" | "files" | ProfileKey
  type: StepType;
  optional: boolean;
  bot: string[]; // bot bubbles shown before awaiting this answer
}

const STAGES: { value: string; label: string }[] = [
  { value: "pre_seed", label: "Pre-seed" },
  { value: "seed", label: "Seed" },
  { value: "A", label: "Series A" },
];

const STEPS: Step[] = [
  {
    key: "name",
    type: "text",
    optional: false,
    bot: [
      "Welcome to Quorum 👋",
      "Let's set up your startup. First, a few essentials — these are required.",
      "What's your startup called?",
    ],
  },
  { key: "topic", type: "text", optional: false, bot: ["In one line, what do you do?"] },
  { key: "stage", type: "stage", optional: false, bot: ["What stage are you at?"] },
  {
    key: "files",
    type: "files",
    optional: false,
    bot: ["Upload your business plan or deck. You can add more than one file (PDF, DOCX, TXT, MD)."],
  },
  ...PROFILE_QUESTIONS.map((q, i) => ({
    key: q.key as string,
    type: "text" as StepType,
    optional: true,
    bot:
      i === 0
        ? [
            "Great — the essentials are in. 🎉",
            "These next questions are optional. Skip any and complete them later in your startup profile — but a fuller picture gives the panel sharper feedback.",
            q.question,
          ]
        : [q.question],
  })),
];

interface Msg { role: "bot" | "user"; text: string; avatar?: boolean }
interface Attached { fileName: string; text: string }

export default function OnboardingChat({ adding }: { adding: boolean }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [attached, setAttached] = useState<Attached[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const step = STEPS[stepIndex];
  const scrollRef = useRef<HTMLDivElement>(null);

  // Show the first step's prompts on mount.
  useEffect(() => {
    setMessages(STEPS[0].bot.map((t, i) => ({ role: "bot", text: t, avatar: i === 0 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, attached, uploading]);

  function pushBot(lines: string[]) {
    setMessages((m) => [...m, ...lines.map((t, i) => ({ role: "bot" as const, text: t, avatar: i === 0 }))]);
  }
  function pushUser(text: string) {
    setMessages((m) => [...m, { role: "user", text }]);
  }

  function advance(nextAnswers: Record<string, string>) {
    const next = stepIndex + 1;
    if (next >= STEPS.length) {
      submit(nextAnswers);
      return;
    }
    setStepIndex(next);
    setDraft("");
    setError(null);
    pushBot(STEPS[next].bot);
  }

  function sendText() {
    const v = draft.trim();
    if (!v) return;
    pushUser(v);
    const na = { ...answers, [step.key]: v };
    setAnswers(na);
    advance(na);
  }

  function pickStage(value: string, label: string) {
    pushUser(label);
    const na = { ...answers, stage: value };
    setAnswers(na);
    advance(na);
  }

  function skip() {
    pushUser("Skipped — I'll add this later");
    advance(answers);
  }

  async function attachFiles(files: FileList) {
    setError(null);
    setUploading(true);
    try {
      const added: Attached[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error ?? `Could not read ${file.name}`);
        added.push({ fileName: file.name, text: d.content });
      }
      setAttached((a) => [...a, ...added]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  function removeAttached(i: number) {
    setAttached((a) => a.filter((_, idx) => idx !== i));
  }

  function sendFiles() {
    if (attached.length === 0) return;
    pushUser(attached.map((a) => `📄 ${a.fileName}`).join("   "));
    advance(answers); // docs live in `attached`, read at submit
  }

  async function submit(finalAnswers: Record<string, string>) {
    setSubmitting(true);
    setError(null);
    pushBot(["Setting up your startup…"]);
    const profile: Partial<Record<ProfileKey, string>> = {};
    for (const q of PROFILE_QUESTIONS) {
      const v = finalAnswers[q.key];
      if (v && v.trim()) profile[q.key] = v.trim();
    }
    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalAnswers.name,
          topic: finalAnswers.topic,
          stage: finalAnswers.stage,
          profile,
          docText: attached.map((a) => `# ${a.fileName}\n${a.text}`).join("\n\n---\n\n"),
          bpFileName: attached.map((a) => a.fileName).join(", "),
          fromOnboarding: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(typeof d.error === "string" ? d.error : "Could not save your startup.");
      setDone(true);
      pushBot(["All set — your startup is ready. Taking you in…"]);
      router.push("/");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
      setMessages((m) => m.filter((x) => x.text !== "Setting up your startup…"));
    }
  }

  const busy = uploading || submitting || done;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-8 font-sans">
      <div className="flex h-[85vh] max-h-[760px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-brand bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-navy/10 px-5 py-3">
          <img src="/brand/logo.png" alt="Quorum" className="h-8 w-8 object-contain" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-navy">Quorum setup</span>
            <span className="text-xs text-navy/50">{adding ? "Add another startup" : "Let's build your startup profile"}</span>
          </div>
        </div>

        {/* Transcript */}
        <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          {messages.map((m, i) =>
            m.role === "bot" ? (
              <div key={i} className="flex items-end gap-2 self-start">
                <div className="h-7 w-7 shrink-0">
                  {m.avatar && <img src="/brand/logo.png" alt="" className="h-7 w-7 object-contain" />}
                </div>
                <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-[#F3F4F6] px-4 py-2.5 text-sm leading-relaxed text-black">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="max-w-[78%] self-end rounded-2xl rounded-br-sm bg-brand px-4 py-2.5 text-sm leading-relaxed text-black">
                {m.text}
              </div>
            )
          )}
          {error && <p className="self-center text-xs text-brand-dark">{error}</p>}
        </div>

        {/* Composer */}
        {!done && (
          <div className="border-t border-navy/10 px-5 py-3">
            {/* File dropzone (only on the upload step) */}
            {step?.type === "files" && (
              <label className="mb-3 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-brand/40 bg-brand-tint/40 px-4 py-5 text-center text-sm text-navy/60 transition hover:border-brand hover:bg-brand-tint">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.markdown"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => e.target.files?.length && attachFiles(e.target.files)}
                />
                <span className="text-lg">⬆️</span>
                <span>{uploading ? "Reading files…" : "Click to upload or drag & drop"}</span>
                <span className="text-xs text-navy/40">PDF · DOCX · TXT · MD — you can add several</span>
              </label>
            )}

            {/* Attached file chips */}
            {step?.type === "files" && attached.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attached.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-black">
                    📄 {a.fileName}
                    <button onClick={() => removeAttached(i)} className="text-black/60 hover:text-black" aria-label="Remove file">✕</button>
                  </span>
                ))}
              </div>
            )}

            {/* Input row */}
            {step?.type === "stage" ? (
              <div className="flex flex-wrap gap-2">
                {STAGES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => pickStage(s.value, s.label)}
                    className="rounded-lg border border-brand bg-white px-4 py-2 text-sm font-medium text-brand transition hover:bg-brand hover:text-white"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : step?.type === "files" ? (
              <button
                onClick={sendFiles}
                disabled={attached.length === 0 || uploading}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
              >
                Send
              </button>
            ) : (
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendText();
                    }
                  }}
                  rows={1}
                  placeholder="Type your answer…"
                  disabled={busy}
                  className="max-h-32 flex-1 resize-none rounded-xl border border-navy/15 bg-white px-4 py-2.5 text-sm text-navy outline-none placeholder:text-navy/40 focus:border-brand"
                />
                <button
                  onClick={sendText}
                  disabled={!draft.trim() || busy}
                  className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            )}

            {/* Skip link for optional questions */}
            {step?.optional && (
              <button
                onClick={skip}
                disabled={busy}
                className="mt-2 text-xs text-navy/50 underline underline-offset-2 transition hover:text-brand disabled:opacity-40"
              >
                Skip, add later
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

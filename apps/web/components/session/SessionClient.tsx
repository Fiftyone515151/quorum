"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BoardFounderForm, BoardPanel, ICPanel, ScreeningPanel, TeaPanel } from "./ResultPanels";

type TurnView = {
  id: string; actor: string; actorName: string; avatar?: string; segment: string;
  content?: string; fields?: any; thinking?: boolean; turnOrder?: number;
};
type RoundView = { code: string; label: string; turns: TurnView[]; notices: string[] };

interface RunData {
  id: string; mode: string; status: string; stage: string; createdAt: string; updatedAt: string;
  companySnapshot: {
    name: string; stage: string; topic?: string; valuation?: string; roundSize?: string;
    profile?: Record<string, string>; documentNames?: string[];
  };
  roles: { persona: { id: string; name: string; avatar?: string } }[];
  result: any;
}
interface ThreadRun { id: string; mode: string; status: string; createdAt: string; result: any; parentRunId: string | null }

const MODE_LABEL: Record<string, string> = {
  screening: "Screening", ic: "Investment Committee", board: "Board", tea: "Founder Tea",
};
const MODE_ICON: Record<string, string> = { screening: "🎯", ic: "⚖️", board: "🛠️", tea: "🍵" };
const STAGE_LABEL: Record<string, string> = { pre_seed: "Pre-seed", angel: "Angel", seed: "Seed", A: "Series A" };
const INTERACTIVE = new Set(["board", "tea"]);

function upsertRound(rounds: RoundView[], code: string, label?: string): RoundView[] {
  const found = rounds.find((round) => round.code === code);
  if (found) return rounds.map((round) => round.code === code ? { ...round, label: label ?? round.label } : round);
  return [...rounds, { code, label: label ?? code, turns: [], notices: [] }];
}

function addOrReplaceTurn(rounds: RoundView[], turn: TurnView): RoundView[] {
  const prepared = upsertRound(rounds, turn.segment);
  return prepared.map((round) => {
    if (round.code !== turn.segment) return round;
    const exists = round.turns.some((item) => item.id === turn.id);
    const turns = exists ? round.turns.map((item) => item.id === turn.id ? { ...item, ...turn } : item) : [...round.turns, turn];
    return { ...round, turns: turns.slice().sort((a, b) => (a.turnOrder ?? Number.MAX_SAFE_INTEGER) - (b.turnOrder ?? Number.MAX_SAFE_INTEGER)) };
  });
}

function replayRounds(rows: any[]): { rounds: RoundView[]; result: any; status?: string; awaitFounder?: any } {
  let rounds: RoundView[] = [];
  let result: any = null;
  let status: string | undefined;
  let awaitFounder: any = null;
  let current = "S1";
  for (const row of rows) {
    const event = row.payload ?? row;
    if (event.type === "segment") {
      current = event.segment;
      rounds = upsertRound(rounds, event.segment, event.label);
    } else if (event.type === "turn.completed") {
      rounds = addOrReplaceTurn(rounds, {
        id: event.id, actor: event.actor, actorName: event.actorName ?? event.actor,
        avatar: event.avatar, segment: event.segment ?? current, content: event.content,
        fields: event.fields, thinking: false, turnOrder: event.turnOrder,
      });
    } else if (event.type === "notice") {
      rounds = upsertRound(rounds, current).map((round) => round.code === current ? { ...round, notices: [...round.notices, event.text] } : round);
    } else if (event.type === "result") result = event.payload;
    else if (event.type === "status") status = event.status;
    else if (event.type === "await_founder") awaitFounder = { kind: event.kind, ...(event.payload ?? {}) };
  }
  return { rounds, result, status, awaitFounder };
}

function Pixel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`font-pixel leading-[1.7] text-brand ${className}`}>{children}</span>;
}

function ThinkingDots() {
  return (
    <span className="flex h-5 items-center gap-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: `${i * 140}ms` }} />)}
    </span>
  );
}

function TurnBubble({ turn }: { turn: TurnView }) {
  const host = turn.actor === "host";
  const founder = turn.actor === "founder";
  const orange = host || founder;
  return (
    <div className={`flex gap-3 ${founder ? "justify-end" : "justify-start"}`}>
      {!founder && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand/30 bg-white text-xl shadow-sm">{turn.avatar ?? (host ? "🎙️" : "🧠")}</div>}
      <div className={`flex max-w-[82%] flex-col ${founder ? "items-end" : "items-start"}`}>
        <div className="mb-1 flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs font-semibold text-navy/65">{turn.actorName}</span>
          {turn.fields?.role && <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">{turn.fields.role}</span>}
          {turn.fields?.is_fatal && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">FATAL</span>}
        </div>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${orange ? "bg-brand text-white" : "border border-brand bg-white text-navy/80"}`}>
          {turn.thinking ? <ThinkingDots /> : <p className="whitespace-pre-wrap">{turn.content}</p>}
        </div>
      </div>
      {founder && <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xl">{turn.avatar ?? "🙋"}</div>}
    </div>
  );
}

function InterjectionComposer({
  open, busy, onOpen, onCancel, onSend,
}: { open: boolean; busy: boolean; onOpen: () => void; onCancel: () => void; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  if (!open) return (
    <div className="mt-3 flex justify-center">
      <button onClick={onOpen} className="rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white">Speak</button>
    </div>
  );
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <button onClick={onCancel} disabled={busy} className="shrink-0 rounded-lg bg-navy/10 px-4 py-2.5 text-sm font-semibold text-navy/60 hover:bg-navy/15 disabled:opacity-40">
        Back to conversation
      </button>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus maxLength={4000}
        placeholder="Add context or join the discussion…"
        className="min-h-11 flex-1 resize-y rounded-lg border border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none placeholder:text-navy/35 focus:border-brand" />
      <button onClick={() => {
        const message = text.trim();
        if (!message) return;
        setText("");
        onSend(message);
      }} disabled={busy || !text.trim()}
        className="shrink-0 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-40">
        {busy ? "Sending…" : "Send"}
      </button>
    </div>
  );
}

function RoundCard({ round, active, canSpeak, composerOpen, composerBusy, onSpeak, onCancel, onSend }: {
  round: RoundView; active: boolean; canSpeak: boolean; composerOpen: boolean; composerBusy: boolean;
  onSpeak: () => void; onCancel: () => void; onSend: (text: string) => void;
}) {
  if (round.turns.length === 0) {
    return (
      <div className="flex items-center justify-center gap-3 py-2 text-center">
        <span className="h-px w-8 bg-brand/40" />
        <Pixel className="text-[10px] sm:text-xs">{round.label.toUpperCase()}</Pixel>
        {active && <ThinkingDots />}
        <span className="h-px w-8 bg-brand/40" />
      </div>
    );
  }
  return (
    <section className="relative mt-5 rounded-2xl border-2 border-brand bg-white px-4 pb-5 pt-7 sm:px-6">
      <h2 className="absolute -top-3 left-5 bg-white px-2"><Pixel className="text-[10px] sm:text-xs">{round.label.toUpperCase()}</Pixel></h2>
      <div className="flex flex-col gap-5">
        {round.turns.map((turn) => <TurnBubble key={turn.id} turn={turn} />)}
        {round.notices.map((notice, i) => <p key={i} className="text-center text-xs text-navy/45">{notice}</p>)}
      </div>
      {canSpeak && (
        <InterjectionComposer open={composerOpen} busy={composerBusy} onOpen={onSpeak} onCancel={onCancel} onSend={onSend} />
      )}
    </section>
  );
}

function ExportMenu({ runId }: { runId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className="rounded-lg border border-brand bg-white px-3 py-2 text-xs font-semibold text-brand transition hover:bg-brand-tint">
        Export PDF ▾
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded-xl border border-navy/10 bg-white py-1 shadow-lg">
          <a href={`/api/runs/${runId}/export?scope=result`} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-navy/70 hover:bg-brand-tint hover:text-brand">Result only</a>
          <a href={`/api/runs/${runId}/export?scope=full`} onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-navy/70 hover:bg-brand-tint hover:text-brand">Conversation + result</a>
        </div>
      )}
    </div>
  );
}

function ResultForMode({ mode, r }: { mode: string; r: any }) {
  if (!r) return null;
  return (
    <div className="mt-3 rounded-xl border border-brand/30 bg-white p-4">
      {mode === "screening" && <ScreeningPanel r={r} />}
      {mode === "ic" && <ICPanel r={r} />}
      {mode === "board" && <BoardPanel r={r} />}
      {mode === "tea" && <TeaPanel r={r} />}
    </div>
  );
}

// Frozen startup profile as the panel saw it at run time.
function ProfileSnapshot({ snap }: { snap: RunData["companySnapshot"] }) {
  const files = snap.documentNames?.length ? snap.documentNames.join(", ") : "—";
  const row = (label: string, value: string) => (
    <div className="flex gap-3"><dt className="w-16 shrink-0 font-semibold text-navy/55">{label}</dt><dd className="min-w-0 break-words text-navy/90">{value}</dd></div>
  );
  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl border border-brand/60 p-5">
      <dl className="flex flex-col gap-2 text-sm">
        {row("Name", snap.name)}
        {row("Stage", STAGE_LABEL[snap.stage] ?? snap.stage)}
        {row("Topic", snap.topic || "—")}
        {row("Files", files)}
      </dl>
    </div>
  );
}

// A collapsible earlier round in the same continuation thread.
function PriorRound({ runObj }: { runObj: ThreadRun }) {
  const [open, setOpen] = useState(false);
  const [rounds, setRounds] = useState<RoundView[] | null>(null);
  useEffect(() => {
    if (!open || rounds !== null) return;
    fetch(`/api/runs/${runObj.id}/events?after=0`).then((r) => r.json())
      .then((d) => setRounds(replayRounds(d.events ?? []).rounds)).catch(() => setRounds([]));
  }, [open, rounds, runObj.id]);
  const date = new Date(runObj.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  return (
    <section className="rounded-2xl border border-brand/40 bg-brand-tint/20">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <span className="text-brand">{open ? "▾" : "▸"}</span>
        <Pixel className="text-[10px] sm:text-xs">{MODE_LABEL[runObj.mode] ?? runObj.mode}</Pixel>
        <span className="text-xs text-navy/45">{date}</span>
        <span className="ml-auto text-xs font-medium text-navy/45">Previous round</span>
      </button>
      {open && (
        <div className="flex flex-col gap-5 px-4 pb-5">
          {rounds === null ? (
            <p className="text-sm text-navy/40">Loading…</p>
          ) : (
            rounds.map((round) => (
              <div key={round.code} className="flex flex-col gap-4 rounded-xl border border-brand/20 p-4">
                <Pixel className="text-[10px]">{round.label.toUpperCase()}</Pixel>
                {round.turns.map((turn) => <TurnBubble key={turn.id} turn={turn} />)}
              </div>
            ))
          )}
          <ResultForMode mode={runObj.mode} r={runObj.result} />
        </div>
      )}
    </section>
  );
}

export default function SessionClient({ id }: { id: string }) {
  const router = useRouter();
  const [run, setRun] = useState<RunData | null>(null);
  const [priorRuns, setPriorRuns] = useState<ThreadRun[]>([]);
  const [rounds, setRounds] = useState<RoundView[]>([]);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState("running");
  const [currentSegment, setCurrentSegment] = useState("S1");
  const [awaitFounder, setAwaitFounder] = useState<any>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerBusy, setComposerBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const currentSegmentRef = useRef("S1");
  const pendingResult = useRef<any>(null);

  const starts = useRef<TurnView[]>([]);
  const completions = useRef(new Map<string, TurnView>());
  const knownStarts = useRef(new Set<string>());
  const active = useRef<{ turn: TurnView; shownAt: number } | null>(null);
  const paused = useRef(false);
  const mode = useRef("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pump = useRef<() => void>(() => {});
  const finish = useRef<() => void>(() => {});

  const revealPendingResult = () => {
    if (active.current || starts.current.length > 0 || !pendingResult.current) return;
    setResult(pendingResult.current);
    pendingResult.current = null;
  };

  const delay = () => showAll ? 0 : INTERACTIVE.has(mode.current) ? 1600 : 850;
  const gap = () => showAll ? 0 : INTERACTIVE.has(mode.current) ? 800 : 450;

  finish.current = () => {
    if (paused.current || !active.current) return;
    const completed = completions.current.get(active.current.turn.id);
    if (!completed) return;
    const remaining = Math.max(0, delay() - (Date.now() - active.current.shownAt));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (paused.current || !active.current) return;
      const done = completions.current.get(active.current.turn.id);
      if (!done) return;
      setRounds((value) => addOrReplaceTurn(value, { ...done, thinking: false }));
      completions.current.delete(done.id);
      active.current = null;
      timer.current = setTimeout(() => {
        pump.current();
        revealPendingResult();
      }, gap());
    }, remaining);
  };

  pump.current = () => {
    if (paused.current || active.current) return;
    if (starts.current.length === 0) {
      revealPendingResult();
      return;
    }
    const turn = starts.current.shift()!;
    active.current = { turn, shownAt: Date.now() };
    setRounds((value) => addOrReplaceTurn(value, { ...turn, thinking: true, content: undefined }));
    finish.current();
  };

  function receiveStart(event: any) {
    if (knownStarts.current.has(event.id)) return;
    knownStarts.current.add(event.id);
    starts.current.push({
      id: event.id, actor: event.actor, actorName: event.actorName ?? event.actor, avatar: event.avatar,
      segment: event.segment, thinking: true, turnOrder: event.turnOrder,
    });
    pump.current();
  }

  function receiveCompleted(event: any) {
    const turn: TurnView = {
      id: event.id, actor: event.actor, actorName: event.actorName ?? event.actor, avatar: event.avatar,
      segment: event.segment, content: event.content, fields: event.fields, thinking: false, turnOrder: event.turnOrder,
    };
    completions.current.set(turn.id, turn);
    if (!knownStarts.current.has(turn.id)) receiveStart(turn);
    finish.current();
  }

  useEffect(() => {
    let closed = false;
    let source: EventSource | null = null;
    (async () => {
      const data = await fetch(`/api/runs/${id}`).then((response) => response.json()).catch(() => null);
      if (closed || !data?.run) return;
      setRun(data.run); mode.current = data.run.mode; setStatus(data.run.status); setResult(data.run.result ?? null);
      // Earlier rounds in this continuation thread (everything before this run).
      const thread: ThreadRun[] = data.threadRuns ?? [];
      const idx = thread.findIndex((r) => r.id === id);
      setPriorRuns(idx > 0 ? thread.slice(0, idx) : []);

      let maxSeq = 0;
      try {
        const replay = await fetch(`/api/runs/${id}/events?after=0`).then((response) => response.json());
        const rebuilt = replayRounds(replay.events ?? []);
        setRounds(rebuilt.rounds); setResult(rebuilt.result ?? data.run.result ?? null);
        if (rebuilt.status) setStatus(rebuilt.status);
        if (rebuilt.awaitFounder) setAwaitFounder(rebuilt.awaitFounder);
        const lastSegment = [...(replay.events ?? [])].reverse().find((row: any) => row.payload?.type === "segment")?.payload?.segment;
        if (lastSegment) { currentSegmentRef.current = lastSegment; setCurrentSegment(lastSegment); }
        for (const row of replay.events ?? []) if (row.seq > maxSeq) maxSeq = row.seq;
      } catch { /* keep run fallback */ }
      if (closed) return;

      source = new EventSource(`/api/runs/${id}/stream?after=${maxSeq}`);
      source.onmessage = (message) => {
        let event: any; try { event = JSON.parse(message.data); } catch { return; }
        if (event.type === "hello") return;
        if (event.type === "segment") {
          currentSegmentRef.current = event.segment;
          setCurrentSegment(event.segment);
          setRounds((value) => upsertRound(value, event.segment, event.label));
        } else if (event.type === "turn.start") receiveStart(event);
        else if (event.type === "turn.completed") receiveCompleted(event);
        else if (event.type === "notice") {
          const segment = currentSegmentRef.current;
          setRounds((value) => upsertRound(value, segment).map((round) => round.code === segment ? { ...round, notices: [...round.notices, event.text] } : round));
        } else if (event.type === "await_founder") setAwaitFounder({ kind: event.kind, ...(event.payload ?? {}) });
        else if (event.type === "result") {
          pendingResult.current = event.payload;
          revealPendingResult();
        }
        else if (event.type === "status") setStatus(event.status);
        else if (event.type === "run.failed") {
          if (active.current) {
            setRounds((value) => addOrReplaceTurn(value, { ...active.current!.turn, content: "Response unavailable.", thinking: false }));
            active.current = null;
          }
          starts.current = [];
          completions.current.clear();
          setNotice(event.error);
        }
        else if (event.type === "run.completed") source?.close();
      };
      source.onerror = () => {};
    })();
    return () => { closed = true; source?.close(); if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rounds, result]);

  useEffect(() => { if (showAll) { finish.current(); pump.current(); } }, [showAll]);

  async function pauseConversation() {
    setNotice(null); paused.current = true; setComposerOpen(true);
    const response = await fetch(`/api/runs/${id}/message`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "pause", segment: currentSegment }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      paused.current = false; setComposerOpen(false); setNotice(data.error ?? "Could not pause the conversation."); pump.current(); finish.current();
    }
  }

  async function resumeConversation() {
    setComposerBusy(true);
    const response = await fetch(`/api/runs/${id}/message`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "resume" }),
    });
    setComposerBusy(false);
    if (!response.ok) return setNotice("Could not resume the conversation.");
    setComposerOpen(false); paused.current = false; setStatus("running"); finish.current(); pump.current();
  }

  async function sendInterjection(content: string) {
    setComposerBusy(true); setNotice(null);
    const response = await fetch(`/api/runs/${id}/message`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "founder_interjection", content, segment: currentSegment, clientMessageId: crypto.randomUUID() }),
    });
    const data = await response.json().catch(() => ({}));
    setComposerBusy(false);
    if (!response.ok) return setNotice(data.error ?? "Could not send your message.");
    setComposerOpen(false); paused.current = false; setStatus("running"); finish.current(); pump.current();
  }

  async function sendBoardResponses(responses: any[]) {
    await fetch(`/api/runs/${id}/message`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "board_items", responses }),
    });
    setAwaitFounder(null);
  }

  async function deleteRun() {
    if (!confirm("Delete this session? You can restore it from Settings for 30 days.")) return;
    const response = await fetch(`/api/runs/${id}`, { method: "DELETE" });
    if (response.ok) router.push("/");
  }

  const canSpeak = !!run && INTERACTIVE.has(run.mode) && status === "running" && !result && awaitFounder?.kind !== "board_items";
  const date = run?.createdAt ? new Date(run.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "";

  return (
    <div className="min-h-screen bg-white font-sans text-navy">
      <header className="border-b border-navy/10">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-3">
          <Link href="/"><img src="/brand/lockup.png" alt="Quorum" className="h-9 w-auto sm:h-12" /></Link>
          <span className="ml-auto rounded-full bg-brand-tint px-3 py-1.5 text-xs font-semibold text-brand">
            {MODE_ICON[run?.mode ?? ""]} {MODE_LABEL[run?.mode ?? ""] ?? "Session"}
          </span>
          <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === "done" ? "bg-emerald-50 text-emerald-700" : status === "failed" ? "bg-red-50 text-red-600" : status === "awaiting_founder" ? "bg-amber-50 text-amber-700" : "bg-navy/5 text-navy/55"}`}>
            ● {status === "awaiting_founder" ? "Paused for founder" : status}
          </span>
          <Link href="/" aria-label="Exit" className="flex h-9 w-9 items-center justify-center rounded-lg text-navy/45 hover:bg-navy/5 hover:text-navy">→</Link>
        </div>
      </header>

      <main className="mx-auto flex w-[80%] max-w-6xl flex-col gap-8 py-8 max-md:w-full max-md:px-4">
        <div className="text-center">
          <h1><Pixel className="text-lg sm:text-2xl">{run?.companySnapshot?.name || "Convening the panel…"}</Pixel></h1>
          <p className="mt-2 text-sm text-navy/45">{STAGE_LABEL[run?.companySnapshot?.stage ?? ""] ?? run?.companySnapshot?.stage} {date && `· ${date}`}</p>
        </div>

        {run && <ProfileSnapshot snap={run.companySnapshot} />}

        {priorRuns.length > 0 && (
          <div className="flex flex-col gap-3">
            {priorRuns.map((r) => <PriorRound key={r.id} runObj={r} />)}
            <p className="text-center text-xs font-medium text-navy/40">↓ This round continues below</p>
          </div>
        )}

        {(starts.current.length > 0 || active.current) && (
          <button onClick={() => setShowAll(true)} disabled={showAll} className="self-end text-xs font-medium text-navy/40 underline underline-offset-2 hover:text-brand disabled:hidden">Show all</button>
        )}

        <div className="flex flex-col gap-7">
          {rounds.map((round) => (
            <RoundCard key={round.code} round={round} active={round.code === currentSegment && !result}
              canSpeak={canSpeak && round.code === currentSegment} composerOpen={composerOpen && round.code === currentSegment}
              composerBusy={composerBusy} onSpeak={pauseConversation} onCancel={resumeConversation} onSend={sendInterjection} />
          ))}
        </div>

        {notice && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{notice}</p>}

        {awaitFounder?.kind === "board_items" && status === "awaiting_founder" && (
          <BoardFounderForm payload={awaitFounder} onSubmit={sendBoardResponses} />
        )}

        {result && run && (
          <section className="relative mt-4 rounded-2xl border-2 border-brand bg-white px-5 pb-6 pt-8 sm:px-7">
            <div className="absolute -top-4 left-5 bg-white px-2"><Pixel className="text-sm sm:text-base">RESULT</Pixel></div>
            <div className="absolute right-4 top-4"><ExportMenu runId={id} /></div>
            <div className="mb-6 border-b border-navy/10 pb-4 pr-28">
              <p className="text-sm font-semibold text-navy">{MODE_LABEL[run.mode]}</p>
              <p className="mt-1 text-xs text-navy/45">{run.companySnapshot.name} · {date}</p>
            </div>
            {run.mode === "screening" && <ScreeningPanel r={result} />}
            {run.mode === "ic" && <ICPanel r={result} />}
            {run.mode === "board" && <BoardPanel r={result} />}
            {run.mode === "tea" && <TeaPanel r={result} />}
          </section>
        )}

        {(status === "done" || status === "failed") && run && (
          <div data-tour="session-end" className="flex flex-col gap-4 border-t border-navy/10 pt-5">
            {/* Not satisfied? Reconvene, building on this round. */}
            <button
              onClick={() => router.push(`/new?mode=${run.mode}&from=${id}`)}
              className="self-start rounded-lg border-2 border-brand px-5 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand hover:text-white"
            >
              Not satisfied with the result? Discuss again →
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-emerald-600">✓ Result saved</span>
              <button onClick={deleteRun} className="ml-auto rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Delete session</button>
              <Link href="/" className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Save &amp; back to home</Link>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>
    </div>
  );
}

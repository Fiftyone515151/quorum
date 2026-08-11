"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

// ── Guided tours ─────────────────────────────────────────────────────────────
// A lightweight spotlight walkthrough. Two flows share the engine: "main"
// (first run after onboarding, the full product loop) and "demo" (the public
// landing-page demo — quick homepage orientation, then a real IC session).
// Progress lives in localStorage as "<flow>:<stepId>" so it survives the
// multi-page journey. Pages opt elements in with `data-tour="…"` attributes;
// this overlay finds them, dims everything else, and either waits for a
// "Next" click or for the user to click through to the next page.

const KEY = "quorum_tour";
// The demo run the visitor just watched, so the wrap-up dialog can link back to it.
const RUN_KEY = "quorum_tour_run";

interface TourStep {
  id: string;
  match: (path: string) => boolean;
  target: string; // data-tour value ("" for modal steps)
  title: string;
  body: string;
  /** true → no Next button; the step completes when the user clicks the
   *  highlighted control and navigation lands on the next step's page. */
  clickThrough?: boolean;
  /** true → centered dialog instead of a spotlight (demo wrap-up). */
  modal?: boolean;
}

const home = (p: string) => p === "/";
const profile = (p: string) => p.startsWith("/profile");
const newSession = (p: string) => p.startsWith("/new");
const session = (p: string) => p.startsWith("/session/");

const MAIN_STEPS: TourStep[] = [
  {
    id: "profile-panel", match: home, target: "profile-panel",
    title: "Your Startup Profile",
    body: "Everything about your startup lives in this panel — name, stage, one-liner and your documents. Every panel of investors reads from it before a meeting.",
  },
  {
    id: "profile-edit-link", match: home, target: "profile-edit-link", clickThrough: true,
    title: "Edit your info",
    body: "Need to change or add details? This link opens the full profile editor.",
  },
  {
    id: "profile-fields", match: profile, target: "profile-fields",
    title: "Edit any field",
    body: "Click the pencil next to a field to edit it. The fuller your profile, the sharper the panel's feedback.",
  },
  {
    id: "profile-save", match: profile, target: "profile-save",
    title: "Save your changes",
    body: "Done editing? Hit Save so the panel sees your latest info.",
  },
  {
    id: "profile-back", match: profile, target: "profile-back", clickThrough: true,
    title: "Head back home",
    body: "That's the profile page — you can come back anytime.",
  },
  {
    id: "mode-screening", match: home, target: "mode-screening",
    title: "Screening 🎯",
    body: "Meet the four meeting modes. Screening is fast triage — hear the single biggest reason an investor would say no.",
  },
  {
    id: "mode-ic", match: home, target: "mode-ic",
    title: "Investment Committee ⚖️",
    body: "An adversarial panel debates your startup and delivers a clear invest / pass verdict.",
  },
  {
    id: "mode-board", match: home, target: "mode-board",
    title: "Board 🛠️",
    body: "A post-investment board meeting that ends with a prioritized to-do list for your company.",
  },
  {
    id: "mode-tea", match: home, target: "mode-tea",
    title: "Founder Tea 🍵",
    body: "A casual, open-ended discussion — no verdicts, just divergent perspectives.",
  },
  {
    id: "go-ic", match: home, target: "mode-ic", clickThrough: true,
    title: "Try it now",
    body: "Let's run an Investment Committee on your startup.",
  },
  {
    id: "new-profile", match: newSession, target: "new-profile",
    title: "Check your startup info",
    body: "The panel will see exactly this. You can still tweak it via “Edit Startup info” before you begin.",
  },
  {
    id: "new-personas", match: newSession, target: "new-personas",
    title: "Pick your panel",
    body: "Choose 4–6 investors from the Persona Library and the Star Investors. Tap a card to add or remove someone.",
  },
  {
    id: "new-start", match: newSession, target: "new-start", clickThrough: true,
    title: "Convene!",
    body: "Happy with your picks? Start the meeting and watch the discussion unfold — see you at the end!",
  },
  {
    id: "session-review", match: session, target: "session-restart",
    title: "Meeting adjourned",
    body: "Take your time with the verdict above. Not satisfied with how it went? This button reconvenes the panel for another round, building on this one.",
  },
  {
    id: "session-save", match: session, target: "session-save-exit", clickThrough: true,
    title: "Save & head home",
    body: "Done reviewing? Your result is already saved — click here to head back home.",
  },
  {
    id: "history", match: home, target: "history",
    title: "Your meeting history",
    body: "Every meeting is saved here — click any card to revisit the full discussion and result. That's the tour. Enjoy! 🎉",
  },
];

// The landing-page demo flow: orient on the home page fast, then run a real
// Investment Committee session on the pre-loaded demo startup (Relay).
const DEMO_STEPS: TourStep[] = [
  {
    id: "demo-welcome", match: home, target: "profile-panel",
    title: "Welcome to the demo! 👋",
    body: "You're signed in as the founder of Relay, an AI customer-support startup we prepared for you. This panel is the startup profile — everything the investor panel reads lives here.",
  },
  {
    id: "demo-modes", match: home, target: "modes",
    title: "Four kinds of meetings",
    body: "🎯 Screening — fast triage. ⚖️ Investment Committee — an adversarial invest / pass verdict. 🛠️ Board — post-investment priorities. 🍵 Founder Tea — open discussion.",
  },
  {
    id: "demo-history", match: home, target: "history",
    title: "Meeting history",
    body: "Every meeting you run is saved here, ready to revisit.",
  },
  {
    id: "demo-go-ic", match: home, target: "mode-ic", clickThrough: true,
    title: "Let's run one for real",
    body: "Click Investment Committee — you're about to convene a live AI panel on Relay.",
  },
  {
    id: "demo-personas", match: newSession, target: "new-personas",
    title: "Pick your investors",
    body: "Choose any 4–6 investors — your picks are real and shape the debate. Mix seats from the Persona Library with the Star Investors.",
  },
  {
    id: "demo-start", match: newSession, target: "new-start", clickThrough: true,
    title: "Convene the panel",
    body: "Ready? Click below and watch a real session unfold live — the debate takes a few minutes.",
  },
  {
    id: "demo-review", match: session, target: "session-restart",
    title: "Meeting adjourned",
    body: "That verdict was generated live — take your time reading it. When you're done: this button reconvenes the panel for another round, building on this one.",
  },
  {
    id: "demo-save", match: session, target: "session-save-exit", clickThrough: true,
    title: "Save & head home",
    body: "Your result is saved automatically — click here to head back home.",
  },
  {
    id: "demo-finish", match: home, target: "", modal: true,
    title: "That's the live demo! 🎉",
    body: "You just pitched a real AI investor panel on a sample startup. Sign up (free) to pressure-test your own idea with every meeting mode.",
  },
];

const FLOWS: Record<string, TourStep[]> = { main: MAIN_STEPS, demo: DEMO_STEPS };

/** Arm the first-run tour so it starts on the next page load (call before router.push("/")). */
export function startTour() {
  try { localStorage.setItem(KEY, `main:${MAIN_STEPS[0].id}`); } catch { /* private mode */ }
}

/** Arm the landing-page demo tour (call before entering the app as a demo user). */
export function startDemoTour() {
  try { localStorage.setItem(KEY, `demo:${DEMO_STEPS[0].id}`); } catch { /* private mode */ }
}

/** Parse a stored "<flow>:<stepId>" value; bare ids are legacy main-flow state. */
function parseStored(v: string): { flow: string; steps: TourStep[]; idx: number } | null {
  const [flow, id] = v.includes(":") ? (v.split(":", 2) as [string, string]) : ["main", v];
  const steps = FLOWS[flow];
  if (!steps) return null;
  const idx = steps.findIndex((s) => s.id === id);
  return idx >= 0 ? { flow, steps, idx } : null;
}

const PAD = 8;        // spotlight padding around the target
const CARD_W = 320;   // tooltip width (w-80)
const CARD_EST = 200; // rough tooltip height for placement
const GAP = 14;       // spotlight → tooltip gap

interface Box { top: number; left: number; width: number; height: number }

interface Pos { flow: string; idx: number }

export default function GuidedTour() {
  const pathname = usePathname();
  const [pos, setPos] = useState<Pos | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const scrolledFor = useRef<string | null>(null);

  const setStep = useCallback((flow: string, i: number | null) => {
    setBox(null);
    const steps = FLOWS[flow];
    if (i === null || !steps || i >= steps.length) {
      setPos(null);
      try { localStorage.removeItem(KEY); localStorage.removeItem(RUN_KEY); } catch { /* ignore */ }
    } else {
      setPos({ flow, idx: i });
      try { localStorage.setItem(KEY, `${flow}:${steps[i].id}`); } catch { /* ignore */ }
    }
  }, []);

  // Sync with localStorage on every navigation. This both resumes the tour on
  // load and advances click-through steps: when the current step's page no
  // longer matches but the next step's does, the user just clicked through.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
    const p = saved ? parseStored(saved) : null;
    if (!p) { setPos(null); return; }
    // Remember which session the demo visitor ran, for the wrap-up dialog.
    if (p.flow === "demo") {
      const m = pathname.match(/^\/session\/([^/]+)/);
      if (m) try { localStorage.setItem(RUN_KEY, m[1]); } catch { /* ignore */ }
    }
    if (!p.steps[p.idx].match(pathname) && p.steps[p.idx + 1]?.match(pathname)) setStep(p.flow, p.idx + 1);
    else setPos({ flow: p.flow, idx: p.idx });
  }, [pathname, setStep]);

  // Track the target's viewport box. Polling keeps the spotlight glued through
  // scrolling, layout shifts, and late-appearing targets (the session-end block
  // only renders once the run finishes).
  useEffect(() => {
    if (pos === null) return;
    const step = FLOWS[pos.flow][pos.idx];
    if (step.modal || !step.match(pathname)) { setBox(null); return; }

    const measure = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) { setBox(null); return; }
      if (scrolledFor.current !== step.id) {
        scrolledFor.current = step.id;
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      const r = el.getBoundingClientRect();
      setBox((prev) =>
        prev && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      );
    };
    measure();
    const timer = setInterval(measure, 150);
    window.addEventListener("resize", measure);
    return () => { clearInterval(timer); window.removeEventListener("resize", measure); };
  }, [pos, pathname]);

  if (pos === null) return null;
  const steps = FLOWS[pos.flow];
  const step = steps[pos.idx];

  if (step.modal) {
    if (!step.match(pathname)) return null;
    return <FinishModal title={step.title} body={step.body} onClose={() => setStep(pos.flow, null)} />;
  }
  if (!box) return null;

  const spot: React.CSSProperties = {
    top: box.top - PAD,
    left: box.left - PAD,
    width: box.width + PAD * 2,
    height: box.height + PAD * 2,
  };

  // Tooltip: below the spotlight if it fits, else above, else pinned to the
  // bottom of the viewport (for targets taller than the screen).
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(box.left + box.width / 2 - CARD_W / 2, 12), Math.max(12, vw - CARD_W - 12));
  const card: React.CSSProperties =
    vh - (box.top + box.height) - PAD >= CARD_EST + GAP
      ? { top: box.top + box.height + PAD + GAP, left }
      : box.top - PAD >= CARD_EST + GAP
        ? { bottom: vh - box.top + PAD + GAP, left }
        : { bottom: 24, left };

  return (
    <>
      {/* Dimmer with a punched-out hole; pointer-events-none so the page —
          including the highlighted control — stays clickable. */}
      <div className="pointer-events-none fixed z-[70] rounded-xl" style={{ ...spot, boxShadow: "0 0 0 9999px rgba(38, 34, 97, 0.55)" }} />
      <div className="pointer-events-none fixed z-[70] animate-pulse rounded-xl ring-4 ring-brand" style={spot} />

      <div className="fixed z-[80] w-80 rounded-2xl border-2 border-brand bg-white p-5 shadow-2xl" style={card}>
        <p className="font-pixel text-[9px] leading-[1.7] text-brand">Tour · {pos.idx + 1} / {steps.length}</p>
        <p className="mt-2 text-base font-bold text-navy">{step.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-navy/75">{step.body}</p>
        {step.clickThrough && (
          <p className="mt-3 text-xs font-semibold text-brand">👆 Click the highlighted button to continue</p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setStep(pos.flow, null)} className="text-xs font-medium text-navy/40 underline underline-offset-2 transition hover:text-navy/70">
            Skip tour
          </button>
          {!step.clickThrough && (
            <button onClick={() => setStep(pos.flow, pos.idx + 1)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
              {pos.idx === steps.length - 1 ? "Finish" : "Next"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// Demo wrap-up: a centered dialog back on the home page. Offers a hop back to
// the session the visitor just ran, or a clean exit (sign out → landing page).
function FinishModal({ title, body, onClose }: { title: string; body: string; onClose: () => void }) {
  const router = useRouter();
  const [runId] = useState<string | null>(() => {
    try { return localStorage.getItem(RUN_KEY); } catch { return null; }
  });

  function reviewSession() {
    const id = runId;
    onClose(); // clears tour state (incl. the stored run id)
    if (id) router.push(`/session/${id}`);
  }
  async function backToLanding() {
    onClose();
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/"); // full reload so the server renders the signed-out landing
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-navy/55 px-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-brand bg-white p-7 shadow-2xl">
        <p className="text-center font-pixel text-[9px] leading-[1.7] text-brand">LIVE DEMO COMPLETE</p>
        <p className="mt-3 text-center text-lg font-bold text-navy">{title}</p>
        <p className="mt-2 text-center text-sm leading-relaxed text-navy/75">{body}</p>
        <div className="mt-6 flex flex-col gap-3">
          {runId && (
            <button onClick={reviewSession}
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark">
              Review my session →
            </button>
          )}
          <button onClick={backToLanding}
            className="rounded-lg border-2 border-brand px-5 py-2 text-sm font-semibold text-brand transition hover:bg-brand-tint">
            Back to the landing page
          </button>
        </div>
      </div>
    </div>
  );
}

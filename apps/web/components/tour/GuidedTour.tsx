"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

// ── First-run guided tour ────────────────────────────────────────────────────
// A lightweight spotlight walkthrough shown once, right after a user finishes
// onboarding. Progress lives in localStorage so it survives the multi-page
// journey (home → profile → home → new session → live session → home). Pages
// opt elements in with `data-tour="…"` attributes; this overlay finds them,
// dims everything else, and either waits for a "Next" click or for the user
// to click through to the next page.

const KEY = "quorum_tour";

interface TourStep {
  id: string;
  match: (path: string) => boolean;
  target: string; // data-tour value
  title: string;
  body: string;
  /** true → no Next button; the step completes when the user clicks the
   *  highlighted control and navigation lands on the next step's page. */
  clickThrough?: boolean;
}

const home = (p: string) => p === "/";
const profile = (p: string) => p.startsWith("/profile");
const newSession = (p: string) => p.startsWith("/new");
const session = (p: string) => p.startsWith("/session/");

const STEPS: TourStep[] = [
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
    id: "session-end", match: session, target: "session-end", clickThrough: true,
    title: "Meeting adjourned",
    body: "Not satisfied? “Discuss again” reconvenes the panel, building on this round. Your result is already saved — click “Save & back to home” to wrap up.",
  },
  {
    id: "history", match: home, target: "history",
    title: "Your meeting history",
    body: "Every meeting is saved here — click any card to revisit the full discussion and result. That's the tour. Enjoy! 🎉",
  },
];

/** Arm the tour so it starts on the next page load (call before router.push("/")). */
export function startTour() {
  try { localStorage.setItem(KEY, STEPS[0].id); } catch { /* private mode */ }
}

const PAD = 8;        // spotlight padding around the target
const CARD_W = 320;   // tooltip width (w-80)
const CARD_EST = 200; // rough tooltip height for placement
const GAP = 14;       // spotlight → tooltip gap

interface Box { top: number; left: number; width: number; height: number }

export default function GuidedTour() {
  const pathname = usePathname();
  const [idx, setIdx] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const scrolledFor = useRef<string | null>(null);

  const setStep = useCallback((i: number | null) => {
    setBox(null);
    if (i === null || i >= STEPS.length) {
      setIdx(null);
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    } else {
      setIdx(i);
      try { localStorage.setItem(KEY, STEPS[i].id); } catch { /* ignore */ }
    }
  }, []);

  // Sync with localStorage on every navigation. This both resumes the tour on
  // load and advances click-through steps: when the current step's page no
  // longer matches but the next step's does, the user just clicked through.
  useEffect(() => {
    let saved: string | null = null;
    try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
    const i = saved ? STEPS.findIndex((s) => s.id === saved) : -1;
    if (i < 0) { setIdx(null); return; }
    if (!STEPS[i].match(pathname) && STEPS[i + 1]?.match(pathname)) setStep(i + 1);
    else setIdx(i);
  }, [pathname, setStep]);

  // Track the target's viewport box. Polling keeps the spotlight glued through
  // scrolling, layout shifts, and late-appearing targets (the session-end block
  // only renders once the run finishes).
  useEffect(() => {
    if (idx === null) return;
    const step = STEPS[idx];
    if (!step.match(pathname)) { setBox(null); return; }

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
  }, [idx, pathname]);

  if (idx === null || !box) return null;
  const step = STEPS[idx];

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
        <p className="font-pixel text-[9px] leading-[1.7] text-brand">Tour · {idx + 1} / {STEPS.length}</p>
        <p className="mt-2 text-base font-bold text-navy">{step.title}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-navy/75">{step.body}</p>
        {step.clickThrough && (
          <p className="mt-3 text-xs font-semibold text-brand">👆 Click the highlighted button to continue</p>
        )}
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => setStep(null)} className="text-xs font-medium text-navy/40 underline underline-offset-2 transition hover:text-navy/70">
            Skip tour
          </button>
          {!step.clickThrough && (
            <button onClick={() => setStep(idx + 1)}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-dark">
              {idx === STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

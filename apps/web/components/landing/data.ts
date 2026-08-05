// Copy + content for the public landing page. English only.

export const HERO = {
  question: "READY FOR THE PANEL?",
  tagline: "Set up your startup in a minute.",
  intro: "Quorum convenes a panel of AI investors to pressure-test your startup — before the real ones do.",
  secondPerson: "See how a VC panel would judge your startup — and what to fix first.",
};

export interface ModeInfo {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  happens: string[]; // "How it works" bullets
  get: string[]; // "What you get" bullets
}

export const MODES: ModeInfo[] = [
  {
    id: "screening",
    name: "Screening",
    emoji: "🎯",
    blurb: "Fast triage — the reason you'd get a no.",
    happens: [
      "Each investor scores only the dimensions they own",
      "Independently first — no groupthink",
      "Then they clash on the biggest disagreements",
    ],
    get: [
      "ADVANCE / WATCH / PASS",
      "A per-dimension scorecard",
      "The crux question you must answer",
      "The coverage gaps to fill",
    ],
  },
  {
    id: "ic",
    name: "Investment Committee",
    emoji: "⚖️",
    blurb: "An adversarial invest / pass verdict.",
    happens: [
      "A champion makes the case to invest",
      "Dissenters attack it head-on",
      "No voting, no averaging",
      "One fatal concern can kill the deal",
    ],
    get: [
      "INVEST / CONDITIONAL / PASS",
      "The deciding crux",
      "The strongest dissent",
      "Any conditions to clear",
    ],
  },
  {
    id: "board",
    name: "Board",
    emoji: "🛠️",
    blurb: "A post-investment priority list.",
    happens: [
      "Assumes you're already funded",
      "Surfaces how startups like yours fail",
      "Across every risk axis",
      "You respond to each item",
    ],
    get: [
      "A prioritized action list",
      "Severity × your response",
      "A risk-coverage snapshot",
      "The remaining gaps",
    ],
  },
  {
    id: "tea",
    name: "Founder Tea",
    emoji: "🍵",
    blurb: "Open, divergent discussion.",
    happens: [
      "No fixed agenda",
      "Investors riff off each other",
      "Clues, never conclusions",
      "Surfaces angles you missed",
    ],
    get: [
      "A map of themes",
      "Surprising angles",
      "Open questions",
      "Unresolved disagreements",
    ],
  },
];

// Two-layer persona architecture: every investor = a functional seat × a character.
export const LAYERS = [
  {
    title: "Functional seat",
    body: "What they own — market, product, team, growth, capital, or risk. Each seat scores only its part of the deal.",
  },
  {
    title: "Character",
    body: "How they think — worldview, temperament, and a signature move, so a growth optimist and a disciplined underwriter never sound alike.",
  },
];

// The signature decision principle (deterministic logic, not vibes).
export const PRINCIPLE = {
  head: "No voting. No averaging.",
  body: "One champion's conviction can carry a deal; one hard concern can kill it — Quorum reproduces how an investment committee actually decides, instead of blending everyone into one bland answer.",
};

// How a session runs today (honest to the current harness — refine later).
export const HOW_IT_WORKS = [
  { step: "1", title: "Assemble", body: "Pick a panel of investor personas spanning market, product, team, growth, capital, and risk." },
  { step: "2", title: "Deliberate", body: "They score, clash, and challenge your startup — independently, then against each other. No averaging." },
  { step: "3", title: "Decide", body: "Deterministic VC logic turns the debate into a verdict, a crux, and next steps you can act on." },
];

// Curated positive excerpts from Quorum_User_Feedback_Appendix_EN.md
// ("Most Useful Insight" sections only), anonymized by role.
export const TESTIMONIALS = [
  {
    role: "Technical founder",
    initials: "TF",
    quote:
      "It customizes different types of investors and has them challenge the startup from market, product, team, growth, business model, and risk — quickly surfacing issues founders overlook. The roles even disagree with one another, which helps you find the questions that truly influence an investment decision.",
  },
  {
    role: "Early-stage founder",
    initials: "EF",
    quote:
      "The most valuable insight is seeing how a real VC team debates a project from multiple conflicting perspectives. Unlike regular AI that gives one-sided suggestions, its multi-agent simulation reproduces investment-committee arguments — I can anticipate the tough questions before I meet actual VCs.",
  },
  {
    role: "Fundraising lead",
    initials: "FL",
    quote:
      "The ‘no voting, no averaging’ principle feels especially accurate. One champion's conviction can carry a deal; one hard concern can kill it. Quorum presents structured disagreement rather than averaged consensus — a valuable correction to how founders think VCs decide.",
  },
];

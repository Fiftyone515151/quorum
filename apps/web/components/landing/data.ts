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
  summary: string;
  output: string;
}

export const MODES: ModeInfo[] = [
  {
    id: "screening",
    name: "Screening",
    emoji: "🎯",
    blurb: "Fast triage — the reason you'd get a no.",
    summary:
      "A rapid first pass where each investor independently scores only the dimensions they own, then clashes on the biggest disagreements.",
    output: "ADVANCE / WATCH / PASS, a dimension scorecard, the crux question you must answer, and coverage gaps.",
  },
  {
    id: "ic",
    name: "Investment Committee",
    emoji: "⚖️",
    blurb: "An adversarial invest / pass verdict.",
    summary:
      "A champion argues to invest while dissenters attack the case. No voting, no averaging — one fatal concern can kill the deal.",
    output: "INVEST / CONDITIONAL / PASS with the rationale, the deciding crux, the dissent, and any conditions.",
  },
  {
    id: "board",
    name: "Board",
    emoji: "🛠️",
    blurb: "A post-investment priority list.",
    summary:
      "Assumes you're funded: the board surfaces the ways startups like yours fail across every risk axis, and you respond to each item.",
    output: "A prioritized action list (severity × your response), plus a risk-coverage snapshot and gaps.",
  },
  {
    id: "tea",
    name: "Founder Tea",
    emoji: "🍵",
    blurb: "Open, divergent discussion.",
    summary:
      "No fixed agenda — investors riff off each other and offer clues, never conclusions, to surface angles you hadn't considered.",
    output: "A map of themes, surprising angles, open questions, and unresolved disagreements.",
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

import type { CompanyInput, Mode, ResolvedPersona } from "../types.js";
import { DIMENSION_LABELS, RISK_AXIS_LABELS } from "../vc/dimensions.js";

/** Reply-language rule, detected from the company's own text. Explicit + forceful. */
export function languageDirective(company: CompanyInput): string {
  const sample = `${company.name} ${company.bp} ${company.topic ?? ""}`.slice(0, 3000);
  let lang = "English";
  if (/[一-鿿]/.test(sample)) lang = "Simplified Chinese (简体中文)";
  else if (/[぀-ヿ]/.test(sample)) lang = "Japanese (日本語)";
  else if (/[가-힯]/.test(sample)) lang = "Korean (한국어)";
  return `LANGUAGE (critical, overrides everything): Write your ENTIRE natural-language reply in ${lang}. Do not use any other language for prose. Keep JSON keys in English; put values in ${lang}.`;
}

const MODE_CONTEXT: Record<Mode, string> = {
  screening: "This is a SCREENING meeting: fast triage to find the reason to say no. Score ONLY the dimensions you own, independently (back-to-back — do not converge with others).",
  ic: "This is an INVESTMENT COMMITTEE: careful, adversarial, everyone owns the final call. Produce invest/pass — not another scoring pass.",
  board: "This is a BOARD meeting: assume the company is funded; help the founder see how investors will scrutinize them. Raise improvement items only within your risk axes.",
  tea: "This is FOUNDER TEA: no fixed goal, divergent, riff off each other. Offer clues only, never a conclusion.",
};

const MODE_NAME: Record<Mode, string> = {
  screening: "Screening", ic: "Investment Committee", board: "Board", tea: "Founder Tea",
};

/** compose_system_prompt(persona, mode) — Persona Spec §7.2. */
export function composeSystemPrompt(
  persona: ResolvedPersona,
  mode: Mode,
  company: CompanyInput,
  priorRound?: { mode: Mode; result: unknown }
): string {
  const { seat, skin } = persona;
  const methodology = skin.methodology ?? seat.methodology;
  const blindSpots = skin.blind_spots ?? seat.blind_spots;
  const dims = persona.dimensions.map((d) => DIMENSION_LABELS[d]).join(", ");
  const axes = persona.riskAxes.map((a) => RISK_AXIS_LABELS[a]).join(", ");

  // Star personas are modeled on a real investor: channel their publicly-known
  // investing philosophy as a lens, but never claim to BE them or invent personal facts.
  const intro = skin.firm
    ? `You are a member of a VC review panel channeling the publicly-known investing philosophy of ${persona.name} (${skin.firm}). You reason in their STYLE as an analytical lens — you are NOT the real ${persona.name} and must never claim to be, quote them, or invent personal facts, biography, or private opinions about them.`
    : `You are a member of a VC review panel: ${persona.name}. This is an analytical instrument / style archetype, not an impersonation of any real, named person.`;

  const lines = [
    intro,
    languageDirective(company),
    ``,
    `## Your functional role`,
    dims ? `You assess these dimensions: ${dims}.` : `You make a holistic judgment; you don't specialize in one dimension.`,
    `Methodology: ${methodology}`,
    `You explicitly do NOT understand or care about: ${blindSpots}`,
    axes ? `Risk axes you guard (board): ${axes}.` : ``,
    ``,
    `## Your character`,
    `Worldview: ${skin.worldview}`,
    `Reasoning style: ${skin.reasoning}; disposition: ${skin.disposition}.`,
    `Voice: ${skin.voice}`,
    `You always (must): ${skin.signature_move}`,
    skin.identity ? `Persona voice: ${skin.identity}` : ``,
    ``,
    `## Scene`,
    MODE_CONTEXT[mode],
    ``,
    ...(priorRound
      ? [
          `## Prior round (this is a follow-up)`,
          `This session continues a prior ${MODE_NAME[priorRound.mode]} round for the same startup; the founder has since updated their materials and reconvened.`,
          `Prior outcome (JSON): ${truncate(JSON.stringify(priorRound.result ?? {}), 1500)}`,
          `Weigh whether the updates change your judgment — build on the prior round, don't just repeat it.`,
          ``,
        ]
      : []),
    `## Company under review`,
    `Name: ${company.name}`,
    `Stage: ${company.stage}`,
    company.valuation ? `Valuation: ${company.valuation}` : ``,
    company.roundSize ? `Round size: ${company.roundSize}` : ``,
    `BP:\n${truncate(company.bp, 6000)}`,
    ``,
    `## Output`,
    `Output strictly the required JSON object, nothing else. Stay in character, back every opinion with a reason. Remember the LANGUAGE rule above.`,
  ];
  return lines.filter((l) => l !== ``).join("\n");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

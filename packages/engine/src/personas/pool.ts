import type { Persona, ResolvedPersona } from "../types.js";
import { SEATS } from "./seats.js";
import { SKINS } from "./skins.js";

/** 10 default personas (Persona Spec §5) — cover every seat, varied reasoning/stance. */
export const DEFAULT_POOL: Persona[] = [
  { id: "steady_generalist", name: "Steady Generalist", seatId: "seat_generalist", skinId: "skin_steady_generalist", avatar: "🎩" },
  { id: "tech_obsessive", name: "Tech Obsessive", seatId: "seat_product", skinId: "skin_tech_obsessive", avatar: "🔬" },
  { id: "market_veteran", name: "Market Veteran", seatId: "seat_market", skinId: "skin_market_veteran", avatar: "🗺️" },
  { id: "growth_optimist", name: "Growth Optimist", seatId: "seat_growth", skinId: "skin_growth_optimist", avatar: "📈" },
  { id: "numbers_hawk", name: "Numbers Hawk", seatId: "seat_capital", skinId: "skin_numbers_hawk", avatar: "🧾" },
  { id: "devils_advocate", name: "Devil's Advocate", seatId: "seat_risk", skinId: "skin_devils_advocate", avatar: "😈" },
  { id: "sharp_journalist", name: "Sharp Journalist", seatId: "seat_risk", skinId: "skin_sharp_journalist", avatar: "🔍" },
  { id: "peer_founder", name: "Peer Founder", seatId: "seat_team", skinId: "skin_peer_founder", avatar: "🤝" },
  { id: "vision_gambler", name: "Vision Gambler", seatId: "seat_generalist", skinId: "skin_vision_gambler", avatar: "🎲" },
  { id: "contrarian_thinker", name: "Contrarian Thinker", seatId: "seat_market", skinId: "skin_contrarian_thinker", avatar: "🔄" },
];

/** 5 star-investor style archetypes (Persona Spec §6) — broad-spectrum, own tag overrides. */
export const STAR_POOL: Persona[] = [
  { id: "scale_maximalist", name: "The Scale-Maximalist", seatId: "seat_generalist", skinId: "skin_scale_maximalist", avatar: "🚀", dimensionsOverride: ["market", "traction"], riskAxesOverride: ["growth", "market"] },
  { id: "contrarian_monopolist", name: "The Contrarian Monopolist", seatId: "seat_generalist", skinId: "skin_contrarian_monopolist", avatar: "♟️", dimensionsOverride: ["moat", "market"], riskAxesOverride: ["product", "market"] },
  { id: "founder_empiricist", name: "The Founder-First Empiricist", seatId: "seat_generalist", skinId: "skin_founder_empiricist", avatar: "🌱", dimensionsOverride: ["team", "traction"], riskAxesOverride: ["team", "growth"] },
  { id: "disciplined_underwriter", name: "The Disciplined Underwriter", seatId: "seat_generalist", skinId: "skin_disciplined_underwriter", avatar: "📉", dimensionsOverride: ["business_model", "traction"], riskAxesOverride: ["capital", "market"] },
  { id: "timing_network", name: "The Timing & Network Pattern-Matcher", seatId: "seat_generalist", skinId: "skin_timing_network", avatar: "🕰️", dimensionsOverride: ["market", "moat"], riskAxesOverride: ["market", "growth"] },
];

export const ALL_PERSONAS: Persona[] = [...DEFAULT_POOL, ...STAR_POOL];

export function findPersona(id: string): Persona | undefined {
  return ALL_PERSONAS.find((p) => p.id === id);
}

/** Resolve a persona to the three mechanism tags (§4 rules). */
export function resolvePersona(p: Persona): ResolvedPersona {
  const seat = SEATS[p.seatId];
  const skin = SKINS[p.skinId];
  if (!seat) throw new Error(`Unknown seatId: ${p.seatId}`);
  if (!skin) throw new Error(`Unknown skinId: ${p.skinId}`);
  return {
    id: p.id,
    name: p.name,
    avatar: p.avatar,
    seat,
    skin,
    dimensions: p.dimensionsOverride ?? seat.dimensions,
    riskAxes: p.riskAxesOverride ?? seat.risk_axes,
    stance: skin.disposition,
  };
}

export type Dimension =
  | "team"
  | "market"
  | "product"
  | "traction"
  | "moat"
  | "business_model";

export type RiskAxis = "capital" | "team" | "market" | "growth" | "product";

export type Stage = "pre_seed" | "angel" | "seed" | "A";
export type Mode = "screening" | "ic" | "board" | "tea";

export type ProviderName = "qwen" | "deepseek";

export type Reasoning = "analogy" | "first_principles" | "data" | "vision";
export type Disposition = "optimist" | "neutral" | "skeptic";

/** Functional layer — drives mechanism (mechanism reads ONLY this). */
export interface FunctionalSeat {
  id: string;
  name: string;
  dimensions: Dimension[];
  risk_axes: RiskAxis[];
  methodology: string;
  blind_spots: string;
}

/** Character layer — drives voice/variety (mechanism NEVER reads this). */
export interface CharacterSkin {
  id: string;
  name: string;
  reasoning: Reasoning;
  disposition: Disposition;
  worldview: string;
  voice: string;
  signature_move: string;
  identity: string | null;
  // optional overrides for star archetypes (broad-spectrum investors)
  methodology?: string;
  blind_spots?: string;
  /** For star personas modeled on a real investor: their firm. Its presence marks
   *  the persona as an "in the style of {name}" archetype (drives UI + prompt framing). */
  firm?: string;
}

export interface Persona {
  id: string;
  name: string;
  seatId: string;
  skinId: string;
  avatar?: string;
  dimensionsOverride?: Dimension[];
  riskAxesOverride?: RiskAxis[];
}

/** A persona with its seat + skin resolved and the three mechanism tags computed. */
export interface ResolvedPersona {
  id: string;
  name: string;
  avatar?: string;
  seat: FunctionalSeat;
  skin: CharacterSkin;
  dimensions: Dimension[];
  riskAxes: RiskAxis[];
  stance: Disposition;
}

export interface CompanyInput {
  name: string;
  bp: string;
  fundingCurrency?: string;
  valuation?: string;
  roundSize?: string;
  stage: Stage;
  topic?: string;
}

export interface RunContext {
  runId: string;
  mode: Mode;
  stage: Stage;
  company: CompanyInput;
  panel: ResolvedPersona[];
  /** prior-run memory injected on funnel inheritance (e.g. screening -> ic). */
  inherited?: {
    crux?: string[];
    byRole?: Record<string, unknown>;
    willAdvance?: string[];
  };
  /** Continuation (③): the round this session follows on from, if any. */
  priorRound?: {
    mode: Mode;
    result: unknown;
  };
}

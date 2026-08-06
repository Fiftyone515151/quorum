import type { Dimension, RiskAxis, Stage } from "../types.js";

export const DIMENSIONS: Dimension[] = [
  "team",
  "market",
  "product",
  "traction",
  "moat",
  "business_model",
];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  team: "Team",
  market: "Market",
  product: "Product",
  traction: "Traction",
  moat: "Moat",
  business_model: "Business model",
};

export const RISK_AXES: RiskAxis[] = ["capital", "team", "market", "growth", "product"];

export const RISK_AXIS_LABELS: Record<RiskAxis, string> = {
  capital: "资本 Capital（钱烧没了）",
  team: "团队 Team（执行不出来）",
  market: "市场 Market（方向错了）",
  growth: "增长 Growth（长不够快）",
  product: "产品 Product（做不出/做偏）",
};

/** §0.3 stage weights, sum = 100 per column. */
export const STAGE_WEIGHTS: Record<Stage, Record<Dimension, number>> = {
  pre_seed: { team: 35, market: 30, product: 15, traction: 5, moat: 10, business_model: 5 },
  angel: { team: 35, market: 30, product: 15, traction: 5, moat: 10, business_model: 5 },
  seed: { team: 25, market: 25, product: 20, traction: 15, moat: 10, business_model: 5 },
  A: { team: 15, market: 20, product: 15, traction: 25, moat: 10, business_model: 15 },
};

/** Tunable decision thresholds (§1). */
export const THRESHOLDS = {
  T_high: 70,
  T_mid: 50,
  T_spike: 9,
  D_min: 3, // minimum divergence to count as a disagreement point (screening S3)
};

/** §3 founder-response multipliers for board priority. */
export const FOUNDER_MULTIPLIER: Record<string, number> = {
  already_doing: 0.3,
  added_context: 1.0,
  unaware: 1.4,
  null: 1.0,
};

/** Call-budget caps per mode (§6). n = panel size. */
export const CAPS = {
  screening_disagreement_points: 2,
  ic_attack_rounds: 2,
  tea_max_turns: 10,
  tea_round_gap: 3,
};

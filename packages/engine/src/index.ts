export * from "./types.js";
export * from "./events.js";

// personas
export {
  SEATS,
  SEAT_LIST,
  SKINS,
  SKIN_LIST,
  DEFAULT_POOL,
  STAR_POOL,
  ALL_PERSONAS,
  findPersona,
  resolvePersona,
  composeSystemPrompt,
  languageDirective,
} from "./personas/index.js";

// vc domain
export {
  DIMENSIONS,
  DIMENSION_LABELS,
  RISK_AXES,
  RISK_AXIS_LABELS,
  STAGE_WEIGHTS,
  THRESHOLDS,
  FOUNDER_MULTIPLIER,
  CAPS,
} from "./vc/dimensions.js";
export * from "./vc/schema.js";
export { runMode } from "./vc/run.js";
export { runScreening, decideScreeningOutcome } from "./vc/modes/screening.js";
export { runIC, decideICVerdict } from "./vc/modes/ic.js";
export { runBoard, rankBoardItems } from "./vc/modes/board.js";
export { runTea } from "./vc/modes/tea.js";

// providers
export {
  streamChat,
  generateChat,
  generateStructured,
  MODELS,
  defaultModel,
} from "./providers.js";

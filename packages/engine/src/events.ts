import type { Mode } from "./types.js";

export type RunEvent =
  | { type: "run.started"; runId: string; mode: Mode }
  | { type: "status"; status: string }
  | { type: "segment"; segment: string; label?: string }
  | {
      type: "turn.start";
      id: string;
      actor: string; // personaId | "host" | "founder"
      actorName: string;
      avatar?: string;
      segment: string;
      seq: number;
      turnOrder?: number;
    }
  | { type: "turn.delta"; id: string; delta: string }
  | {
      type: "turn.completed";
      id: string;
      actor: string;
      actorName: string;
      avatar?: string;
      segment: string;
      seq: number;
      turnOrder?: number;
      content: string;
      fields?: unknown;
    }
  | { type: "notice"; text: string }
  | { type: "await_founder"; kind: string; payload: unknown }
  | { type: "result"; mode: Mode; payload: unknown }
  | { type: "run.completed" }
  | { type: "run.failed"; error: string };

export interface EngineIO {
  emit(event: RunEvent): void | Promise<void>;
  /** Block until the founder supplies input for a step that requires it (board / IC summon). */
  waitForFounder?: (kind: string, payload: unknown) => Promise<any>;
  /** Non-blocking: return + clear any founder messages waiting (Founder Tea interjections). */
  drainInterjections?: () => Promise<{ content: string }[]>;
  /** Pause at a safe turn boundary when the founder opens the interjection composer. */
  waitIfPaused?: () => Promise<{ content: string }[]>;
}

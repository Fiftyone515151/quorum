import type { RunContext } from "../types.js";
import type { EngineIO } from "../events.js";
import { runScreening } from "./modes/screening.js";
import { runIC } from "./modes/ic.js";
import { runBoard } from "./modes/board.js";
import { runTea } from "./modes/tea.js";

/** Dispatch a ModeRun to its mode runner, with lifecycle events + error handling. */
export async function runMode(ctx: RunContext, io: EngineIO): Promise<void> {
  await io.emit({ type: "run.started", runId: ctx.runId, mode: ctx.mode });
  await io.emit({ type: "status", status: "running" });
  try {
    switch (ctx.mode) {
      case "screening": await runScreening(ctx, io); break;
      case "ic": await runIC(ctx, io); break;
      case "board": await runBoard(ctx, io); break;
      case "tea": await runTea(ctx, io); break;
      default: throw new Error(`unknown mode "${ctx.mode}"`);
    }
    await io.emit({ type: "status", status: "done" });
    await io.emit({ type: "run.completed" });
  } catch (err) {
    await io.emit({ type: "run.failed", error: String((err as Error)?.message ?? err) });
    await io.emit({ type: "status", status: "failed" });
    throw err;
  }
}

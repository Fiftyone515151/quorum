import { describe, it, expect, vi } from "vitest";

// Mock the engine so we control what the "DeepSeek" call does. We use the
// *Once variants (auto-consumed, no cross-test leakage) instead of a
// beforeEach reset, which trips vitest's mock-error surfacing.
const mockGenerate = vi.fn();
vi.mock("@quorum/engine", () => ({ generateStructured: (...a: unknown[]) => mockGenerate(...a) }));

import { normalizeProfile } from "./normalizeProfile";

describe("normalizeProfile", () => {
  it("returns {} without calling the model when there's nothing to tidy", async () => {
    expect(await normalizeProfile({})).toEqual({});
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("returns the tidied answers on success", async () => {
    mockGenerate.mockResolvedValueOnce({ problem: "Tidied problem.", team: "Two founders." });
    const out = await normalizeProfile({ problem: "prblm  messy", team: "2 ppl" });
    expect(out).toEqual({ problem: "Tidied problem.", team: "Two founders." });
  });

  it("falls back to the raw answers when the model fails", async () => {
    mockGenerate.mockImplementationOnce(async () => Promise.reject(new Error("timeout")));
    const out = await normalizeProfile({ problem: "  raw problem " });
    expect(out).toEqual({ problem: "raw problem" });
  });

  it("falls back to raw when the model returns nothing usable", async () => {
    mockGenerate.mockResolvedValueOnce({});
    const out = await normalizeProfile({ moat: "our data" });
    expect(out).toEqual({ moat: "our data" });
  });
});

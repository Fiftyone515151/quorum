import { describe, it, expect } from "vitest";
import { cleanProfile, assembleProfile, hasSubstance } from "./profile";

describe("cleanProfile", () => {
  it("keeps only known, non-empty, trimmed answers", () => {
    expect(cleanProfile({ problem: "  b2b churn ", junk: "x", team: "" })).toEqual({ problem: "b2b churn" });
  });
  it("tolerates non-objects", () => {
    expect(cleanProfile(null)).toEqual({});
    expect(cleanProfile("nope")).toEqual({});
  });
});

describe("assembleProfile", () => {
  it("builds a labeled corpus from one-liner, answers, and doc text", () => {
    const out = assembleProfile({
      topic: "AI for X",
      profile: { problem: "slow", moat: "data" },
      fileText: "full deck text",
    });
    expect(out).toContain("## One-liner\nAI for X");
    expect(out).toContain("## Problem & customer\nslow");
    expect(out).toContain("## Moat\ndata");
    expect(out).toContain("## Uploaded document\nfull deck text");
  });
  it("omits missing sections", () => {
    expect(assembleProfile({ topic: "solo" })).toBe("## One-liner\nsolo");
  });
  it("includes the required founding-team field", () => {
    const out = assembleProfile({ profile: { founderTeam: "Core team: 3 engineers" } });
    expect(out).toBe("## Founding team\nCore team: 3 engineers");
  });
});

describe("hasSubstance", () => {
  it("is true when any source has content, false when empty", () => {
    expect(hasSubstance({ topic: "x" })).toBe(true);
    expect(hasSubstance({ profile: { team: "us" } })).toBe(true);
    expect(hasSubstance({ fileText: "doc" })).toBe(true);
    expect(hasSubstance({ topic: "", profile: {}, fileText: "" })).toBe(false);
  });
});

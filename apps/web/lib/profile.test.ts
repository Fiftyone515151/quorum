import { describe, it, expect } from "vitest";
import { assembleProfile, cleanProfile, hasSubstance } from "./profile";

describe("cleanProfile", () => {
  it("keeps only known non-empty answers, trimmed", () => {
    expect(cleanProfile({ problem: "  a  ", team: "", nope: "x", moat: "b" })).toEqual({ problem: "a", moat: "b" });
  });
  it("tolerates non-objects", () => {
    expect(cleanProfile(null)).toEqual({});
    expect(cleanProfile("x")).toEqual({});
  });
});

describe("assembleProfile", () => {
  it("assembles one-liner, answers (in question order), then the uploaded doc", () => {
    const out = assembleProfile({
      topic: "AI for coffee",
      profile: { moat: "data", problem: "novices quit" },
      fileText: "full BP text",
    });
    expect(out).toContain("## One-liner\nAI for coffee");
    expect(out).toContain("## Problem & customer\nnovices quit");
    expect(out).toContain("## Moat\ndata");
    expect(out).toContain("## Uploaded document\nfull BP text");
    // question order: Problem (B5) comes before Moat (B11)
    expect(out.indexOf("Problem & customer")).toBeLessThan(out.indexOf("Moat"));
  });
  it("omits empty sections", () => {
    expect(assembleProfile({ topic: "just a pitch" })).toBe("## One-liner\njust a pitch");
    expect(assembleProfile({})).toBe("");
  });
});

describe("hasSubstance", () => {
  it("true if any of topic / file / an answer is present", () => {
    expect(hasSubstance({ topic: "x" })).toBe(true);
    expect(hasSubstance({ fileText: "x" })).toBe(true);
    expect(hasSubstance({ profile: { team: "us" } })).toBe(true);
  });
  it("false when everything is empty", () => {
    expect(hasSubstance({ topic: "  ", fileText: "", profile: { team: "" } })).toBe(false);
    expect(hasSubstance({})).toBe(false);
  });
});

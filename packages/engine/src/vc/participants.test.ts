import { describe, it, expect } from "vitest";
import { findDuplicates, validateParticipants } from "./participants";

describe("findDuplicates", () => {
  it("reports each repeated id once, in first-seen order", () => {
    expect(findDuplicates(["a", "b", "a", "c", "b", "b"])).toEqual(["a", "b"]);
  });
  it("returns [] when all ids are unique", () => {
    expect(findDuplicates(["a", "b", "c"])).toEqual([]);
  });
});

describe("validateParticipants", () => {
  it("rejects fewer than 2", () => {
    expect(validateParticipants(["a"])).toMatchObject({ ok: false });
  });
  it("rejects more than 6", () => {
    expect(validateParticipants(["a", "b", "c", "d", "e", "f", "g"])).toMatchObject({ ok: false });
  });
  it("rejects duplicate personas", () => {
    const r = validateParticipants(["a", "a", "b"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Duplicate");
  });
  it("accepts a valid unique panel", () => {
    expect(validateParticipants(["a", "b", "c"])).toEqual({ ok: true });
  });
});

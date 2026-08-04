import { describe, it, expect } from "vitest";
import { resumeAfter } from "./sse";

describe("resumeAfter (SSE replay resume point)", () => {
  it("prefers a positive Last-Event-ID header", () => {
    expect(resumeAfter("42", "10")).toBe(42);
  });
  it("falls back to ?after when the header is missing", () => {
    expect(resumeAfter(null, "10")).toBe(10);
  });
  it("falls back to ?after when the header is 0 or invalid", () => {
    expect(resumeAfter("0", "10")).toBe(10);
    expect(resumeAfter("abc", "10")).toBe(10);
  });
  it("returns 0 when neither is a positive number", () => {
    expect(resumeAfter(null, null)).toBe(0);
    expect(resumeAfter("-5", "-1")).toBe(0);
    expect(resumeAfter("", "")).toBe(0);
  });
});

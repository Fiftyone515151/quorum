import { describe, it, expect } from "vitest";
import { validatePassword } from "./password";

describe("validatePassword", () => {
  it("rejects passwords shorter than 8", () => {
    expect(validatePassword("Ab1")).toMatchObject({ ok: false });
  });
  it("rejects a single character class even if long", () => {
    expect(validatePassword("alllowercase")).toMatchObject({ ok: false });
    expect(validatePassword("ALLUPPERCASE")).toMatchObject({ ok: false });
    expect(validatePassword("12345678")).toMatchObject({ ok: false });
  });
  it("accepts 8+ chars with at least two classes", () => {
    expect(validatePassword("password1")).toEqual({ ok: true }); // lower + digit
    expect(validatePassword("Password")).toEqual({ ok: true }); // upper + lower
    expect(validatePassword("pass!!word")).toEqual({ ok: true }); // lower + symbol
  });
});

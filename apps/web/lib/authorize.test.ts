import { describe, it, expect, vi } from "vitest";
import { authorizeRun } from "./authorize";

const owned = { company: { ownerId: "u1" } };

describe("authorizeRun (data isolation)", () => {
  it("401 and never queries when there is no session", async () => {
    const find = vi.fn();
    const r = await authorizeRun(null, "run1", find as any);
    expect(r).toMatchObject({ ok: false, status: 401 });
    expect(find).not.toHaveBeenCalled();
  });

  it("404 when the run does not exist", async () => {
    const r = await authorizeRun({ userId: "u1" }, "run1", async () => null);
    expect(r).toMatchObject({ ok: false, status: 404 });
  });

  it("404 (not 403) when the run belongs to another user", async () => {
    const r = await authorizeRun({ userId: "u2" }, "run1", async () => owned);
    expect(r).toMatchObject({ ok: false, status: 404 });
  });

  it("ok and returns the run for its owner", async () => {
    const r = await authorizeRun({ userId: "u1" }, "run1", async () => owned);
    expect(r).toEqual({ ok: true, run: owned });
  });
});

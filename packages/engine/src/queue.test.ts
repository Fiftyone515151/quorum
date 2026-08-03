import { describe, it, expect, vi } from "vitest";
import { enqueueJob, parseJob, serializeJob, drainListAtomic, JOBS_QUEUE } from "./queue";

describe("job (de)serialization", () => {
  it("round-trips a runId", () => {
    expect(parseJob(serializeJob({ runId: "r1" }))).toEqual({ runId: "r1" });
  });
  it("rejects garbage and missing runId", () => {
    expect(parseJob("not json")).toBeNull();
    expect(parseJob(JSON.stringify({ foo: 1 }))).toBeNull();
    expect(parseJob(null)).toBeNull();
    expect(parseJob(undefined)).toBeNull();
  });
});

describe("enqueueJob (durable dispatch)", () => {
  it("LPUSHes the job onto the durable queue key", async () => {
    const lpush = vi.fn().mockResolvedValue(1);
    await enqueueJob({ lpush }, { runId: "abc" });
    expect(lpush).toHaveBeenCalledWith(JOBS_QUEUE, JSON.stringify({ runId: "abc" }));
  });
});

describe("drainListAtomic (no lost interjections)", () => {
  function fakeClient(items: string[], record: string[]) {
    const chain: any = {
      lrange: (k: string) => { record.push(`lrange ${k}`); return chain; },
      del: (k: string) => { record.push(`del ${k}`); return chain; },
      exec: async () => [[null, items], [null, 1]],
    };
    return { multi: () => { record.push("multi"); return chain; } };
  }

  it("reads and clears within one MULTI transaction (atomic)", async () => {
    const record: string[] = [];
    const out = await drainListAtomic(fakeClient(["a", "b"], record), "k");
    expect(out).toEqual(["a", "b"]);
    // Both the read and the clear are queued on the same multi() — nothing can
    // slip in between them and get discarded.
    expect(record).toEqual(["multi", "lrange k", "del k"]);
  });

  it("returns [] when the transaction is aborted (exec -> null)", async () => {
    const chain: any = { lrange: () => chain, del: () => chain, exec: async () => null };
    expect(await drainListAtomic({ multi: () => chain }, "k")).toEqual([]);
  });

  it("throws if the lrange inside the transaction errored", async () => {
    const chain: any = { lrange: () => chain, del: () => chain, exec: async () => [[new Error("boom"), null]] };
    await expect(drainListAtomic({ multi: () => chain }, "k")).rejects.toThrow("boom");
  });
});

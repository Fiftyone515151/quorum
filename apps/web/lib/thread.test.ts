import { describe, it, expect } from "vitest";
import { threadRunsWhere } from "./thread";

describe("threadRunsWhere", () => {
  it("matches thread members AND a legacy root by id, excluding soft-deleted", () => {
    const w = threadRunsWhere("root1");
    expect(w.deletedAt).toBeNull();
    // A post-feature member (threadId=root1) is caught by the first clause; a
    // legacy root (threadId=null, id=root1) by the second.
    expect(w.OR).toEqual([{ threadId: "root1" }, { id: "root1" }]);
  });
});

import { describe, expect, it } from "vitest";
import { countDashboardRows } from "./dashboardCounts";

describe("countDashboardRows", () => {
  it("returns zero for an empty query", async () => {
    async function* rows() {
      yield* [];
    }
    expect(await countDashboardRows(rows())).toBe(0);
  });

  it("counts all asynchronously delivered rows beyond typical list limits", async () => {
    async function* rows() {
      for (let index = 0; index < 10_001; index += 1) {
        yield { _id: String(index) };
      }
    }
    expect(await countDashboardRows(rows())).toBe(10_001);
  });

  it("propagates read errors instead of returning a misleading partial count", async () => {
    async function* rows() {
      yield { _id: "first" };
      throw new Error("Read limit exceeded");
    }
    await expect(countDashboardRows(rows())).rejects.toThrow("Read limit exceeded");
  });
});

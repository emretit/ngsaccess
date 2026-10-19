import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { pdksAvailableDateKeys, pdksFirstRecordDate } from "./pdksAvailability";
import { filterPdksReadings } from "./pdksSource";

const employee = { _id: "e", projectId: "p", cardNumber: "123" } as Doc<"employees">;
const reading = (date: string, mode = "card") => ({ employeeId: employee._id, projectId: employee.projectId, cardNo: "123", accessStatus: "izin_verildi", accessTime: `${date}T06:00:00Z`, hikCurrentVerifyMode: mode }) as Doc<"cardReadings">;
function context(rows: Doc<"cardReadings">[]) {
  const take = vi.fn(async (limit: number) => rows.slice(0, limit));
  const chain = { withIndex: () => chain, order: () => chain, take };
  return { ctx: { db: { query: () => chain } } as unknown as QueryCtx, take };
}
describe("PDKS veri kapsamı", () => {
  it("yalnız geçerli proje olaylarının İstanbul günlerini kullanır", () => {
    const raw = [reading("2026-10-01", "face"), reading("2026-10-02", "unknown"), reading("2026-10-03"), { ...reading("2026-10-04"), projectId: "other" as Id<"projects"> }];
    expect([...pdksAvailableDateKeys(filterPdksReadings(raw, "p"))]).toEqual(["2026-10-03"]);
  });
  it("ilk okuma biyometrikse sonraki geçerli kaydı bulur; sorgu 20 ile sınırlıdır", async () => {
    const { ctx, take } = context([reading("2026-10-01", "face"), reading("2026-10-03")]);
    expect(await pdksFirstRecordDate(ctx, employee, [])).toBe("2026-10-03");
    expect(take).toHaveBeenCalledWith(20);
  });
  it("20 adayın hiçbiri geçerli değilse dönem kaydına döner; kayıt yoksa bilinmeyen kalır", async () => {
    const { ctx } = context(Array.from({ length: 21 }, () => reading("2026-10-01", "face")));
    expect(await pdksFirstRecordDate(ctx, employee, [reading("2026-10-08")])).toBe("2026-10-08");
    expect(await pdksFirstRecordDate(ctx, employee, [])).toBeNull();
    expect(await pdksFirstRecordDate(ctx, employee, [], ["2026-10-02"])).toBe("2026-10-02");
  });
});

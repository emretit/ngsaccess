import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../../../convex/_generated/dataModel";
import { applyBulkPlans, bulkFailed } from "./bulk";
const ids = ["a", "b"] as Id<"doors">[];
describe("bulk door plan copy", () => {
  it("saves per door, isolates failures and retries only failed plan keys", async () => {
    const save = vi.fn().mockResolvedValue(["status", "verify"]);
    const status = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "offline" })
      .mockResolvedValue({ ok: true });
    const verify = vi.fn().mockResolvedValue({ ok: true });
    const first = await applyBulkPlans(ids, save, { status, verify });
    expect(first.map(bulkFailed)).toEqual([true, false]);
    const second = await applyBulkPlans(ids, save, { status, verify }, first);
    expect(second.map(bulkFailed)).toEqual([false, false]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(status).toHaveBeenCalledTimes(3);
    expect(verify).toHaveBeenCalledTimes(2);
  });
  it("does not send when save fails and continues other doors", async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error("unauthorized"))
      .mockResolvedValue(["status", "verify"]);
    const status = vi.fn().mockResolvedValue({ ok: true });
    const verify = vi.fn().mockResolvedValue({ ok: true });
    const first = await applyBulkPlans(ids, save, { status, verify });
    expect(first[0]).toMatchObject({ saved: false, error: "unauthorized" });
    expect(status).toHaveBeenCalledTimes(1);
    await applyBulkPlans(ids, save, { status, verify }, first);
    expect(save).toHaveBeenCalledTimes(3);
    expect(status).toHaveBeenCalledTimes(2);
  });
  it("rejects oversized selections before any mutation", async () => {
    const save = vi.fn();
    const apply = vi.fn();
    await expect(
      applyBulkPlans(
        Array.from({ length: 51 }, (_, i) => String(i) as Id<"doors">),
        save,
        { status: apply, verify: apply },
      ),
    ).rejects.toThrow("50");
    expect(save).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });
});

it("Y1 bulk sends only keys returned by each save including template-only and unchanged copies", async () => {
  const save = vi.fn().mockResolvedValueOnce(["status"]).mockResolvedValueOnce([]);
  const status = vi.fn().mockResolvedValue({ ok: true });
  const verify = vi.fn().mockResolvedValue({ ok: true });
  await applyBulkPlans(ids, save, { status, verify });
  expect(status).toHaveBeenCalledTimes(1);
  expect(verify).not.toHaveBeenCalled();
});

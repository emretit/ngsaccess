import { expect, it, vi } from "vitest";
import { cleanupStaleSyncIssues } from "./hikvisionSync";

it("D5: eski, orphan veya non-Hik yüz hataları otomatik başarıya çevrilmez", async () => {
  const rows = ["addFace", "deleteFace", "addCard"].flatMap(operation => ["missing", "non-hik", "hik"].map(deviceId => ({ _id: `${operation}-${deviceId}`, deviceId, operation, status: "failed", attemptCount: 5, createdAt: 1 })));
  const chain = { withIndex: () => chain, order: () => chain, paginate: async () => ({ page: rows, isDone: true, continueCursor: "" }) };
  const ctx = { db: { query: vi.fn(() => chain), get: vi.fn(async (id: string) => id === "missing" ? null : { _id: id, brand: id === "hik" ? "hikvision" : "ide" }), patch: vi.fn() } };
  const handler = (cleanupStaleSyncIssues as unknown as { _handler: (ctx: unknown, args: object) => Promise<unknown> })._handler;
  expect(await handler(ctx, {})).toEqual({ dismissed: 3 });
  expect(ctx.db.patch.mock.calls.map(call => call[0])).toEqual(["addCard-missing", "addCard-non-hik", "addCard-hik"]);
});

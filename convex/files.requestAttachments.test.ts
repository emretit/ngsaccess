import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { claimUpload, getUploadUrl, saveUserPhoto } from "./files";

vi.mock("./lib/customFunctions", () => ({ authedMutation: (definition: { handler: unknown }) => ({ _handler: definition.handler }) }));
type Ctx = MutationCtx & { user: Doc<"users"> };
const handler = (fn: unknown) => (fn as { _handler: (ctx: Ctx, args: { storageId: string }) => Promise<unknown> })._handler;
function fixture(attachment: boolean, pending = true) {
  const storageId = "storage-1";
  const getUrl = vi.fn(async () => "https://storage.example/photo");
  const insert = vi.fn(), patch = vi.fn(), remove = vi.fn();
  const query = (table: string) => {
    const value = table === "requestAttachments" && attachment ? { _id: "attachment-1", storageId }
      : table === "pendingUploads" && pending ? { _id: "pending-1", storageId, userId: "user-1" } : null;
    const chain = { withIndex: () => chain, first: async () => value, unique: async () => value };
    return chain;
  };
  const ctx = { user: { _id: "user-1" }, db: { query, insert, patch, delete: remove, system: { get: async () => ({ _id: storageId }) } }, storage: { getUrl } } as unknown as Ctx;
  return { ctx, storageId, getUrl, insert, patch, remove };
}
describe("request documents cannot escape through the general file API", () => {
  it.each([["claimUpload", claimUpload], ["getUploadUrl", getUploadUrl], ["saveUserPhoto", saveUserPhoto]] as const)("%s rejects a request document even with a forged pending upload", async (_name, fn) => {
    const f = fixture(true);
    await expect(handler(fn)(f.ctx, { storageId: f.storageId })).rejects.toThrow("yalnız talep üzerinden");
    expect(f.getUrl).not.toHaveBeenCalled();
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.patch).not.toHaveBeenCalled();
    expect(f.remove).not.toHaveBeenCalled();
  });
  it("continues to claim ordinary uploads and return/save the owner's photo URL", async () => {
    const upload = fixture(false, false);
    await handler(claimUpload)(upload.ctx, { storageId: upload.storageId });
    expect(upload.insert).toHaveBeenCalledWith("pendingUploads", expect.objectContaining({ storageId: upload.storageId, userId: "user-1" }));
    const photo = fixture(false);
    expect(await handler(getUploadUrl)(photo.ctx, { storageId: photo.storageId })).toBe("https://storage.example/photo");
    expect(await handler(saveUserPhoto)(photo.ctx, { storageId: photo.storageId })).toBe("https://storage.example/photo");
    expect(photo.patch).toHaveBeenCalledWith("user-1", expect.objectContaining({ photoUrl: "https://storage.example/photo" }));
    expect(photo.remove).toHaveBeenCalledWith("pending-1");
  });
});

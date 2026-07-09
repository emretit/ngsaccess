import { v } from "convex/values";
import { adminMutation, authedMutation } from "./lib/customFunctions";
import { getProjectIdsForUser } from "./lib/auth";

export const generateUploadUrl = authedMutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveEmployeePhoto = adminMutation({
  args: {
    employeeId: v.id("employees"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const employee = await ctx.db.get(args.employeeId);
    if (!employee) throw new Error("Çalışan bulunamadı");
    if (ctx.user.role !== "super_admin") {
      const allowedProjectIds = await getProjectIdsForUser(ctx);
      if (!employee.projectId || !allowedProjectIds.some((id) => id === employee.projectId)) {
        throw new Error("Bu çalışanın projesine erişim yetkiniz yok");
      }
    }
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Dosya URL'si alınamadı");
    await ctx.db.patch(args.employeeId, {
      photoUrl: url,
      photoStorageId: args.storageId,
      updatedAt: new Date().toISOString(),
    });
    return url;
  },
});

export const saveUserPhoto = authedMutation({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Dosya URL'si alınamadı");
    await ctx.db.patch(ctx.user._id, {
      photoUrl: url,
      updatedAt: new Date().toISOString(),
    });
    return url;
  },
});

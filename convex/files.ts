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

export const getUploadUrl = authedMutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    // photoStorageId index'i yok; tarama sınırlı, eksik taramada yeni dosya istisnası kapalı.
    const employees = await ctx.db.query("employees").take(1001);
    const linkedEmployees = employees.filter((employee) => employee.photoStorageId === args.storageId);
    if (linkedEmployees.length) {
      const allowed = await getProjectIdsForUser(ctx);
      if (!linkedEmployees.some((employee) => employee.projectId && allowed.includes(employee.projectId))) {
        throw new Error("Bu fotoğrafın projesine erişim yetkiniz yok");
      }
    } else {
      if (employees.length > 1000) throw new Error("Fotoğraf erişimi doğrulanamadı; yöneticiye başvurun");
      const metadata = await ctx.db.system.get(args.storageId);
      const age = metadata ? Date.now() - metadata._creationTime : Infinity;
      // Yeni personel formu fotoğrafı kayıttan önce yükler; sahiplik tablosu eklenene kadar kısa pencere.
      if (age < 0 || age > 10 * 60 * 1000) {
        throw new Error("Fotoğraf bir personele bağlı değil veya yükleme süresi doldu");
      }
    }
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Fotoğraf URL’si alınamadı");
    return url;
  },
});

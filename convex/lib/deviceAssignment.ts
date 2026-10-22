/**
 * Havuz cihazı atama mutation çekirdekleri (devices.claimDevice / reassignDevice / releaseDevice).
 * claimAdminDeviceCore'u ./devicePool'dan import eder; ayrı modül olması testlerin onu
 * mock'layabilmesi için (aynı modül içi çağrı vi.mock ile yakalanmaz).
 */
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { purgeDeviceCascade, deleteGroupDoorsForDoor } from "./deviceHelpers";
import { getProjectIdsForUser, isProjectAllowed } from "./auth";
import { requirePermission } from "./permissions";
import { claimAdminDeviceCore } from "./devicePool";

export type ClaimDeviceArgs = {
  adminDeviceId: Id<"adminDevices">;
  expectedAssignedProjectId?: Id<"projects"> | null;
  projectId: Id<"projects">;
  zoneId?: Id<"zones">;
  newZoneName?: string;
  name?: string;
  ideDoorCount?: number;
  ideUser?: string;
  idePassword?: string;
  description?: string;
};

export async function claimDeviceCore(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: ClaimDeviceArgs,
) {
  const allowedProjectIds = await getProjectIdsForUser(ctx);
  await requirePermission(ctx, ctx.user, args.projectId, "devices.manage");
  if (!allowedProjectIds.some((id) => id === args.projectId)) {
    throw new Error("Bu projeye erişim yetkiniz yok");
  }
  const adminDevice = await ctx.db.get(args.adminDeviceId);
  if (!adminDevice) throw new Error("Cihaz bulunamadı");
  if (
    args.expectedAssignedProjectId !== undefined &&
    (adminDevice.assignedProjectId ?? null) !== args.expectedAssignedProjectId
  ) {
    throw new ConvexError({
      code: "DEVICE_ASSIGNMENT_CHANGED",
      message:
        "Cihazın ataması başka bir oturumda değişti. Listeyi yenileyip tekrar deneyin.",
    });
  }
  if (adminDevice.assignedDeviceId) {
    throw new Error("Bu cihaz zaten bir projeye atanmış");
  }

  return await claimAdminDeviceCore(ctx, {
    adminDevice,
    projectId: args.projectId,
    allowedProjectIds,
    zoneId: args.zoneId,
    newZoneName: args.newZoneName,
    name: args.name,
    ideDoorCount: args.ideDoorCount,
    ideUser: args.ideUser,
    idePassword: args.idePassword,
    description: args.description,
    now: new Date().toISOString(),
  });
}

export type ReassignDeviceArgs = {
  adminDeviceId: Id<"adminDevices">;
  expectedAssignedProjectId?: Id<"projects"> | null;
  projectId?: Id<"projects">;
  name?: string;
};

export async function reassignDeviceCore(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: ReassignDeviceArgs,
) {
  const allowedProjectIds = await getProjectIdsForUser(ctx);
  const adminDevice = await ctx.db.get(args.adminDeviceId);
  if (!adminDevice) throw new Error("Cihaz bulunamadı");
  await requirePermission(
    ctx,
    ctx.user,
    adminDevice.assignedProjectId,
    "devices.manage",
  );
  if (args.projectId)
    await requirePermission(ctx, ctx.user, args.projectId, "devices.manage");
  if (
    args.expectedAssignedProjectId !== undefined &&
    (adminDevice.assignedProjectId ?? null) !== args.expectedAssignedProjectId
  ) {
    throw new ConvexError({
      code: "DEVICE_ASSIGNMENT_CHANGED",
      message:
        "Cihazın ataması başka bir oturumda değişti. Listeyi yenileyip tekrar deneyin.",
    });
  }

  if (
    args.projectId &&
    !allowedProjectIds.some((id) => id === args.projectId)
  ) {
    throw new Error("Bu projeye erişim yetkiniz yok");
  }

  const now = new Date().toISOString();
  const newName = args.name?.trim();
  if (newName && newName !== adminDevice.name) {
    await ctx.db.patch(args.adminDeviceId, { name: newName, updatedAt: now });
  }

  // Proje değişmiyorsa: atanmış device adını da senkronla, bitir.
  if (adminDevice.assignedProjectId === args.projectId) {
    if (newName && adminDevice.assignedDeviceId) {
      await ctx.db.patch(adminDevice.assignedDeviceId, {
        name: newName,
        updatedAt: now,
      });
    }
    return;
  }

  // Mevcut atamayı söküm (varsa) — havuz kaydı KORUNUR, yalnızca assignment temizlenir.
  if (adminDevice.assignedDeviceId) {
    const assigned = await ctx.db.get(adminDevice.assignedDeviceId);
    if (assigned) {
      await requirePermission(
        ctx,
        ctx.user,
        assigned.projectId,
        "devices.manage",
      );
      if (!isProjectAllowed(allowedProjectIds, assigned.projectId)) {
        throw new Error("Mevcut projeye erişim yetkiniz yok");
      }
      await purgeDeviceCascade(ctx, assigned._id, assigned.projectId);
    }
    await ctx.db.patch(args.adminDeviceId, {
      assignedDeviceId: undefined,
      assignedProjectId: undefined,
      updatedAt: now,
    });
  }

  // Hedef projeye yeniden ata (varsa). Patch sonrası güncel kaydı oku.
  if (args.projectId) {
    const fresh = await ctx.db.get(args.adminDeviceId);
    if (!fresh) throw new Error("Cihaz bulunamadı");
    await claimAdminDeviceCore(ctx, {
      adminDevice: fresh,
      projectId: args.projectId,
      allowedProjectIds,
      name: newName ?? fresh.name,
      now,
    });
  }
}

export type ReleaseDeviceArgs = {
  deviceId: Id<"devices">;
};

export async function releaseDeviceCore(
  ctx: MutationCtx & { user: Doc<"users"> },
  args: ReleaseDeviceArgs,
) {
  const allowedProjectIds = await getProjectIdsForUser(ctx);
  const device = await ctx.db.get(args.deviceId);
  if (!device) throw new Error("Cihaz bulunamadı");
  await requirePermission(ctx, ctx.user, device.projectId, "devices.manage");
  if (!isProjectAllowed(allowedProjectIds, device.projectId)) {
    throw new Error("Bu cihaza erişim yetkiniz yok");
  }

  const groupDevices = await ctx.db
    .query("groupDevices")
    .withIndex("by_project_device", (q) =>
      q.eq("projectId", device.projectId).eq("deviceId", args.deviceId),
    )
    .collect();
  await Promise.all(groupDevices.map((gd) => ctx.db.delete(gd._id)));

  const ownedDoors = await ctx.db
    .query("doors")
    .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
    .collect();
  // Sarkan groupDoors bağı kuralı UI'dan silinemez yapar (review-fazb-b3 Y1).
  await Promise.all(ownedDoors.map((d) => deleteGroupDoorsForDoor(ctx, d._id)));
  await Promise.all(ownedDoors.map((d) => ctx.db.delete(d._id)));

  // adminDevices kaydını temizle:
  // - createdFromDevice=true → cihazla birlikte doğdu, birlikte ölmeli
  // - pool kaydı → havuza geri döner (sadece assignment temizlenir)
  const adminDeviceId = device.adminDeviceId;
  if (adminDeviceId) {
    const adminDevice = await ctx.db.get(adminDeviceId);
    if (adminDevice) {
      if (adminDevice.createdFromDevice) {
        await ctx.db.delete(adminDeviceId);
      } else {
        await ctx.db.patch(adminDeviceId, {
          assignedDeviceId: undefined,
          assignedProjectId: undefined,
          lastSeen: device.lastSeen ?? undefined,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } else if (device.ideUuid) {
    const ideUuid = device.ideUuid;
    // Eski akışla eklenmiş (adminDeviceId yok) — UUID ile bul
    const existing = await ctx.db
      .query("adminDevices")
      .withIndex("by_ide_uuid", (q) => q.eq("ideUuid", ideUuid))
      .first();
    if (existing) {
      if (existing.createdFromDevice) {
        await ctx.db.delete(existing._id);
      } else {
        await ctx.db.patch(existing._id, {
          assignedDeviceId: undefined,
          assignedProjectId: undefined,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  // devices tablosundan sil
  await ctx.db.delete(args.deviceId);
}

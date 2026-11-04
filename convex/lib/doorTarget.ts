import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Guard sends as well as writes: legacy rows may predate target uniqueness. */
export async function assertDeviceDoorTargets(ctx: Pick<QueryCtx, "db">, device: Doc<"devices">, target?: Doc<"doors">): Promise<void> {
  if (device.brand !== "hikvision" && device.brand !== "ide_smart") return;
  const doors = await ctx.db.query("doors").withIndex("by_device", q => q.eq("deviceId", device._id)).take(201);
  if (doors.length > 200) throw new ConvexError("Cihazın kapıları denetlenemedi; gönderim durduruldu.");
  const slots = new Map<number, string[]>();
  for (const door of doors) {
    const slot = device.brand === "ide_smart" ? door.ioId : door.hikDoorNo;
    if (slot === undefined) continue;
    slots.set(slot, [...slots.get(slot) ?? [], door.name]);
  }
  const targetSlot = device.brand === "ide_smart" ? target?.ioId : target?.hikDoorNo;
  const conflicts = [...slots].filter(([slot, names]) => names.length > 1 && (!target || slot === targetSlot));
  if (conflicts.length) throw new ConvexError({
    code: "DOOR_TARGET_CONFLICT",
    message: `Aynı kapı numarasını kullanan kapılar: ${conflicts.map(([, names]) => names.join(", ")).join("; ")}. Gönderim durduruldu; kapı numaralarını düzeltin.`,
  });
}

/** Validate the effective target inside the write transaction, including concurrent creates. */
export async function assertDoorTarget(
  ctx: Pick<MutationCtx, "db">,
  target: { device?: Doc<"devices"> | null; hikDoorNo?: number; ioId?: number; doorId?: Id<"doors"> },
): Promise<void> {
  const { device, hikDoorNo, ioId, doorId } = target;
  const hikCount = device?.hikDoorCount ?? device?.doorCount ?? 8;
  const ideCount = device?.ideDoorCount ?? device?.doorCount ?? 8;
  for (const [slot, minimum, count] of [
    [hikDoorNo, 1, device?.brand === "hikvision" ? hikCount : 8],
    [ioId, 0, device?.brand === "ide_smart" ? ideCount : 8],
  ] as const) {
    if (slot === undefined) continue;
    if (!Number.isInteger(slot) || !Number.isInteger(count) || count < 1 || count > 8 || slot < minimum || slot >= minimum + count) {
      throw new ConvexError(`Kapı numarası ${minimum}–${minimum + count - 1} arasında bir tam sayı olmalıdır.`);
    }
  }
  if (!device) return;
  const slot = device.brand === "ide_smart" ? ioId : hikDoorNo;
  if (slot === undefined) return;
  const doors = await ctx.db.query("doors").withIndex("by_device", q => q.eq("deviceId", device._id)).take(201);
  if (doors.length > 200) throw new ConvexError("Cihazın kapı sayısı denetlenemedi; kayıt yapılmadı.");
  if (doors.some(door => door._id !== doorId && (device.brand === "ide_smart" ? door.ioId : door.hikDoorNo) === slot)) {
    throw new ConvexError("Bu cihazda aynı kapı numarası zaten kullanılıyor. Başka bir kapı numarası seçin.");
  }
}

import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { notify } from "@/lib/notify";
import type { ShiftFormPayload } from "./definitions/AddShiftDialog";
import type { Shift } from "./lib/planning";

export function useShiftDefinitionActions(projectId: Id<"projects">, shifts: Shift[]) {
  const create = useMutation(api.shifts.create);
  const update = useMutation(api.shifts.update);
  const add = async ({ color, ...payload }: ShiftFormPayload) => {
    await create({ ...payload, color: color ?? undefined, projectId });
    notify.success("Vardiya oluşturuldu");
  };
  const edit = async (shiftId: Id<"shifts">, { color, ...payload }: ShiftFormPayload) => {
    const current = shifts.find((shift) => shift._id === shiftId);
    // Renk yalnız değiştiyse gönderilir: Convex'ten önce yayınlanan web eski backend'de düzenlemeyi bozmasın.
    const colorPatch = (color ?? null) !== (current?.color ?? null) ? { color } : {};
    await update(current?.scheduleType === "flexible"
      ? { shiftId, name: payload.name, isActive: payload.isActive, ...colorPatch }
      : { ...payload, ...colorPatch, shiftId });
    notify.success("Vardiya güncellendi");
  };
  return { add, edit };
}

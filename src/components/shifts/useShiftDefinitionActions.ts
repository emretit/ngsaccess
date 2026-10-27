import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { notify } from "@/lib/notify";
import type { ShiftFormPayload } from "./definitions/AddShiftDialog";

export function useShiftDefinitionActions(projectId: Id<"projects">) {
  const create = useMutation(api.shifts.create);
  const update = useMutation(api.shifts.update);
  const add = async (payload: ShiftFormPayload) => {
    await create({ ...payload, projectId });
    notify.success("Vardiya oluşturuldu");
  };
  // Hesap alanları sunucuda tarihli sürüme yazılır; yalnız ad/aktiflik değiştiyse sürüm açılmaz.
  const edit = async (shiftId: Id<"shifts">, payload: ShiftFormPayload, effectiveFrom: string) => {
    await update({ ...payload, shiftId, effectiveFrom });
    notify.success("Vardiya güncellendi");
  };
  return { add, edit };
}

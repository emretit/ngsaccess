import { usePermissions } from "@/hooks/usePermissions";
import { DoorGeneralFields } from "./door-dialog/DoorGeneralFields";
import { DoorGatewayNumberField } from "./door-dialog/DoorGatewayNumberField";
import type { DoorStatusPlan } from "../../../convex/lib/doorStatusPlan";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

/** Cihaz listesinden sadece kullandığımız alanlar */
type DeviceInfo = {
  _id: Id<"devices">;
  brand?: string;
  hikTransport?: string;
};

/** Kapı prop tipi — doors tablosunun kullandığımız alanları */
export type DoorForEdit = {
  _id: Id<"doors">;
  name: string;
  doorCode?: string;
  hikDoorNo?: number;
  hikDoorStatusPlan?: DoorStatusPlan;
  hikVerifyPlan?: {
    enabled: boolean;
    beginTime: string;
    endTime: string;
    verifyMode: string;
  };
};

interface EditDoorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  door: DoorForEdit;
  device: DeviceInfo | undefined;
}

function isHikGateway(device: DeviceInfo | undefined): boolean {
  return device?.brand === "hikvision" && device?.hikTransport === "gateway";
}

/**
 * Cihazlar sayfasında kapının yalnız kimliği düzenlenir (ad, kod, Hik kapı numarası).
 * Kapı durum / doğrulama modu planları yetki ve çalışma ayarıdır; Geçiş Kontrol'e aittir, burada gösterilmez.
 */
export function EditDoorDialog({
  open,
  onOpenChange,
  onSuccess,
  door,
  device,
}: EditDoorDialogProps) {
  const [name, setName] = useState(door.name);
  const [doorCode, setDoorCode] = useState(door.doorCode ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  // hikDoorNo — zorunlu sayı (1..N) yalnız gateway cihazda gösterilir
  const initialDoorNo = door.hikDoorNo !== undefined ? String(door.hikDoorNo) : "";
  const [hikDoorNo, setHikDoorNo] = useState<string>(initialDoorNo);

  const updateDoor = useMutation(api.doors.update);
  const { can } = usePermissions();
  const showDoorNo = can("devices.manage") && isHikGateway(device);

  const { run, pending: isSubmitting } = useAsyncAction(async (parsedDoorNo: number | undefined) => {
    await updateDoor({
      doorId: door._id,
      name: name.trim(),
      doorCode: doorCode.trim() || undefined,
      hikDoorNo: parsedDoorNo,
    });
    notify.success("Kapı kaydedildi");
    onSuccess();
    onOpenChange(false);
  }, { error: "Kapı kaydedilemedi" });

  const guard = useUnsavedChangesGuard(open && (name !== door.name || doorCode !== (door.doorCode ?? "") || hikDoorNo !== initialDoorNo));
  const close = () => { if (!isSubmitting) guard.requestClose(() => onOpenChange(false)); };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!name.trim()) {
      setErrors({ name: "Kapı adı gereklidir." });
      document.getElementById("edit-door-name")?.focus();
      return;
    }
    const parsedDoorNo = hikDoorNo.trim() !== "" ? Number(hikDoorNo) : undefined;
    if (showDoorNo && (parsedDoorNo === undefined || !Number.isInteger(parsedDoorNo) || parsedDoorNo < 1)) {
      setErrors({ hikDoorNo: "Hikvision kapı numarası 1 veya üzeri bir tam sayı olmalıdır." });
      document.getElementById("hik-door-no")?.focus();
      return;
    }
    setErrors({});
    await run(parsedDoorNo);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kapıyı Düzenle</DialogTitle>
          <DialogDescription>
            {door.name} kapısının ayarlarını güncelleyin.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} aria-busy={isSubmitting} noValidate>
          {Object.keys(errors).length > 0 && <div role="alert" className="mb-4 text-sm text-destructive"><p className="font-medium">Kaydedilemedi. Alanları kontrol edin.</p><ul className="list-disc pl-4">{Object.entries(errors).map(([key, message]) => <li key={key}>{message}</li>)}</ul></div>}
          <fieldset disabled={isSubmitting}>
            <div className="grid gap-4 py-4">
              <DoorGeneralFields name={name} setName={setName} doorCode={doorCode} setDoorCode={setDoorCode} timeErrors={errors} />
              {showDoorNo && <DoorGatewayNumberField hikDoorNo={hikDoorNo} setHikDoorNo={setHikDoorNo} timeErrors={errors} />}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={isSubmitting} onClick={close}>
              İptal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {guard.dialog}
    </>
  );
}

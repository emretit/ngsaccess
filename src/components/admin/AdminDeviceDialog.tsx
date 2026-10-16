import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { z } from "zod";
import { deviceIdentityError } from "../../../convex/lib/deviceIdentity";
import { completeDeviceRegistration } from "../../../convex/lib/deviceIdentityRegistration";

import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { notify } from "@/lib/notify";

const identitySchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const message = deviceIdentityError(value, "ide_smart");
    if (message) ctx.addIssue({ code: "custom", message });
  });

const NO_PROJECT = "__none__";

type AdminDevice = FunctionReturnType<typeof api.adminDevices.list>[number];

interface AdminDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Verilirse düzenleme modu: UUID kilitli, isim + proje atama güncellenir. */
  device?: AdminDevice | null;
}

/**
 * Super admin bir IDE Smart paneli UUID ile envantere (adminDevices) ekler veya
 * mevcut bir kaydı düzenler (isim + proje atama). Proje değişimi yıkıcıdır
 * (reassignDevice): atanmış cihaz mevcut projeden sökülüp hedefe yeniden atanır.
 */
export function AdminDeviceDialog({
  open,
  onClose,
  onSuccess,
  device,
}: AdminDeviceDialogProps) {
  const registerDevice = useMutation(api.adminDevices.register);
  const claimDevice = useMutation(api.devices.claimDevice);
  const reassignDevice = useMutation(api.devices.reassignDevice);
  const projects = useQuery(api.projects.list, open ? {} : "skip");

  const isEdit = !!device;

  const [ideUuid, setIdeUuid] = useState("");
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string>(NO_PROJECT);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [registeredId, setRegisteredId] = useState<Id<"adminDevices"> | null>(
    null,
  );
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [identityError, setIdentityError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setIdeUuid(device?.ideUuid ?? "");
      setName(device?.name ?? "");
      setProjectId(device?.assignedProjectId ?? NO_PROJECT);
      setEditing(false);
      setConfirmOpen(false);
      setRegisteredId(null);
      setAssignmentError(null);
      setIdentityError(null);
    }
  }, [open, device]);

  const { run: handleCreate, pending: creating } = useAsyncAction(
    async () => {
      const parsed = identitySchema.safeParse(ideUuid);
      if (!parsed.success) {
        const message =
          parsed.error.issues[0]?.message ?? "Cihaz kimliği geçersiz";
        setIdentityError(message);
        throw new Error(message);
      }
      setIdentityError(null);
      let savedId = registeredId;
      try {
        await completeDeviceRegistration({
          registeredId,
          register: () =>
            registerDevice({
              ideUuid: parsed.data,
              name: name.trim() || undefined,
              brand: "ide_smart",
            }),
          onRegistered: (id) => {
            savedId = id;
            setRegisteredId(id);
          },
          claim:
            projectId === NO_PROJECT
              ? undefined
              : (adminDeviceId) =>
                  claimDevice({
                    adminDeviceId,
                    projectId: projectId as Id<"projects">,
                    name: name.trim() || undefined,
                  }),
        });
        setAssignmentError(null);
        notify.success(
          projectId === NO_PROJECT
            ? "Cihaz envantere eklendi"
            : "Cihaz eklendi ve projeye atandı",
        );
        onSuccess();
      } catch (error) {
        if (savedId && projectId !== NO_PROJECT)
          setAssignmentError(
            error instanceof Error ? error.message : "Atama tamamlanamadı",
          );
        throw error;
      }
    },
    { error: "Cihaz işlemi tamamlanamadı" },
  );

  const saveEdit = async () => {
    if (!device) throw new Error("Düzenlenecek cihaz seçilmedi");
    setEditing(true);
    try {
      await reassignDevice({
        adminDeviceId: device._id,
        projectId:
          projectId === NO_PROJECT ? undefined : (projectId as Id<"projects">),
        name: name.trim() || undefined,
      });
      notify.success("Cihaz güncellendi");
      onSuccess();
    } finally {
      setEditing(false);
    }
  };
  const { run: runEdit } = useAsyncAction(saveEdit, {
    error: "Cihaz güncellenemedi",
  });

  const submitting = creating || editing;

  const handleEdit = () => {
    if (!device) return;
    const targetProjectId =
      projectId === NO_PROJECT ? undefined : (projectId as Id<"projects">);
    const projectChanged =
      (device.assignedProjectId ?? null) !== (targetProjectId ?? null);
    if (projectChanged && device.assignedDeviceId) {
      setConfirmOpen(true);
    } else {
      void runEdit();
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(isOpen) => !isOpen && !submitting && onClose()}
      >
        <SheetContent size="lg" className="p-0">
          <div className="p-6 border-b">
            <SheetHeader>
              <SheetTitle>
                {isEdit ? "Cihazı Düzenle" : "Envantere Cihaz Ekle"}
              </SheetTitle>
            </SheetHeader>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEdit
                ? "İsmi ve proje atamasını değiştirin. Proje değişimi atanmış cihazda kapıları siler; okuma geçmişi korunur."
                : "Cihaz envantere eklendikten sonra Cihazlar sayfasından projeye atanabilir."}
            </p>
          </div>

          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <FormFieldWrapper
                  htmlFor="admin-device-uuid"
                  label="Panel UUID"
                  error={identityError ?? undefined}
                >
                  <Input
                    id="admin-device-uuid"
                    aria-invalid={Boolean(identityError)}
                    aria-describedby="admin-device-identity-help"
                    autoFocus={!isEdit}
                    disabled={isEdit || registeredId !== null || submitting}
                    value={ideUuid}
                    onChange={(e) => setIdeUuid(e.target.value)}
                    placeholder="ör. 289833329732592 (panelin SYSTEM.UUID'i — src-id)"
                  />
                </FormFieldWrapper>
                <p
                  id="admin-device-identity-help"
                  className="text-xs text-muted-foreground"
                >
                  {isEdit
                    ? "Panel kimliği değiştirilemez."
                    : "Panelin gerçek MQTT kimliği (15 haneli). Seri no DEĞİL."}
                </p>
              </div>

              {registeredId && (
                <div role="status" className="rounded-md border p-3 text-sm">
                  <p>
                    {assignmentError
                      ? "Cihaz kaydedildi, projeye atama başarısız — Tekrar ata"
                      : "Cihaz envantere kaydedildi."}
                  </p>
                  {assignmentError && (
                    <p className="text-muted-foreground">{assignmentError}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Kapatırsanız cihaz havuzda kalır ve daha sonra atanabilir.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="admin-device-name">Cihaz Adı (opsiyonel)</Label>
                <Input
                  id="admin-device-name"
                  disabled={submitting || registeredId !== null}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Boş bırakılırsa UUID kullanılır"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-device-project">Proje (opsiyonel)</Label>
                <Select
                  value={projectId}
                  onValueChange={setProjectId}
                  disabled={submitting || projects === undefined}
                >
                  <SelectTrigger id="admin-device-project">
                    <SelectValue placeholder="Projeye atamadan envantere ekle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>
                      Atama yok (havuzda kalsın)
                    </SelectItem>
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Proje seçilirse cihaz doğrudan atanır; boş bırakılırsa havuzda
                  kalır.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  disabled={submitting}
                >
                  İptal
                </Button>
                <Button
                  onClick={isEdit ? handleEdit : () => void handleCreate()}
                  disabled={
                    submitting ||
                    (!isEdit &&
                      (!ideUuid.trim() ||
                        (projectId !== NO_PROJECT && projects === undefined)))
                  }
                >
                  {submitting && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {isEdit
                    ? "Kaydet"
                    : registeredId
                      ? projectId === NO_PROJECT
                        ? "Havuzda bırak"
                        : "Tekrar ata"
                      : "Envantere Ekle"}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
      <ConfirmDestructive
        open={open && confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cihazın proje ataması değiştirilsin mi?"
        objectName={device?.name ?? "Cihaz"}
        effects={[
          `Cihaz ${device?.assignedProjectName ?? "mevcut proje"} kapsamından çıkarılır.`,
          "Mevcut kapıları silinir; kart okuma geçmişi korunur.",
          projectId === NO_PROJECT
            ? "Cihaz atanmamış olarak envanterde kalır."
            : `Cihaz ${projects?.find((project) => project._id === projectId)?.name ?? "seçilen proje"} projesine atanır.`,
        ]}
        confirmLabel="Atamayı değiştir"
        onConfirm={saveEdit}
      />
    </>
  );
}

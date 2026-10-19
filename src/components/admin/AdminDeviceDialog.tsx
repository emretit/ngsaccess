import { useEffect, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAdminFormGuard } from "./hooks/useAdminFormGuard";
import { errorMessage } from "@/lib/notify";
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
  device: openingDevice,
}: AdminDeviceDialogProps) {
  const registerDevice = useMutation(api.adminDevices.register);
  const claimDevice = useMutation(api.devices.claimDevice);
  const reassignDevice = useMutation(api.devices.reassignDevice);
  const projects = useQuery(api.projects.list, open ? {} : "skip");

  const [device, setDevice] = useState(openingDevice);
  const wasOpen = useRef(false);
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
  const [submitError, setSubmitError] = useState<string>();
  const [identityError, setIdentityError] = useState<string | null>(null);

  useEffect(() => {
    if (open && !wasOpen.current) {
      // Keep assignment and claim/reassign decisions tied to the opening snapshot.
      setDevice(openingDevice ? { ...openingDevice } : openingDevice);
      setIdeUuid(openingDevice?.ideUuid ?? "");
      setName(openingDevice?.name ?? "");
      setProjectId(openingDevice?.assignedProjectId ?? NO_PROJECT);
      setEditing(false);
      setConfirmOpen(false);
      setRegisteredId(null);
      setAssignmentError(null);
      setIdentityError(null);
      setSubmitError(undefined);
    }
    wasOpen.current = open;
  }, [open, openingDevice]);

  const { run: handleCreate, pending: creating } = useAsyncAction(
    async () => {
      setSubmitError(undefined);
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
                    expectedAssignedProjectId: null,
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
        setSubmitError(errorMessage(error));
        if (savedId && projectId !== NO_PROJECT)
          setAssignmentError(
            errorMessage(error),
          );
        throw error;
      }
    },
    { error: "Cihaz işlemi tamamlanamadı" },
  );

  const saveEdit = async () => {
    if (!device) throw new Error("Düzenlenecek cihaz seçilmedi");
    setEditing(true);
    setSubmitError(undefined);
    try {
      const target =
        projectId === NO_PROJECT ? undefined : (projectId as Id<"projects">);
      if (!device.assignedDeviceId && target) {
        await claimDevice({
          adminDeviceId: device._id,
          expectedAssignedProjectId: device.assignedProjectId ?? null,
          projectId: target,
          name: name.trim() || undefined,
        });
      } else
        await reassignDevice({
          adminDeviceId: device._id,
          expectedAssignedProjectId: device.assignedProjectId ?? null,
          projectId:
            projectId === NO_PROJECT
              ? undefined
              : (projectId as Id<"projects">),
          name: name.trim() || undefined,
        });
      notify.success("Cihaz güncellendi");
      onSuccess();
    } catch (error) {
      setSubmitError(errorMessage(error));
      throw error;
    } finally {
      setEditing(false);
    }
  };
  const { run: runEdit } = useAsyncAction(saveEdit, {
    error: "Cihaz güncellenemedi",
  });

  const submitting = creating || editing;
  const dirty =
    open && !registeredId &&
    (ideUuid !== (device?.ideUuid ?? "") ||
      name !== (device?.name ?? "") ||
      projectId !== (device?.assignedProjectId ?? NO_PROJECT));
  const guard = useAdminFormGuard("admin-device", dirty, open && submitting);
  const close = () => {
    if (!submitting) guard.requestClose(onClose);
  };

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
      <Sheet open={open} onOpenChange={(isOpen) => !isOpen && close()}>
        <SheetContent
          size="lg"
          className="flex w-full flex-col p-0 sm:max-w-[560px] md:max-w-[560px]"
        >
          <div className="p-6 border-b">
            <SheetHeader>
              <SheetTitle>
                {isEdit ? "Cihazı düzenle" : "Cihaz kaydet"}
              </SheetTitle>
            <SheetDescription className="mt-1 text-sm text-muted-foreground">
              {isEdit
                ? "İsmi ve proje atamasını değiştirin. Proje değişimi atanmış cihazda kapıları siler; okuma geçmişi korunur."
                : "Cihaz envantere eklendikten sonra Cihazlar sayfasından projeye atanabilir."}
            </SheetDescription>
            </SheetHeader>
          </div>

          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (isEdit) handleEdit();
              else void handleCreate();
            }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
              <div className="space-y-2">
                <FormFieldWrapper
                  htmlFor="admin-device-uuid"
                  label={
                    isEdit && !device?.ideUuid && device?.deviceSerial
                      ? "Seri numarası"
                      : "Panel UUID"
                  }
                  error={identityError ?? undefined}
                >
                  <Input
                    id="admin-device-uuid"
                    aria-invalid={Boolean(identityError)}
                    aria-describedby="admin-device-identity-help"
                    autoFocus={!isEdit}
                    disabled={isEdit || registeredId !== null || submitting}
                    readOnly={isEdit}
                    inputMode="numeric"
                    value={
                      isEdit && !device?.ideUuid
                        ? (device?.deviceSerial ?? "Kimlik bilgisi yok")
                        : ideUuid
                    }
                    onChange={(e) => setIdeUuid(e.target.value)}
                    placeholder="15 rakamlı panel UUID"
                  />
                </FormFieldWrapper>
                <p
                  id="admin-device-identity-help"
                  className="text-xs text-muted-foreground"
                >
                  {isEdit
                    ? "Panel kimliği değiştirilemez."
                    : "Panel UUID’sini 15 rakam olarak girin."}
                </p>
              </div>

              {registeredId && (
                <div role="status" className="rounded-md border p-3 text-sm">
                  <p>
                    {assignmentError
                      ? "Cihaz kaydedildi, projeye atanamadı. Cihaz havuzda tutuluyor."
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
            </div>
            <div className="shrink-0 border-t p-4 space-y-3">
              {submitError && (
                <p
                  role="alert"
                  className="break-words text-sm text-destructive"
                >
                  {submitError}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={close}
                  disabled={submitting}
                >
                  {registeredId ? "Havuzda bırak" : "Vazgeç"}
                </Button>
                <Button
                  type="submit"
                  disabled={
                    submitting ||
                    (isEdit &&
                      projectId !== NO_PROJECT &&
                      projects === undefined) ||
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
                      : "Cihaz kaydet"}
                </Button>
              </div>
            </div>
          </form>
        </SheetContent>
      </Sheet>
      <ConfirmDestructive
        open={open && confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Cihazın proje ataması değiştirilsin mi?"
        objectName={`${device?.name ?? "Cihaz"} · ${device?.ideUuid ?? device?.deviceSerial ?? ""}`}
        effects={[
          `Cihaz ${device?.assignedProjectName ?? "mevcut proje"} kapsamından çıkarılır.`,
          "Mevcut kapılar, okuyucular, grup cihaz bağlantıları ve bekleyen köprü işleri kaldırılır; bölge ve kart okuma geçmişi korunur.",
          "Hedefte kapı ve bölge kurulum akışı çalışır.",
          ...(submitError ? [submitError] : []),
          projectId === NO_PROJECT
            ? "Cihaz atanmamış olarak envanterde kalır."
            : `Cihaz ${projects?.find((project) => project._id === projectId)?.name ?? "seçilen proje"} projesine atanır.`,
        ]}
        confirmLabel="Atamayı değiştir"
        onConfirm={saveEdit}
      />
      {guard.dialog}
    </>
  );
}

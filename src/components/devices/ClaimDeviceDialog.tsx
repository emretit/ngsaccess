import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Inbox } from "lucide-react";
import { useUnsavedChangesGuard } from "@/components/shared/UnsavedChangesDialog";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { PasswordField } from "@/components/shared/PasswordField";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { deviceConnection } from "@/lib/deviceStatus";

interface ClaimDeviceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ClaimableDevice = FunctionReturnType<typeof api.adminDevices.listForClaim>[number];

const NEW_ZONE = "__new__";

/**
 * Cihazlar sayfası: havuzdaki (atanmamış) cihazlardan birini aktif projeye claim eder.
 * Atama anında zone + door üretilir (backend claimDevice). super_admin başka projeye de
 * atayabilir; proje yöneticisi aktif projesine kilitli.
 */
export function ClaimDeviceDialog({ open, onClose, onSuccess }: ClaimDeviceDialogProps) {
  const { isSuperAdmin } = useProjectAccess();
  const { projectId: activeProjectId, activeProject } = useActiveProject();

  const claimable = useQuery(api.adminDevices.listForClaim, open ? {} : "skip");
  const projects = useQuery(api.projects.list, open && isSuperAdmin ? {} : "skip");

  const [selectedId, setSelectedId] = useState<Id<"adminDevices"> | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<Id<"projects"> | null>(null);
  const [name, setName] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [doorCount, setDoorCount] = useState(4);
  const [ideUser, setIdeUser] = useState("");
  const [idePassword, setIdePassword] = useState("");
  const [zoneChoice, setZoneChoice] = useState<string>(NEW_ZONE);
  const [newZoneName, setNewZoneName] = useState("");


  const zones = useQuery(
    api.zones.list,
    open && targetProjectId ? { projectId: targetProjectId } : "skip",
  );
  const claimDevice = useMutation(api.devices.claimDevice);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setAttempted(false);
      setTargetProjectId(activeProjectId ?? null);
      setName("");
      setDoorCount(4);
      setIdeUser("");
      setIdePassword("");
      setZoneChoice(NEW_ZONE);
      setNewZoneName("");
    }
  }, [open, activeProjectId]);

  const selected = useMemo<ClaimableDevice | null>(
    () => (claimable ?? []).find((d) => d._id === selectedId) ?? null,
    [claimable, selectedId],
  );

  // Cihaz seçilince varsayılanları doldur (isim, kapı sayısı, kimlik bilgisi, yeni bölge adı).
  const onSelectDevice = (id: Id<"adminDevices">) => {
    const dev = (claimable ?? []).find((d) => d._id === id);
    setSelectedId(id);
    setName(dev?.name ?? "");
    setDoorCount(dev?.ideDoorCount ?? 4);
    setIdeUser(dev?.ideUser ?? "");
    setIdePassword(dev?.idePassword ?? "");
    setNewZoneName("");
  };

  const isIde = selected?.brand === "ide_smart";

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  const projectZones = zones ?? [];

  const canSubmit =
    !!selectedId &&
    !!targetProjectId &&
    // IDE Smart paneller MQTT login için kullanıcı+şifre ister; boşsa sync sonsuza pending kalır.
    (!isIde || (ideUser.trim().length > 0 && idePassword.trim().length > 0)) &&
    (zoneChoice === NEW_ZONE ? newZoneName.trim().length > 0 && newZoneName.trim().toLocaleLowerCase("tr-TR") !== name.trim().toLocaleLowerCase("tr-TR") : true);

  const { run: handleSubmit, pending: submitting } = useAsyncAction(async () => {
    if (!selectedId || !targetProjectId || !canSubmit) throw new Error("Cihaz, proje ve geçerli bölge seçin");
      await claimDevice({
        adminDeviceId: selectedId,
        projectId: targetProjectId,
        name: name.trim() || undefined,
        ideDoorCount: doorCount,
        ...(isIde
          ? { ideUser: ideUser.trim(), idePassword: idePassword.trim() }
          : {}),
        ...(zoneChoice === NEW_ZONE
          ? { newZoneName: newZoneName.trim() }
          : { zoneId: zoneChoice as Id<"zones"> }),
      });

      onSuccess();
  }, { error: "Cihaz projeye eklenemedi" });

  const guard = useUnsavedChangesGuard(open && (selectedId !== null || name !== "" || newZoneName !== ""));
  const close = () => { if (!submitting) guard.requestClose(onClose); };
  const errors = [
    ...(!targetProjectId ? [{ id: "claim-project", message: "Proje seçin." }] : []),
    ...(!selectedId ? [{ id: "claim-device", message: "Atanacak cihazı seçin." }] : []),
    ...(isIde && !ideUser.trim() ? [{ id: "claim-user", message: "Panel kullanıcı adı gereklidir." }] : []),
    ...(isIde && !idePassword.trim() ? [{ id: "claim-password", message: "Panel şifresi gereklidir." }] : []),
    ...(zoneChoice === NEW_ZONE && (!newZoneName.trim() || newZoneName.trim().toLocaleLowerCase("tr-TR") === name.trim().toLocaleLowerCase("tr-TR")) ? [{ id: "claim-zone-name", message: !newZoneName.trim() ? "Yeni bölge adı girin veya mevcut bir bölge seçin." : "Bölge adı cihaz adıyla aynı olamaz." }] : []),
  ];
  const submit = () => { setAttempted(true); if (errors[0]) document.getElementById(errors[0].id)?.focus(); else void handleSubmit(); };
  const loading = claimable === undefined;
  const empty = !loading && (claimable ?? []).length === 0;

  return (
    <>
    <Sheet open={open} onOpenChange={next => { if (!next) close(); }}>
      <SheetContent size="full" className="flex w-full min-w-0 flex-col p-0 sm:max-w-[620px]">
        <div className="shrink-0 border-b p-5 pr-12">
          <SheetHeader>
            <SheetTitle>Havuzdan ata</SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin tarafından eklenmiş, henüz bir projeye atanmamış cihazlardan seçin.
          </p>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <SectionSkeleton rows={4} label="Atanabilecek cihazlar yükleniyor" />
              </div>
            ) : empty ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">Atanabilecek cihaz yok.</p>
                <p className="text-xs">Yeni cihazlar Admin → Cihaz Yönetimi'nde UUID ile eklenir.</p>
              </div>
            ) : (
              <form onSubmit={event => { event.preventDefault(); submit(); }} noValidate>
              <fieldset disabled={submitting} className="space-y-5">
                {!isSuperAdmin && <p className="text-sm text-muted-foreground">Proje: {activeProject?.name ?? "Proje seçilmedi"}</p>}
                {attempted && errors.length > 0 && <div role="alert" className="rounded-md border border-danger p-3 text-sm"><p className="font-medium">Atama tamamlanamadı. Alanları kontrol edin.</p>{errors.map(error => <button key={error.id} type="button" className="block text-left underline" onClick={() => document.getElementById(error.id)?.focus()}>{error.message}</button>)}</div>}
                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="claim-project">Proje</Label>
                    <Select
                      value={targetProjectId ?? undefined}
                      onValueChange={(v) => {
                        setTargetProjectId(v as Id<"projects">);
                        // Proje değişince eski projeye ait seçili bölge geçersiz → sıfırla.
                        setZoneChoice(NEW_ZONE);
                      }}
                    >
                      <SelectTrigger id="claim-project" aria-invalid={attempted && errors.some(error => error.id === "claim-project")} aria-describedby={attempted && errors.some(error => error.id === "claim-project") ? "claim-project-error" : undefined}>
                        <SelectValue placeholder="Projeyi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {(projects ?? []).map((p) => (
                          <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
  {attempted && errors.find(error => error.id === "claim-project") && <p id="claim-project-error" className="text-xs text-destructive">{errors.find(error => error.id === "claim-project")?.message}</p>}
                </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="claim-device">Cihaz</Label>
                  <Select value={selectedId ?? undefined} onValueChange={(v) => onSelectDevice(v as Id<"adminDevices">)}>
                    <SelectTrigger id="claim-device" aria-invalid={attempted && errors.some(error => error.id === "claim-device")} aria-describedby={attempted && errors.some(error => error.id === "claim-device") ? "claim-device-error" : undefined}>
                      <SelectValue placeholder="Havuzdan bir cihaz seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {(claimable ?? []).map((d) => {
                        const online = deviceConnection(d, nowMs) === "online";
                        return (
                          <SelectItem key={d._id} value={d._id}>
                            <span className="flex items-center gap-2">
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${online ? "bg-success" : "bg-muted-foreground/40"}`}
                              />
                              {d.name}
                              {d.ideUuid && d.ideUuid !== d.name && (
                                <span className="text-xs text-muted-foreground">({d.ideUuid})</span>
                              )}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {selected && (
                    <p className="text-xs text-muted-foreground">
                      Marka: {selected.brand ?? "—"} ·{" "}
                      {deviceConnection(selected, nowMs) === "online" ? (
                        <span className="text-success">Çevrimiçi</span>
                      ) : (
                        <span>{deviceConnection(selected, nowMs) === "never" ? "Henüz bağlanmadı" : "Çevrimdışı"}</span>
                      )}
                    </p>
                  )}
{attempted && errors.find(error => error.id === "claim-device") && <p id="claim-device-error" className="text-xs text-destructive">{errors.find(error => error.id === "claim-device")?.message}</p>}
                </div>



                <div className="space-y-2">
                  <Label htmlFor="claim-device-name">Panel adı</Label>
                  <Input id="claim-device-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Panel adı" />
                </div>

                {isIde && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="claim-user">Panel kullanıcı adı</Label>
                      <Input id="claim-user" aria-invalid={attempted && errors.some(error => error.id === "claim-user")} aria-describedby={attempted && errors.some(error => error.id === "claim-user") ? "claim-user-error" : undefined}
                        value={ideUser}
                        onChange={(e) => setIdeUser(e.target.value)}
                        placeholder="admin"
                        autoComplete="off"
                      />
{attempted && errors.find(error => error.id === "claim-user") && <p id="claim-user-error" className="text-xs text-destructive">{errors.find(error => error.id === "claim-user")?.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="claim-password">Panel şifresi</Label>
                      <PasswordField id="claim-password" aria-invalid={attempted && errors.some(error => error.id === "claim-password")} aria-describedby={attempted && errors.some(error => error.id === "claim-password") ? "claim-password-error" : undefined}
                        value={idePassword}
                        onChange={(e) => setIdePassword(e.target.value)}
                        placeholder="Panel şifresi"
                        autoComplete="off"
                      />
{attempted && errors.find(error => error.id === "claim-password") && <p id="claim-password-error" className="text-xs text-destructive">{errors.find(error => error.id === "claim-password")?.message}</p>}
                    </div>
                    <p className="sm:col-span-2 text-xs text-muted-foreground">
                      Panelin MQTT giriş bilgisi. Boş bırakılırsa cihaza komut gönderilemez ve
                      senkronizasyon takılı kalır.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="claim-zone">Bölge</Label>
                  <Select value={zoneChoice} onValueChange={setZoneChoice}>
                    <SelectTrigger id="claim-zone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NEW_ZONE}>+ Yeni bölge oluştur</SelectItem>
                      {projectZones.map((z) => (
                        <SelectItem key={z._id} value={z._id}>{z.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {zoneChoice === NEW_ZONE && (
                    <div className="space-y-1">
                    <Label htmlFor="claim-zone-name">Yeni bölge adı (zorunlu)</Label>
                    <Input
                      id="claim-zone-name"
                      aria-describedby="claim-zone-error"
                      aria-invalid={newZoneName.trim().toLocaleLowerCase("tr-TR") === name.trim().toLocaleLowerCase("tr-TR")}
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      placeholder="Örn. Giriş katı"
                    />
                    {(!newZoneName.trim() || newZoneName.trim().toLocaleLowerCase("tr-TR") === name.trim().toLocaleLowerCase("tr-TR")) && <p id="claim-zone-error" className="text-xs text-destructive">{!newZoneName.trim() ? "Yeni bölge adı girin veya mevcut bir bölge seçin." : "Bölge adı cihaz adıyla aynı olamaz."}</p>}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="claim-door-count">Kapı sayısı</Label>
                  <Input id="claim-door-count"
                    type="number"
                    min={1}
                    max={8}
                    value={doorCount}
                    onChange={(e) => setDoorCount(Math.max(1, Math.min(Number(e.target.value) || 1, 8)))}
                  />
                  <p className="text-xs text-muted-foreground">Panelin aktüatör sayısı (1–8). Her kapı bir IO'ya bağlanır.</p>
                </div>

                <div className="sticky bottom-0 flex justify-end gap-2 border-t border-line bg-surface py-4">
                  <Button type="button" variant="outline" onClick={close} disabled={submitting}>İptal</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Projeye ata
                  </Button>
                </div>
              </fieldset>
              </form>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
    {guard.dialog}
    </>
  );
}

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
import { toast } from "@/hooks/use-toast";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { computeDeviceStatus } from "@/lib/deviceStatus";

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
 * atayabilir; project_admin aktif projesine kilitli.
 */
export function ClaimDeviceDialog({ open, onClose, onSuccess }: ClaimDeviceDialogProps) {
  const { isSuperAdmin } = useProjectAccess();
  const { projectId: activeProjectId } = useActiveProject();

  const claimable = useQuery(api.adminDevices.listForClaim, open ? {} : "skip");
  const projects = useQuery(api.projects.list, open && isSuperAdmin ? {} : "skip");
  const zones = useQuery(api.zones.list, open ? {} : "skip");
  const claimDevice = useMutation(api.devices.claimDevice);

  const [selectedId, setSelectedId] = useState<Id<"adminDevices"> | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<Id<"projects"> | null>(null);
  const [name, setName] = useState("");
  const [doorCount, setDoorCount] = useState(4);
  const [zoneChoice, setZoneChoice] = useState<string>(NEW_ZONE);
  const [newZoneName, setNewZoneName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedId(null);
      setTargetProjectId(activeProjectId ?? null);
      setName("");
      setDoorCount(4);
      setZoneChoice(NEW_ZONE);
      setNewZoneName("");
      setSubmitting(false);
    }
  }, [open, activeProjectId]);

  const selected = useMemo<ClaimableDevice | null>(
    () => (claimable ?? []).find((d) => d._id === selectedId) ?? null,
    [claimable, selectedId],
  );

  // Cihaz seçilince varsayılanları doldur (isim, kapı sayısı, yeni bölge adı).
  const onSelectDevice = (id: Id<"adminDevices">) => {
    const dev = (claimable ?? []).find((d) => d._id === id);
    setSelectedId(id);
    setName(dev?.name ?? "");
    setDoorCount(dev?.ideDoorCount ?? 4);
    setNewZoneName(dev?.name ?? "");
  };

  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  const projectZones = (zones ?? []).filter(
    (z) => targetProjectId && z.projectId === targetProjectId,
  );

  const canSubmit =
    !!selectedId &&
    !!targetProjectId &&
    (zoneChoice === NEW_ZONE ? newZoneName.trim().length > 0 : true);

  const handleSubmit = async () => {
    if (!selectedId || !targetProjectId) return;
    setSubmitting(true);
    try {
      await claimDevice({
        adminDeviceId: selectedId,
        projectId: targetProjectId,
        name: name.trim() || undefined,
        ideDoorCount: doorCount,
        ...(zoneChoice === NEW_ZONE
          ? { newZoneName: newZoneName.trim() }
          : { zoneId: zoneChoice as Id<"zones"> }),
      });
      toast({ title: "Başarılı", description: "Cihaz projeye eklendi" });
      onSuccess();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cihaz eklenemedi";
      toast({ title: "Hata", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const loading = claimable === undefined;
  const empty = !loading && (claimable ?? []).length === 0;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent size="lg" className="p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle>Havuzdan Cihaz Ekle</SheetTitle>
          </SheetHeader>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin tarafından eklenmiş, henüz bir projeye atanmamış cihazlardan seçin.
          </p>
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-6 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : empty ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
                <Inbox className="h-8 w-8" />
                <p className="text-sm">Havuzda atanmamış cihaz yok.</p>
                <p className="text-xs">Yeni cihazlar Admin → Cihaz Yönetimi'nde UUID ile eklenir.</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Cihaz</Label>
                  <Select value={selectedId ?? undefined} onValueChange={(v) => onSelectDevice(v as Id<"adminDevices">)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Havuzdan bir cihaz seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {(claimable ?? []).map((d) => {
                        const online = computeDeviceStatus(d.lastSeen, nowMs) === "online";
                        return (
                          <SelectItem key={d._id} value={d._id}>
                            <span className="flex items-center gap-2">
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
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
                      {computeDeviceStatus(selected.lastSeen, nowMs) === "online" ? (
                        <span className="text-emerald-600">Online</span>
                      ) : (
                        <span>Offline (panel bağlanınca canlanır)</span>
                      )}
                    </p>
                  )}
                </div>

                {isSuperAdmin && (
                  <div className="space-y-2">
                    <Label>Proje</Label>
                    <Select
                      value={targetProjectId ?? undefined}
                      onValueChange={(v) => {
                        setTargetProjectId(v as Id<"projects">);
                        // Proje değişince eski projeye ait seçili bölge geçersiz → sıfırla.
                        setZoneChoice(NEW_ZONE);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Projeyi seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {(projects ?? []).map((p) => (
                          <SelectItem key={p._id} value={p._id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Panel adı</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Panel adı" />
                </div>

                <div className="space-y-2">
                  <Label>Bölge</Label>
                  <Select value={zoneChoice} onValueChange={setZoneChoice}>
                    <SelectTrigger>
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
                    <Input
                      value={newZoneName}
                      onChange={(e) => setNewZoneName(e.target.value)}
                      placeholder="Yeni bölge adı"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Kapı sayısı</Label>
                  <Input
                    type="number"
                    min={1}
                    max={8}
                    value={doorCount}
                    onChange={(e) => setDoorCount(Math.max(1, Math.min(Number(e.target.value) || 1, 8)))}
                  />
                  <p className="text-xs text-muted-foreground">Panelin aktüatör sayısı (1–8). Her kapı bir IO'ya bağlanır.</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={onClose} disabled={submitting}>İptal</Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Projeye Ekle
                  </Button>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

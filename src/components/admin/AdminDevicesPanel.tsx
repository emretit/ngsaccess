import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { notify } from "@/lib/notify";
import { AdminDeviceDialog } from "@/components/admin/AdminDeviceDialog";
import { computeDeviceStatus } from "@/lib/deviceStatus";
import { useNow } from "@/hooks/useNow";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AdminDataBoundary } from "./components/AdminDataBoundary";

type AdminDevice = FunctionReturnType<typeof api.adminDevices.list>[number];

function AdminDevicesContent() {
  const nowMs = useNow();
  // Hedef kapanış animasyonu boyunca korunur; diyalog yalnız deleteOpen ile kapanır.
  const [deleteDevice, setDeleteDevice] = useState<AdminDevice | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<AdminDevice | null>(null);
  const adminDevices = useQuery(api.adminDevices.list);
  const removeDevice = useMutation(api.adminDevices.remove);
  const backfill = useMutation(api.adminDevices.backfillExisting);

  const { run: handleBackfill, pending: backfilling } = useAsyncAction(
    async () => {
      const count = await backfill({});
      notify.success(
        "Senkronize",
        count === 0
          ? "Tüm cihazlar zaten kayıtlı"
          : `${count} cihaz senkronize edildi`,
      );
    },
    { error: "Senkronizasyon başarısız" },
  );

  const isLoading = adminDevices === undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tüm kayıtlı fiziksel cihazlar. Projeye atamak için{" "}
          <span className="font-medium">Cihazlar → Havuzdan Ekle</span>'yi
          kullanın.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleBackfill()}
            disabled={backfilling}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Senkronize Et
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Cihaz Ekle
          </Button>
        </div>
      </div>

      {isLoading ? (
        <SectionSkeleton label="Cihazlar yükleniyor" rows={5} />
      ) : adminDevices.length === 0 ? (
        <EmptyState
          title="Envanterde kayıtlı cihaz yok"
          description="Cihaz Ekle ile panel UUID'sini kaydedin."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cihaz Adı</TableHead>
                <TableHead>UUID</TableHead>
                <TableHead>Marka</TableHead>
                <TableHead>Kapı</TableHead>
                <TableHead>Bağlantı</TableHead>
                <TableHead>Proje</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminDevices.map((device: AdminDevice) => {
                const online =
                  computeDeviceStatus(device.lastSeen, nowMs) === "online";
                const isAssigned = !!device.assignedDeviceId;
                return (
                  <TableRow
                    key={device._id}
                    className="cursor-pointer"
                    onClick={() => setEditDevice(device)}
                  >
                    <TableCell className="font-medium">{device.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {device.ideUuid ?? device.deviceSerial ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {device.brand ?? "ide_smart"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {device.ideDoorCount ?? 4}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={online ? "success" : "neutral"}>
                        {online ? "Çevrimiçi" : "Çevrimdışı"}
                      </StatusBadge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {device.lastSeen &&
                        Number.isFinite(Date.parse(device.lastSeen))
                          ? `Son görülme ${Math.max(0, Math.floor((nowMs - Date.parse(device.lastSeen)) / 60_000))} dk önce`
                          : "Henüz görülmedi"}
                      </p>
                    </TableCell>
                    <TableCell>
                      {isAssigned ? (
                        <span className="text-xs font-medium text-foreground">
                          {device.assignedProjectName ?? "Atanmış"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={`${device.name} cihazını envanterden kaldır`}
                        title={
                          isAssigned
                            ? "Projeden çıkar ve envanterden kaldır"
                            : "Envanterden kaldır"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteDevice(device);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDestructive
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Cihaz envanterden kaldırılsın mı?"
        objectName={deleteDevice?.name ?? "Cihaz"}
        effects={
          deleteDevice?.assignedDeviceId
            ? [
                `Cihaz ${deleteDevice.assignedProjectName ?? "atanmış olduğu proje"} kapsamından çıkarılır.`,
                "Kapıları silinir; kart okuma geçmişi korunur.",
                "Cihaz envanter kaydı kaldırılır.",
              ]
            : ["Cihaz envanter kaydı kaldırılır."]
        }
        confirmLabel="Envanterden kaldır"
        onConfirm={async () => {
          if (!deleteDevice) throw new Error("Kaldırılacak cihaz seçilmedi");
          await removeDevice({ adminDeviceId: deleteDevice._id });
          notify.success("Cihaz envanterden kaldırıldı");
        }}
      />
      <AdminDeviceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => setDialogOpen(false)}
      />

      <AdminDeviceDialog
        open={editDevice !== null}
        device={editDevice}
        onClose={() => setEditDevice(null)}
        onSuccess={() => setEditDevice(null)}
      />
    </div>
  );
}

export function AdminDevicesPanel() {
  return (
    <AdminDataBoundary label="Cihazlar">
      <AdminDevicesContent />
    </AdminDataBoundary>
  );
}

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
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AdminDeviceDialog } from "@/components/admin/AdminDeviceDialog";
import { computeDeviceStatus } from "@/lib/deviceStatus";
import { toast } from "@/hooks/use-toast";

type AdminDevice = FunctionReturnType<typeof api.adminDevices.list>[number];

const nowMs = Date.now();

export function AdminDevicesPanel() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const adminDevices = useQuery(api.adminDevices.list);
  const removeDevice = useMutation(api.adminDevices.remove);
  const backfill = useMutation(api.adminDevices.backfillExisting);

  const handleBackfill = async () => {
    try {
      const count = await backfill({});
      if (count === 0) {
        toast({ title: "Senkronize", description: "Tüm cihazlar zaten kayıtlı" });
      } else {
        toast({ title: "Başarılı", description: `${count} cihaz senkronize edildi` });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Senkronizasyon başarısız";
      toast({ title: "Hata", description: message, variant: "destructive" });
    }
  };

  const handleDelete = async (device: AdminDevice) => {
    const assigned = !!device.assignedDeviceId;
    const message = assigned
      ? `"${device.name}" cihazı ${device.assignedProjectName ?? "bir projeye"} atanmış. Silerseniz projeden de çıkarılır; kapıları ve okuma geçmişi silinir. Devam edilsin mi?`
      : `"${device.name}" cihazını envanterden kaldırmak istediğinize emin misiniz?`;
    if (!confirm(message)) return;
    try {
      await removeDevice({ adminDeviceId: device._id });
      toast({ title: "Başarılı", description: "Cihaz envanterden kaldırıldı" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cihaz silinemedi";
      toast({ title: "Hata", description: message, variant: "destructive" });
    }
  };

  const isLoading = adminDevices === undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Tüm kayıtlı fiziksel cihazlar. Projeye atamak için{" "}
          <span className="font-medium">Cihazlar → Havuzdan Ekle</span>'yi kullanın.
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleBackfill}>
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
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : adminDevices.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground text-sm">
          Envanterde kayıtlı cihaz yok. "Cihaz Ekle" ile UUID girin.
        </div>
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
                const online = computeDeviceStatus(device.lastSeen, nowMs) === "online";
                const isAssigned = !!device.assignedDeviceId;
                return (
                  <TableRow key={device._id}>
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
                      <span className="flex items-center gap-1.5 text-xs">
                        <span
                          className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                        />
                        {online ? "Online" : "Offline"}
                      </span>
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
                        title={isAssigned ? "Projeden çıkar ve envanterden kaldır" : "Envanterden kaldır"}
                        onClick={() => handleDelete(device)}
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

      <AdminDeviceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={() => setDialogOpen(false)}
      />
    </div>
  );
}

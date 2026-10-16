"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimeSchedule } from "@/components/access-control/unified/components/TimeSchedule";
import { ZoneDeviceTree } from "@/components/access-control/unified/components/ZoneDeviceTree";
import { DEFAULT_WORKDAYS } from "@/components/access-control/unified/components/weekdays";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { notify } from "@/lib/notify";
import { accessScheduleError } from "../../../convex/lib/accessRuleUx";
import { Loader2 } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";

interface ZoneFormData {
  name: string;
  selected_devices: string[];
  selected_doors: string[];
  start_time: string;
  end_time: string;
  days: string[];
}

const emptyZone = (): ZoneFormData => ({
  name: "",
  selected_devices: [],
  selected_doors: [],
  start_time: "",
  end_time: "",
  days: DEFAULT_WORKDAYS,
});

interface VisitorZoneDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

// Ziyaretçi bölgesi = targetType="visitor" bir accessRule. Kapılar (deviceIds) + günlük
// saat penceresi tanımlanır; üye eklenmez (ziyaretçiler Ziyaretçiler listesinden bağlanır).
export default function VisitorZoneDialog({ isOpen, onClose }: VisitorZoneDialogProps) {
  const { projectId } = useActiveProject();
  const [formData, setFormData] = useState<ZoneFormData>(emptyZone);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const createRule = useMutation(api.accessRules.createWithGroups);

  const save = useAsyncAction(async () => {
    await createRule({
      name: formData.name.trim(), projectId, targetType: "visitor",
      startTime: formData.start_time || undefined, endTime: formData.end_time || undefined,
      days: formData.days, accessDirection: "both",
      deviceIds: formData.selected_devices as Id<"devices">[],
      doorIds: formData.selected_doors as Id<"doors">[],
    });
  }, { success: "Ziyaretçi bölgesi oluşturuldu", error: "Bölge oluşturulamadı" });
  const isSaving = save.pending;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { notify.error("Bölge adı girin"); return; }
    if (!formData.selected_devices.length && !formData.selected_doors.length) { notify.error("En az bir kapı/cihaz seçin"); return; }
    const error = accessScheduleError({ days: formData.days, startTime: formData.start_time, endTime: formData.end_time });
    setScheduleError(error);
    if (error) { requestAnimationFrame(() => document.getElementById("start_time")?.focus()); return; }
    if (await save.run()) { setFormData(emptyZone()); onClose(); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Ziyaretçi Bölgesi</DialogTitle>
          <DialogDescription>
            Ziyaretçilerin geçebileceği kapıları ve günlük saat penceresini belirleyin. Üyeler
            Ziyaretçiler listesinden eklenir.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="zone_name">Bölge Adı</Label>
            <Input
              id="zone_name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="örn. Ziyaretçi - Giriş / Lobi"
              required
            />
          </div>

          <TimeSchedule formData={formData} setFormData={setFormData} />
          {scheduleError && <p role="alert" className="text-sm text-destructive">{scheduleError}</p>}
          <ZoneDeviceTree formData={formData} setFormData={setFormData} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              İptal
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Kaydediliyor
                </>
              ) : (
                "Oluştur"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

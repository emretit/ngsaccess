import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function WorkScheduleForm() {
  const { projectId, loading: projectLoading } = useActiveProject();
  const { toast } = useToast();

  const settings = useQuery(
    api.settings.getWork,
    projectLoading ? "skip" : { projectId }
  );
  const upsert = useMutation(api.settings.upsertWork);

  const [workStartTime, setWorkStartTime] = useState("09:00");
  const [workEndTime, setWorkEndTime] = useState("18:00");
  const [lunchBreakStart, setLunchBreakStart] = useState("12:00");
  const [lunchBreakEnd, setLunchBreakEnd] = useState("13:00");
  const [maxLateMinutes, setMaxLateMinutes] = useState(15);
  const [earlyExitToleranceMinutes, setEarlyExitToleranceMinutes] = useState(15);
  const [annualOvertimeLimitHours, setAnnualOvertimeLimitHours] = useState(270);
  const [overtimeStartToleranceMinutes, setOvertimeStartToleranceMinutes] = useState(15);
  const [monthlyHoursBase, setMonthlyHoursBase] = useState(225);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setWorkStartTime(settings.workStartTime ?? "09:00");
    setWorkEndTime(settings.workEndTime ?? "18:00");
    setLunchBreakStart(settings.lunchBreakStart ?? "12:00");
    setLunchBreakEnd(settings.lunchBreakEnd ?? "13:00");
    setMaxLateMinutes(settings.maxLateMinutes ?? 15);
    setEarlyExitToleranceMinutes(settings.earlyExitToleranceMinutes ?? 15);
    setAnnualOvertimeLimitHours(settings.annualOvertimeLimitHours ?? 270);
    setOvertimeStartToleranceMinutes(settings.overtimeStartToleranceMinutes ?? 15);
    setMonthlyHoursBase(settings.monthlyHoursBase ?? 225);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsert({
        projectId,
        workStartTime,
        workEndTime,
        lunchBreakStart,
        lunchBreakEnd,
        maxLateMinutes,
        earlyExitToleranceMinutes,
        annualOvertimeLimitHours,
        overtimeStartToleranceMinutes,
        monthlyHoursBase,
      });
      toast({
        title: "Kaydedildi",
        description: "Çalışma saatleri güncellendi.",
      });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Kayıt başarısız",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Çalışma Saatleri</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="workStart">İş Başlangıç Saati</Label>
            <Input
              id="workStart"
              type="time"
              value={workStartTime}
              onChange={(e) => setWorkStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workEnd">İş Bitiş Saati</Label>
            <Input
              id="workEnd"
              type="time"
              value={workEndTime}
              onChange={(e) => setWorkEndTime(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="breakStart">Mola Başlangıç</Label>
            <Input
              id="breakStart"
              type="time"
              value={lunchBreakStart}
              onChange={(e) => setLunchBreakStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="breakEnd">Mola Bitiş</Label>
            <Input
              id="breakEnd"
              type="time"
              value={lunchBreakEnd}
              onChange={(e) => setLunchBreakEnd(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="maxLate">Maksimum Geç Kalma (dk)</Label>
            <Input
              id="maxLate"
              type="number"
              min={0}
              value={maxLateMinutes}
              onChange={(e) => setMaxLateMinutes(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="earlyExit">Erken Çıkış Toleransı (dk)</Label>
            <Input
              id="earlyExit"
              type="number"
              min={0}
              value={earlyExitToleranceMinutes}
              onChange={(e) =>
                setEarlyExitToleranceMinutes(Number(e.target.value))
              }
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="annualLimit">Yıllık Fazla Mesai Sınırı (saat)</Label>
          <Input
            id="annualLimit"
            type="number"
            min={0}
            value={annualOvertimeLimitHours}
            onChange={(e) =>
              setAnnualOvertimeLimitHours(Number(e.target.value))
            }
          />
          <p className="text-xs text-muted-foreground">
            4857 sayılı İş Kanunu: yıllık 270 saat üst sınır.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="overtimeStartTolerance">
              Mesai Başlangıç Toleransı (dk)
            </Label>
            <Input
              id="overtimeStartTolerance"
              type="number"
              min={0}
              value={overtimeStartToleranceMinutes}
              onChange={(e) =>
                setOvertimeStartToleranceMinutes(Number(e.target.value))
              }
            />
            <p className="text-xs text-muted-foreground">
              Vardiya bitiminden sonra bu süre içinde çıkış mesai sayılmaz.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyHoursBase">Aylık Çalışma Saati Tabanı</Label>
            <Input
              id="monthlyHoursBase"
              type="number"
              min={1}
              value={monthlyHoursBase}
              onChange={(e) => setMonthlyHoursBase(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Aylık maaş → saatlik ücret dönüşümünde kullanılır (default 225).
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Değişiklikleri Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}

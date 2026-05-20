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

export function OvertimeSettingsForm() {
  const { projectId, loading: projectLoading } = useActiveProject();
  const { toast } = useToast();

  const workSettings = useQuery(
    api.settings.getWork,
    projectLoading ? "skip" : { projectId }
  );
  const rates = useQuery(
    api.holidays.getOvertimeRates,
    projectLoading ? "skip" : { projectId }
  );
  const upsertWork = useMutation(api.settings.upsertWork);
  const upsertRates = useMutation(api.holidays.upsertOvertimeRates);

  const [annualOvertimeLimitHours, setAnnualOvertimeLimitHours] = useState(270);
  const [overtimeStartToleranceMinutes, setOvertimeStartToleranceMinutes] = useState(15);
  const [monthlyHoursBase, setMonthlyHoursBase] = useState(225);

  const [weekday, setWeekday] = useState(1.5);
  const [weekend, setWeekend] = useState(2.0);
  const [holiday, setHoliday] = useState(2.0);
  const [night, setNight] = useState(1.5);
  const [nightStart, setNightStart] = useState("22:00");
  const [nightEnd, setNightEnd] = useState("06:00");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workSettings) return;
    setAnnualOvertimeLimitHours(workSettings.annualOvertimeLimitHours ?? 270);
    setOvertimeStartToleranceMinutes(workSettings.overtimeStartToleranceMinutes ?? 15);
    setMonthlyHoursBase(workSettings.monthlyHoursBase ?? 225);
  }, [workSettings]);

  useEffect(() => {
    if (!rates) return;
    setWeekday(rates.weekdayMultiplier);
    setWeekend(rates.weekendMultiplier);
    setHoliday(rates.holidayMultiplier);
    setNight(rates.nightShiftMultiplier);
    setNightStart(rates.nightShiftStart);
    setNightEnd(rates.nightShiftEnd);
  }, [rates]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        upsertWork({
          projectId,
          annualOvertimeLimitHours,
          overtimeStartToleranceMinutes,
          monthlyHoursBase,
        }),
        upsertRates({
          projectId,
          weekdayMultiplier: weekday,
          weekendMultiplier: weekend,
          holidayMultiplier: holiday,
          nightShiftMultiplier: night,
          nightShiftStart: nightStart,
          nightShiftEnd: nightEnd,
        }),
      ]);
      toast({
        title: "Kaydedildi",
        description: "Mesai ayarları ve çarpanlar güncellendi.",
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
        <CardTitle>Mesai Ayarları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Limitler ve Bazlar
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="annualLimit">Yıllık Sınır (saat)</Label>
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
            <div className="space-y-2">
              <Label htmlFor="overtimeStartTolerance">
                Başlangıç Toleransı (dk)
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
                Vardiyada boşsa global kullanılır.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthlyHoursBase">Aylık Saat Tabanı</Label>
              <Input
                id="monthlyHoursBase"
                type="number"
                min={1}
                value={monthlyHoursBase}
                onChange={(e) => setMonthlyHoursBase(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Aylık maaş → saatlik ücret (default 225).
              </p>
            </div>
          </div>
        </section>

        <div className="border-t" />

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Çarpanlar
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weekday">Hafta İçi</Label>
              <Input
                id="weekday"
                type="number"
                step="0.1"
                min={1}
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekend">Hafta Tatili</Label>
              <Input
                id="weekend"
                type="number"
                step="0.1"
                min={1}
                value={weekend}
                onChange={(e) => setWeekend(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="holiday">Resmi Tatil</Label>
              <Input
                id="holiday"
                type="number"
                step="0.1"
                min={1}
                value={holiday}
                onChange={(e) => setHoliday(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="night">Gece Vardiyası</Label>
              <Input
                id="night"
                type="number"
                step="0.1"
                min={1}
                value={night}
                onChange={(e) => setNight(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nightStart">Gece Başlangıç</Label>
              <Input
                id="nightStart"
                type="time"
                value={nightStart}
                onChange={(e) => setNightStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nightEnd">Gece Bitiş</Label>
              <Input
                id="nightEnd"
                type="time"
                value={nightEnd}
                onChange={(e) => setNightEnd(e.target.value)}
              />
            </div>
          </div>
        </section>

        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Değişiklikleri Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}

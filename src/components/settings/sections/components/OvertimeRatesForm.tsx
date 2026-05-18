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

export function OvertimeRatesForm() {
  const { projectId, loading: projectLoading } = useActiveProject();
  const { toast } = useToast();

  const rates = useQuery(
    api.holidays.getOvertimeRates,
    projectLoading ? "skip" : { projectId }
  );
  const upsert = useMutation(api.holidays.upsertOvertimeRates);

  const [weekday, setWeekday] = useState(1.5);
  const [weekend, setWeekend] = useState(2.0);
  const [holiday, setHoliday] = useState(2.0);
  const [night, setNight] = useState(1.5);
  const [nightStart, setNightStart] = useState("22:00");
  const [nightEnd, setNightEnd] = useState("06:00");
  const [saving, setSaving] = useState(false);

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
      await upsert({
        projectId,
        weekdayMultiplier: weekday,
        weekendMultiplier: weekend,
        holidayMultiplier: holiday,
        nightShiftMultiplier: night,
        nightShiftStart: nightStart,
        nightShiftEnd: nightEnd,
      });
      toast({
        title: "Kaydedildi",
        description: "Fazla mesai oranları güncellendi.",
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
        <CardTitle>Fazla Mesai Oranları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="weekday">Hafta İçi Çarpan</Label>
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
            <Label htmlFor="weekend">Hafta Tatili Çarpan</Label>
            <Input
              id="weekend"
              type="number"
              step="0.1"
              min={1}
              value={weekend}
              onChange={(e) => setWeekend(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="holiday">Resmi Tatil Çarpan</Label>
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
            <Label htmlFor="night">Gece Vardiyası Çarpan</Label>
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
            <Label htmlFor="nightStart">Gece Vardiyası Başlangıç</Label>
            <Input
              id="nightStart"
              type="time"
              value={nightStart}
              onChange={(e) => setNightStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nightEnd">Gece Vardiyası Bitiş</Label>
            <Input
              id="nightEnd"
              type="time"
              value={nightEnd}
              onChange={(e) => setNightEnd(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Çarpanları Kaydet
        </Button>
      </CardContent>
    </Card>
  );
}

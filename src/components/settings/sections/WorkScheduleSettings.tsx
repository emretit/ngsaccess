
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function WorkScheduleSettings() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Çalışma Saatleri Ayarları</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="workStart">İş Başlangıç Saati</Label>
            <Input id="workStart" type="time" defaultValue="09:00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="workEnd">İş Bitiş Saati</Label>
            <Input id="workEnd" type="time" defaultValue="18:00" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="breakStart">Mola Başlangıç</Label>
            <Input id="breakStart" type="time" defaultValue="12:00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="breakEnd">Mola Bitiş</Label>
            <Input id="breakEnd" type="time" defaultValue="13:00" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="maxLate">Maksimum Geç Kalma (Dakika)</Label>
          <Input id="maxLate" type="number" defaultValue="15" />
        </div>
        <Button>Değişiklikleri Kaydet</Button>
      </CardContent>
    </Card>
  );
}

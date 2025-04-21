
import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, X, Clock } from "lucide-react";

interface UnifiedRuleFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const DAYS = [
  { key: "paz", label: "Paz" },
  { key: "sal", label: "Sal" },
  { key: "çar", label: "Çar" },
  { key: "per", label: "Per" },
  { key: "cum", label: "Cum" },
  { key: "cmt", label: "Cum" },
  { key: "pzr", label: "Paz" },
];

export function UnifiedRuleForm({ open, onOpenChange }: UnifiedRuleFormProps) {
  const [name, setName] = useState("");
  const [departmentOrPerson, setDepartmentOrPerson] = useState("");
  const [doors, setDoors] = useState<string[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [days, setDays] = useState<string[]>(["paz", "sal", "çar", "per", "cum"]);
  const [isActive, setIsActive] = useState(true);

  function handleToggleDay(day: string) {
    setDays(d =>
      d.includes(day) ? d.filter((x) => x !== day) : [...d, day]
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-visible">
        <div className="flex justify-between items-center pl-8 pr-8 pt-8 pb-0">
          <span className="text-xl font-semibold">Yeni Kural Ekle</span>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
        {/* Form */}
        <form className="px-8 pt-2 pb-6 space-y-7">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm">Kural Adı</label>
              <Input
                placeholder="Örn: Mesai Saatleri"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm">Departman ve Kişi Seçimi</label>
              <Button
                variant="outline"
                type="button"
                className="justify-between"
                // Placeholder for department/person picker
              >
                <span className="text-muted-foreground">{departmentOrPerson || "Seçim yapın"}</span>
                <span />
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm">Kapı ve Bölge Seçimi</label>
            <Button
              variant="outline"
              className="justify-between"
              type="button"
              // Placeholder for door picker
            >
              <span className="text-muted-foreground">Erişim verilecek kapıları seçin</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm">Başlangıç Saati</label>
              <div className="flex items-center">
                <Input
                  type="time"
                  className="bg-white"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm">Bitiş Saati</label>
              <div className="flex items-center">
                <Input
                  type="time"
                  className="bg-white"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
                <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-[22px]">
              <label className="font-medium text-sm mr-2">Durum</label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="ml-1">{isActive ? "Aktif" : "Pasif"}</span>
            </div>
          </div>

          <div>
            <label className="font-medium text-sm mb-1 block">Günler</label>
            <div className="flex gap-2 flex-wrap">
              {/* Days as pill buttons */}
              <Button
                type="button"
                variant={days.includes("paz") ? "default" : "outline"}
                onClick={() => handleToggleDay("paz")}
                className="rounded-full min-w-12"
              >Paz</Button>
              <Button
                type="button"
                variant={days.includes("sal") ? "default" : "outline"}
                onClick={() => handleToggleDay("sal")}
                className="rounded-full min-w-12"
              >Sal</Button>
              <Button
                type="button"
                variant={days.includes("çar") ? "default" : "outline"}
                onClick={() => handleToggleDay("çar")}
                className="rounded-full min-w-12"
              >Çar</Button>
              <Button
                type="button"
                variant={days.includes("per") ? "default" : "outline"}
                onClick={() => handleToggleDay("per")}
                className="rounded-full min-w-12"
              >Per</Button>
              <Button
                type="button"
                variant={days.includes("cum") ? "default" : "outline"}
                onClick={() => handleToggleDay("cum")}
                className="rounded-full min-w-12"
              >Cum</Button>
              <Button
                type="button"
                variant={days.includes("cmt") ? "default" : "outline"}
                onClick={() => handleToggleDay("cmt")}
                className="rounded-full min-w-12"
              >Cmt</Button>
              <Button
                type="button"
                variant={days.includes("pzr") ? "default" : "outline"}
                onClick={() => handleToggleDay("pzr")}
                className="rounded-full min-w-12"
              >Paz</Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              İptal
            </Button>
            <Button type="submit" className="flex gap-2 items-center">
              <Save className="w-4 h-4 mr-1" />
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

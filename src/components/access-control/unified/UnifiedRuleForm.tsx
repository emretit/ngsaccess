
import { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, X, Clock } from "lucide-react";
import DepartmentEmployeeSelector from "./DepartmentEmployeeSelector";

interface UnifiedRuleFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface DepartmentEmployeeSelection {
  type: "department" | "employee";
  id: number;
  name: string;
}

const DAYS = [
  { key: "paz", label: "Paz" },
  { key: "sal", label: "Sal" },
  { key: "çar", label: "Çar" },
  { key: "per", label: "Per" },
  { key: "cum", label: "Cum" },
  { key: "cmt", label: "Cmt" },
  { key: "pzr", label: "Pzr" },
];

export function UnifiedRuleForm({ open, onOpenChange }: UnifiedRuleFormProps) {
  const [name, setName] = useState("");
  // Çoklu seçim olacak şekilde güncellendi:
  const [selection, setSelection] = useState<DepartmentEmployeeSelection[]>([]);
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

  // onChange fonksiyonu artık dizi ile çalışıyor:
  const handleSelectionChange = (newSelection: DepartmentEmployeeSelection[]) => {
    setSelection(newSelection);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-visible">
        <div className="flex justify-between items-center px-8 pt-8 pb-2">
          <h2 className="text-2xl font-semibold">Yeni Kural Ekle</h2>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-red-600 hover:text-white"
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-6 h-6" />
          </Button>
        </div>
        {/* Form */}
        <form className="px-8 pt-3 pb-8 space-y-8" autoComplete="off">
          {/* Rule Name and Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="ruleName" className="font-medium text-sm">
                Kural Adı <span className="text-muted-foreground">(örneğin: Mesai Saatleri)</span>
              </label>
              <Input
                id="ruleName"
                placeholder="Kural adını girin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="font-medium text-sm">
                Departman ve Kişi Seçimi
              </label>
              <DepartmentEmployeeSelector
                value={selection}
                onChange={handleSelectionChange}
              />
              <p className="text-xs text-muted-foreground mt-1">
                İzin vermek istediğiniz departman ve personeli seçin. (Çoklu seçim desteklenir)
              </p>
            </div>
          </div>
          {/* Door Selection */}
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm">
              Kapı ve Bölge Seçimi
            </label>
            <Button
              variant="outline"
              className="justify-between max-w-md text-sm"
              type="button"
              // Placeholder - no actual picker logic in given code
            >
              <span className={doors.length > 0 ? '' : 'text-muted-foreground'}>
                {doors.length > 0 
                  ? `${doors.length} kapı seçildi`
                  : 'Erişim verilecek kapıları seçin'}
              </span>
            </Button>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Erişim izni verilmek istenen kapıları seçin.
            </p>
          </div>

          {/* Time and Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-end">
            <div className="flex flex-col gap-2 max-w-xs">
              <label htmlFor="startTime" className="font-medium text-sm">
                Başlangıç Saati
              </label>
              <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white">
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="border-none p-0 bg-transparent"
                  required
                />
                <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex flex-col gap-2 max-w-xs">
              <label htmlFor="endTime" className="font-medium text-sm">
                Bitiş Saati
              </label>
              <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white">
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="border-none p-0 bg-transparent"
                  required
                />
                <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-4 sm:mt-6">
              <label className="font-medium text-sm" htmlFor="statusSwitch">
                Durum
              </label>
              <Switch
                id="statusSwitch"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <span className="ml-1 font-semibold text-sm">
                {isActive ? "Aktif" : "Pasif"}
              </span>
            </div>
          </div>

          {/* Days */}
          <div>
            <label className="font-medium text-sm mb-2 block">Günler</label>
            <div className="flex gap-3 flex-wrap">
              {DAYS.map((day) => (
                <Button
                  key={day.key}
                  type="button"
                  variant={days.includes(day.key) ? "default" : "outline"}
                  onClick={() => handleToggleDay(day.key)}
                  className="rounded-full min-w-[48px] px-3 py-1 text-base"
                >
                  {day.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Erişim izni verilecek günleri seçin.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 mt-6">
            <Button 
              type="button"
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button 
              type="submit" 
              className="flex gap-2 items-center"
            >
              <Save className="w-4 h-4" />
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


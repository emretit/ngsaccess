
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

  const handleSelectionChange = (newSelection: DepartmentEmployeeSelection[]) => {
    setSelection(newSelection);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-visible rounded-xl shadow-lg border bg-gradient-to-br from-white to-gray-50 dark:from-card dark:to-[#1A1F2C]">
        <div className="flex justify-between items-center px-6 pt-5 pb-1 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 tracking-tight">
            Yeni Kural Ekle
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-red-600 hover:text-white transition-colors"
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        {/* Form */}
        <form className="px-6 pt-2 pb-5 space-y-6 text-[13px]" autoComplete="off">
          {/* Rule Name and Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ruleName" className="font-medium text-xs mb-0.5 text-gray-700 dark:text-white">
                Kural Adı <span className="text-muted-foreground font-normal">(örn: Mesai Saatleri)</span>
              </label>
              <Input
                id="ruleName"
                placeholder="Kural adını girin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-white/90 text-xs py-1.5 px-2 rounded focus:ring-1 focus:ring-primary/50 border-gray-200"
                autoFocus
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="font-medium text-xs mb-0.5 text-gray-700 dark:text-white">
                Departman & Kişi Seçimi
              </label>
              <div className="rounded-md border border-gray-200 bg-white/80 px-2 py-1.5">
                <DepartmentEmployeeSelector
                  value={selection}
                  onChange={handleSelectionChange}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                İzin vermek istediğiniz departman ve personeli seçin.
              </p>
            </div>
          </div>
          {/* Door Selection */}
          <div className="flex flex-col gap-1.5">
            <label className="font-medium text-xs text-gray-700 dark:text-white">
              Kapı & Bölge Seçimi
            </label>
            <Button
              variant="outline"
              className="justify-between max-w-sm text-xs py-1 px-2"
              type="button"
            >
              <span className={doors.length > 0 ? '' : 'text-muted-foreground'}>
                {doors.length > 0 
                  ? `${doors.length} kapı seçildi`
                  : 'Erişim verilecek kapıları seçin'}
              </span>
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-md">
              Erişim izni verilmek istenen kapıları seçin.
            </p>
          </div>

          {/* Saat ve Durum */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
            <div className="flex flex-col gap-1.5 max-w-xs">
              <label htmlFor="startTime" className="font-medium text-xs text-gray-700 dark:text-white">
                Başlangıç Saati
              </label>
              <div className="flex items-center border border-gray-200 rounded px-2 py-1 bg-white/90">
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="border-none p-0 bg-transparent text-xs"
                  required
                />
                <Clock className="ml-2 w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 max-w-xs">
              <label htmlFor="endTime" className="font-medium text-xs text-gray-700 dark:text-white">
                Bitiş Saati
              </label>
              <div className="flex items-center border border-gray-200 rounded px-2 py-1 bg-white/90">
                <Input
                  id="endTime"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="border-none p-0 bg-transparent text-xs"
                  required
                />
                <Clock className="ml-2 w-3.5 h-3.5 text-muted-foreground" />
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-5 sm:mt-6">
              <label className="font-medium text-xs" htmlFor="statusSwitch">
                Durum
              </label>
              <Switch
                id="statusSwitch"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
              <span className="ml-1 font-semibold text-xs">
                {isActive ? "Aktif" : "Pasif"}
              </span>
            </div>
          </div>

          {/* Günler */}
          <div>
            <label className="font-medium text-xs mb-2 block text-gray-700 dark:text-white">Günler</label>
            <div className="flex gap-2.5 flex-wrap">
              {DAYS.map((day) => (
                <Button
                  key={day.key}
                  type="button"
                  size="sm"
                  variant={days.includes(day.key) ? "default" : "outline"}
                  onClick={() => handleToggleDay(day.key)}
                  className="rounded-full min-w-[36px] px-2 py-1 text-xs shadow-sm"
                >
                  {day.label}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-md">
              Erişim izni verilecek günleri seçin.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mt-2">
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              className="text-gray-600"
              onClick={() => onOpenChange(false)}
            >
              İptal
            </Button>
            <Button 
              type="submit" 
              size="sm"
              className="flex gap-1.5 items-center text-xs"
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

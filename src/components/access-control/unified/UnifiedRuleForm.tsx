
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
      <DialogContent
        className="w-full max-w-lg p-0 border-0 bg-transparent shadow-none"
        style={{
          minWidth: 380,
          maxWidth: 520,
        }}
      >
        <div className="glass-card relative rounded-3xl w-full p-0 overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-[#FAE8E8] to-[#F1F0FB] dark:from-[#28213c] dark:to-[#260F19] px-8 py-5 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-white">Yeni Kural Oluştur</h2>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-red-500/90 focus-visible:ring-2 focus-visible:ring-primary"
              type="button"
              aria-label="Kapat"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <form
            className="px-8 py-7 md:py-8 space-y-7 text-[15px] bg-white/80 dark:bg-[#1A1F2C]/60"
            autoComplete="off"
          >
            {/* Kural Adı ve Departman/Personel */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label htmlFor="ruleName" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                  Kural Adı <span className="text-muted-foreground">(örn: Mesai Saatleri)</span>
                </label>
                <Input
                  id="ruleName"
                  placeholder="Kural adını girin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-background text-base shadow-sm"
                  autoFocus
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">Departman & Personel</label>
                <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/40 px-2 py-1.5">
                  <DepartmentEmployeeSelector
                    value={selection}
                    onChange={handleSelectionChange}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  İzin vermek istediğiniz departman ve/veya personeli seçin
                </p>
              </div>
            </div>
            {/* Kapı/Bölge Seçimi */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">Kapı & Bölge</label>
              <Button
                variant="outline"
                className="justify-between gap-2 w-full max-w-md text-base mt-1 bg-white/90 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700"
                type="button"
              >
                <span className={doors.length > 0 ? "" : "text-muted-foreground"}>
                  {doors.length > 0 ? `${doors.length} kapı seçildi` : "Erişim verilecek kapıları seçin"}
                </span>
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Erişim izni verilecek kapı/bölgeleri seçin.
              </p>
            </div>
            {/* Saat aralığı, durum */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="space-y-2">
                <label htmlFor="startTime" className="text-xs font-semibold text-gray-500 dark:text-gray-300">Başlangıç</label>
                <div className="flex items-center border rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/40 gap-1 transition-all">
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border-none bg-transparent outline-none px-0 py-0 text-base"
                    required
                  />
                  <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="endTime" className="text-xs font-semibold text-gray-500 dark:text-gray-300">Bitiş</label>
                <div className="flex items-center border rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/40 gap-1 transition-all">
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="border-none bg-transparent outline-none px-0 py-0 text-base"
                    required
                  />
                  <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center gap-2 h-full mt-2 md:mt-7">
                <label className="font-semibold text-xs text-gray-500 dark:text-gray-300" htmlFor="statusSwitch">
                  Durum
                </label>
                <Switch
                  id="statusSwitch"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <span className="font-semibold text-xs ml-1">{isActive ? "Aktif" : "Pasif"}</span>
              </div>
            </div>
            {/* Günler */}
            <div>
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-300 mb-2 block">Günler</label>
              <div className="flex gap-2 flex-wrap mb-1">
                {DAYS.map((day) => (
                  <Button
                    key={day.key}
                    type="button"
                    variant={days.includes(day.key) ? "default" : "outline"}
                    onClick={() => handleToggleDay(day.key)}
                    className={`rounded-full min-w-[38px] px-3 py-1 text-sm transition-all ${
                      days.includes(day.key) ? "bg-primary text-white shadow" : ""
                    }`}
                  >
                    {day.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Hangi günler erişim izni verileceğini seçiniz.
              </p>
            </div>
            {/* Action Buttons */}
            <div className="flex flex-col-reverse md:flex-row items-center justify-end gap-4 pt-6 mt-2 border-t border-gray-200 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                className="w-full md:w-auto"
                onClick={() => onOpenChange(false)}
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="flex gap-2 items-center w-full md:w-auto"
              >
                <Save className="w-4 h-4" />
                Kaydet
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

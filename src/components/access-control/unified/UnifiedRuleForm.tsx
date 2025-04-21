
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
        className="shadow-2xl border-0 bg-transparent p-0 flex justify-center items-center"
        style={{
          minWidth: 740,
          maxWidth: 970,
          minHeight: 430,
          borderRadius: 32,
        }}
      >
        <div className="w-full max-w-4xl">
          {/* Modern Card-Like Popup */}
          <div
            className="rounded-3xl bg-gradient-to-br from-[#F1F0FB] via-white to-[#FAE8E8] dark:from-[#28213c] dark:to-[#260F19] border border-gray-200 dark:border-gray-700 shadow-2xl p-0 overflow-hidden"
            style={{
              minWidth: 740,
              maxWidth: 970,
              margin: "0 auto",
              borderRadius: 32,
            }}
          >
            {/* HEADER */}
            <div className="px-12 py-7 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#FAE8E8] to-[#F1F0FB] dark:from-[#28213c] dark:to-[#260F19]">
              <h2 className="text-2xl font-black tracking-tight text-gray-800 dark:text-white">Yeni Kural Oluştur</h2>
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

            {/* FORM: modern 6 sütun grid */}
            <form
              className="px-8 py-9 bg-white/90 dark:bg-[#1A1F2C]/90"
              autoComplete="off"
            >
              <div className="w-full grid grid-cols-1 md:grid-cols-6 gap-7">
                {/* Kural Adı */}
                <div className="flex flex-col items-center justify-between gap-2 bg-white/80 dark:bg-[#24193a] rounded-2xl shadow hover:shadow-lg border border-gray-100 dark:border-gray-800 p-4 transition-all">
                  <label htmlFor="ruleName" className="text-[13px] font-semibold text-gray-600 dark:text-gray-200 mb-1">
                    Kural Adı
                  </label>
                  <Input
                    id="ruleName"
                    placeholder="Kural adı"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-background text-base font-medium px-2 shadow-sm"
                    autoFocus
                    required
                  />
                  <span className="text-[10px] text-muted-foreground mt-1 text-center opacity-70">Örn: Mesai Saatleri</span>
                </div>
                {/* Departman/Personel */}
                <div className="flex flex-col items-center justify-between gap-2 bg-white/80 dark:bg-[#24193a] rounded-2xl shadow hover:shadow-lg border border-gray-100 dark:border-gray-800 p-4 transition-all">
                  <label className="text-[13px] font-semibold text-gray-600 dark:text-gray-200 mb-1">Departman & Personel</label>
                  <div className="w-full rounded-xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/40 p-1">
                    <DepartmentEmployeeSelector
                      value={selection}
                      onChange={handleSelectionChange}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-2 text-center opacity-70">
                    Kim(ler) için geçerli?
                  </span>
                </div>
                {/* Kapı / Bölge */}
                <div className="flex flex-col items-center justify-between gap-2 bg-white/80 dark:bg-[#24193a] rounded-2xl shadow hover:shadow-lg border border-gray-100 dark:border-gray-800 p-4 transition-all">
                  <label className="text-[13px] font-semibold text-gray-600 dark:text-gray-200 mb-1">Kapı & Bölge</label>
                  <Button
                    variant="outline"
                    className="justify-between gap-2 w-full text-base bg-white/95 dark:bg-gray-900/30 border border-gray-200 dark:border-gray-700"
                    type="button"
                  >
                    <span className={doors.length > 0 ? "" : "text-muted-foreground"}>
                      {doors.length > 0 ? `${doors.length} kapı seçildi` : "Kapı/bölge seç"}
                    </span>
                  </Button>
                  <span className="text-[10px] text-muted-foreground mt-2 text-center opacity-70">
                    Hangi kapı/bölgelerde geçerli?
                  </span>
                </div>
                {/* Saat aralığı - Başlangıç */}
                <div className="flex flex-col items-center justify-between gap-2 bg-white/80 dark:bg-[#24193a] rounded-2xl shadow hover:shadow-lg border border-gray-100 dark:border-gray-800 p-4 transition-all">
                  <label htmlFor="startTime" className="text-[13px] font-semibold text-gray-600 dark:text-gray-200 mb-1">Başlangıç Saati</label>
                  <div className="flex items-center border rounded-lg px-2 py-1 bg-white/70 dark:bg-gray-900/20 gap-1">
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="border-none bg-transparent px-0 py-0 text-base"
                      required
                    />
                    <Clock className="ml-1 w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-2 text-center opacity-70">Başlangıç</span>
                </div>
                {/* Saat aralığı - Bitiş */}
                <div className="flex flex-col items-center justify-between gap-2 bg-white/80 dark:bg-[#24193a] rounded-2xl shadow hover:shadow-lg border border-gray-100 dark:border-gray-800 p-4 transition-all">
                  <label htmlFor="endTime" className="text-[13px] font-semibold text-gray-600 dark:text-gray-200 mb-1">Bitiş Saati</label>
                  <div className="flex items-center border rounded-lg px-2 py-1 bg-white/70 dark:bg-gray-900/20 gap-1">
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="border-none bg-transparent px-0 py-0 text-base"
                      required
                    />
                    <Clock className="ml-1 w-4 h-4 text-muted-foreground" />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-2 text-center opacity-70">Bitiş</span>
                </div>
                {/* Durum */}
                <div className="flex flex-col items-center justify-between gap-2 bg-white/80 dark:bg-[#24193a] rounded-2xl shadow hover:shadow-lg border border-gray-100 dark:border-gray-800 p-4 transition-all">
                  <label className="font-semibold text-[13px] text-gray-600 dark:text-gray-200 mb-1" htmlFor="statusSwitch">
                    Durum
                  </label>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="statusSwitch"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                    <span className="font-semibold text-xs ml-1">{isActive ? "Aktif" : "Pasif"}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-2 text-center opacity-70">
                    Kural aktif/pasif
                  </span>
                </div>
                {/* Günler */}
                <div className="md:col-span-6 flex flex-col gap-2 mt-4">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-300 ml-2">Geçerli Günler</label>
                  <div className="flex gap-2 flex-wrap justify-center md:justify-start">
                    {DAYS.map((day) => (
                      <Button
                        key={day.key}
                        type="button"
                        variant={days.includes(day.key) ? "default" : "outline"}
                        onClick={() => handleToggleDay(day.key)}
                        className={`rounded-full min-w-[38px] px-3 py-1 text-sm transition-all ${
                          days.includes(day.key) ? "bg-primary text-white shadow" : "shadow-none"
                        }`}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground ml-2 mt-1">
                    Hangi günler geçerli olacak?
                  </span>
                </div>
              </div>
              {/* Actions Row */}
              <div className="flex flex-col-reverse md:flex-row items-center justify-end gap-4 pt-7 mt-7 border-t border-gray-200 dark:border-gray-700">
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ... (Dosya sonu)


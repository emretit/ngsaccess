
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, X, Clock } from "lucide-react";
import DepartmentEmployeeSelector from "./DepartmentEmployeeSelector";
import ZoneDoorSelector from "./ZoneDoorSelector";

interface UnifiedRuleFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface DepartmentEmployeeSelection {
  type: "department" | "employee";
  id: number;
  name: string;
}

interface ZoneDoorSelection {
  type: "zone" | "door";
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
  const [zonesDoors, setZonesDoors] = useState<ZoneDoorSelection[]>([]);
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

  const handleZonesDoorChange = (newSelection: ZoneDoorSelection[]) => {
    setZonesDoors(newSelection);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Here you would implement the actual form submission logic
    
    // Close the form after submission
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="shadow-2xl border-0 bg-transparent w-full max-w-2xl p-0 flex justify-center items-center"
        style={{
          minWidth: 700,
          maxWidth: 900,
          borderRadius: 24,
        }}
      >
        <div className="w-full">
          {/* Modern, Card-like Rectangle Popup */}
          <div
            className="rounded-3xl bg-gradient-to-br from-[#F1F0FB] via-white to-[#FAE8E8] dark:from-[#28213c] dark:to-[#260F19] border border-gray-200 dark:border-gray-700 shadow-xl p-0 overflow-hidden"
            style={{
              minWidth: 700,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            {/* HEADER */}
            <div className="px-10 py-7 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#FAE8E8] to-[#F1F0FB] dark:from-[#28213c] dark:to-[#260F19]">
              <div>
                <DialogTitle className="text-2xl font-extrabold tracking-tight text-gray-800 dark:text-white">Yeni Kural Oluştur</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  Personel ve kapı erişim kuralını tanımlayın
                </DialogDescription>
              </div>
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

            {/* FORM: modern grid 3 sütun */}
            <form
              className="p-10 bg-white/85 dark:bg-[#1A1F2C]/80"
              autoComplete="off"
              onSubmit={handleSubmit}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Kural Adı */}
                <div className="flex flex-col gap-3">
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
                {/* Departman/Personel */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">Departman & Personel</label>
                  <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/40 p-2">
                    <DepartmentEmployeeSelector
                      value={selection}
                      onChange={handleSelectionChange}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    İzin vermek istediğiniz departman / personel
                  </span>
                </div>
                {/* Kapı / Bölge */}
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">Kapı & Bölge</label>
                  <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white/80 dark:bg-gray-900/40 p-2">
                    <ZoneDoorSelector
                      value={zonesDoors}
                      onChange={handleZonesDoorChange}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Erişim izni verilecek kapı/bölgeleri seçin
                  </span>
                </div>
                {/* Saat aralığı */}
                <div className="flex flex-col gap-3">
                  <label htmlFor="startTime" className="text-xs font-semibold text-gray-500 dark:text-gray-300">Başlangıç</label>
                  <div className="flex items-center border rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/40 gap-1">
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="border-none bg-transparent px-0 py-0 text-base"
                      required
                    />
                    <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <label htmlFor="endTime" className="text-xs font-semibold text-gray-500 dark:text-gray-300">Bitiş</label>
                  <div className="flex items-center border rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/40 gap-1">
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="border-none bg-transparent px-0 py-0 text-base"
                      required
                    />
                    <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                {/* Durum */}
                <div className="flex flex-col gap-3">
                  <label className="font-semibold text-xs text-gray-500 dark:text-gray-300" htmlFor="statusSwitch">
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
                </div>
                {/* Günler */}
                <div className="md:col-span-3 flex flex-col gap-2 mt-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">Günler</label>
                  <div className="flex gap-2 flex-wrap">
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
                  <span className="text-xs text-muted-foreground">
                    Hangi günler erişim izni vereceğinizi seçiniz.
                  </span>
                </div>
              </div>
              {/* Actions Row */}
              <div className="flex flex-col-reverse md:flex-row items-center justify-end gap-4 pt-8 mt-6 border-t border-gray-200 dark:border-gray-700">
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

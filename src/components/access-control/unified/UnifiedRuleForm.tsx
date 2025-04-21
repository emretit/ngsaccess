
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
      <DialogContent
        className="max-w-xl w-full rounded-2xl p-0 bg-white shadow-2xl border-0"
        style={{
          minWidth: 380,
          maxWidth: 520,
          margin: 0,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)"
        }}
      >
        {/* HEADER */}
        <div className="flex justify-between items-center px-7 py-5 border-b">
          <h2 className="text-xl font-bold tracking-tight">Yeni Kural Oluştur</h2>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-red-500/90 focus-visible:ring-2 focus-visible:ring-primary"
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
        {/* FORM */}
        <form className="px-7 py-6 space-y-7 text-[15px]" autoComplete="off">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Rule Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ruleName" className="text-sm font-medium">
                Kural Adı <span className="text-muted-foreground">(örn: Mesai Saatleri)</span>
              </label>
              <Input
                id="ruleName"
                placeholder="Kural adını girin"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-background text-base"
                autoFocus
                required
              />
            </div>
            {/* Department & Employee Select */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Departman ve Personel</label>
              <DepartmentEmployeeSelector
                value={selection}
                onChange={handleSelectionChange}
              />
              <p className="text-xs text-muted-foreground mt-1">
                İzin vermek istediğiniz departman ve/veya personeli seçin
              </p>
            </div>
          </div>
          {/* DOOR SELECTION */}
          <div>
            <label className="text-sm font-medium">Kapı ve Bölge</label>
            <Button
              variant="outline"
              className="justify-between gap-2 w-full max-w-md text-base mt-1"
              type="button"
            >
              <span className={doors.length > 0 ? '' : 'text-muted-foreground'}>
                {doors.length > 0 ? `${doors.length} kapı seçildi` : 'Erişim verilecek kapıları seçin'}
              </span>
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Erişim izni verilecek kapı/bölgeleri seçin.
            </p>
          </div>
          {/* TIME & STATUS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <label htmlFor="startTime" className="text-sm font-medium">Başlangıç</label>
              <div className="flex items-center border rounded-lg px-3 py-2 bg-white gap-1 focus-within:ring-2 focus-within:ring-accent">
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
            <div className="space-y-1.5">
              <label htmlFor="endTime" className="text-sm font-medium">Bitiş</label>
              <div className="flex items-center border rounded-lg px-3 py-2 bg-white gap-1 focus-within:ring-2 focus-within:ring-accent">
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
            {/* STATUS TOGGLE */}
            <div className="flex items-center gap-2 h-full mt-3 md:mt-6">
              <label className="font-medium text-sm" htmlFor="statusSwitch">
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
          {/* DAYS */}
          <div>
            <label className="text-sm font-medium mb-2 block">Günler</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {DAYS.map((day) => (
                <Button
                  key={day.key}
                  type="button"
                  variant={days.includes(day.key) ? "default" : "outline"}
                  onClick={() => handleToggleDay(day.key)}
                  className="rounded-full min-w-[38px] px-3 py-1 text-sm"
                >
                  {day.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Hangi günler erişim izni verileceğini seçiniz.
            </p>
          </div>
          {/* ACTION BUTTONS */}
          <div className="flex items-center justify-end gap-4 pt-3 border-t mt-6">
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

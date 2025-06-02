
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
import { Save, X, Clock, Loader2 } from "lucide-react";
import { useAccessRules, AccessRuleFormData } from "@/hooks/useAccessRules";
import { useToast } from "@/components/ui/use-toast";
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
  const { toast } = useToast();
  const { createRule, isCreating } = useAccessRules();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selection, setSelection] = useState<DepartmentEmployeeSelection[]>([]);
  const [zonesDoors, setZonesDoors] = useState<ZoneDoorSelection[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [days, setDays] = useState<string[]>(["paz", "sal", "çar", "per", "cum"]);
  const [isActive, setIsActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleToggleDay(day: string) {
    setDays(d =>
      d.includes(day) ? d.filter((x) => x !== day) : [...d, day]
    );
  }

  const handleSelectionChange = (newSelection: DepartmentEmployeeSelection[]) => {
    setSelection(newSelection);
    if (errors.selection) {
      setErrors(prev => ({ ...prev, selection: "" }));
    }
  };

  const handleZonesDoorChange = (newSelection: ZoneDoorSelection[]) => {
    setZonesDoors(newSelection);
    if (errors.access_points) {
      setErrors(prev => ({ ...prev, access_points: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = "Kural adı zorunludur";
    }

    if (selection.length === 0) {
      newErrors.selection = "En az bir departman veya personel seçmelisiniz";
    }

    if (zonesDoors.length === 0) {
      newErrors.access_points = "En az bir kapı veya bölge seçmelisiniz";
    }

    if (days.length === 0) {
      newErrors.days = "En az bir gün seçmelisiniz";
    }

    if (startTime >= endTime) {
      newErrors.time = "Başlangıç saati bitiş saatinden önce olmalıdır";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSelection([]);
    setZonesDoors([]);
    setStartTime("08:00");
    setEndTime("18:00");
    setDays(["paz", "sal", "çar", "per", "cum"]);
    setIsActive(true);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast({
        variant: "destructive",
        title: "Form Hatası",
        description: "Lütfen tüm zorunlu alanları doldurun ve hataları düzeltin.",
      });
      return;
    }

    const formData: AccessRuleFormData = {
      name: name.trim(),
      description: description.trim() || undefined,
      departments: selection.filter(s => s.type === "department") as Array<{ type: "department"; id: number; name: string }>,
      employees: selection.filter(s => s.type === "employee") as Array<{ type: "employee"; id: number; name: string }>,
      zones: zonesDoors.filter(z => z.type === "zone") as Array<{ type: "zone"; id: number; name: string }>,
      doors: zonesDoors.filter(z => z.type === "door") as Array<{ type: "door"; id: number; name: string }>,
      start_time: startTime,
      end_time: endTime,
      days,
      is_active: isActive
    };

    createRule(formData, {
      onSuccess: () => {
        resetForm();
        onOpenChange(false);
      }
    });
  };

  const handleClose = () => {
    if (!isCreating) {
      resetForm();
      onOpenChange(false);
    }
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
          <div
            className="rounded-3xl bg-gradient-to-br from-[#F1F0FB] via-white to-[#FAE8E8] dark:from-[#28213c] dark:to-[#260F19] border border-gray-200 dark:border-gray-700 shadow-xl p-0 overflow-hidden"
            style={{
              minWidth: 700,
              maxWidth: 900,
              margin: "0 auto",
            }}
          >
            <div className="px-10 py-7 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-[#FAE8E8] to-[#F1F0FB] dark:from-[#28213c] dark:to-[#260F19]">
              <div>
                <DialogTitle className="text-2xl font-extrabold tracking-tight text-gray-800 dark:text-white">
                  Yeni Kural Oluştur
                </DialogTitle>
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
                onClick={handleClose}
                disabled={isCreating}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <form
              className="p-10 bg-white/85 dark:bg-[#1A1F2C]/80"
              autoComplete="off"
              onSubmit={handleSubmit}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col gap-3">
                  <label htmlFor="ruleName" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                    Kural Adı *
                  </label>
                  <Input
                    id="ruleName"
                    placeholder="Kural adını girin"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors(prev => ({ ...prev, name: "" }));
                    }}
                    className={`bg-background text-base shadow-sm ${
                      errors.name ? "border-red-500" : ""
                    }`}
                    autoFocus
                    required
                    disabled={isCreating}
                  />
                  {errors.name && (
                    <span className="text-red-500 text-xs">{errors.name}</span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                    Departman & Personel *
                  </label>
                  <div className={`rounded-xl border ${
                    errors.selection ? "border-red-500" : "border-gray-100 dark:border-gray-800"
                  } bg-white/80 dark:bg-gray-900/40 p-2`}>
                    <DepartmentEmployeeSelector
                      value={selection}
                      onChange={handleSelectionChange}
                      disabled={isCreating}
                    />
                  </div>
                  {errors.selection && (
                    <span className="text-red-500 text-xs">{errors.selection}</span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                    Kapı & Bölge *
                  </label>
                  <div className={`rounded-xl border ${
                    errors.access_points ? "border-red-500" : "border-gray-100 dark:border-gray-800"
                  } bg-white/80 dark:bg-gray-900/40 p-2`}>
                    <ZoneDoorSelector
                      value={zonesDoors}
                      onChange={handleZonesDoorChange}
                      disabled={isCreating}
                    />
                  </div>
                  {errors.access_points && (
                    <span className="text-red-500 text-xs">{errors.access_points}</span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <label htmlFor="startTime" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                    Başlangıç *
                  </label>
                  <div className="flex items-center border rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/40 gap-1">
                    <Input
                      id="startTime"
                      type="time"
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        if (errors.time) setErrors(prev => ({ ...prev, time: "" }));
                      }}
                      className="border-none bg-transparent px-0 py-0 text-base"
                      required
                      disabled={isCreating}
                    />
                    <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <label htmlFor="endTime" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                    Bitiş *
                  </label>
                  <div className="flex items-center border rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/40 gap-1">
                    <Input
                      id="endTime"
                      type="time"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        if (errors.time) setErrors(prev => ({ ...prev, time: "" }));
                      }}
                      className="border-none bg-transparent px-0 py-0 text-base"
                      required
                      disabled={isCreating}
                    />
                    <Clock className="ml-2 w-4 h-4 text-muted-foreground" />
                  </div>
                  {errors.time && (
                    <span className="text-red-500 text-xs">{errors.time}</span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <label className="font-semibold text-xs text-gray-500 dark:text-gray-300" htmlFor="statusSwitch">
                    Durum
                  </label>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="statusSwitch"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                      disabled={isCreating}
                    />
                    <span className="font-semibold text-xs ml-1">
                      {isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                </div>

                <div className="md:col-span-3 flex flex-col gap-2 mt-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                    Günler *
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map((day) => (
                      <Button
                        key={day.key}
                        type="button"
                        variant={days.includes(day.key) ? "default" : "outline"}
                        onClick={() => {
                          handleToggleDay(day.key);
                          if (errors.days) setErrors(prev => ({ ...prev, days: "" }));
                        }}
                        className={`rounded-full min-w-[38px] px-3 py-1 text-sm transition-all ${
                          days.includes(day.key) ? "bg-primary text-white shadow" : ""
                        }`}
                        disabled={isCreating}
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                  {errors.days && (
                    <span className="text-red-500 text-xs">{errors.days}</span>
                  )}
                </div>

                <div className="md:col-span-3 flex flex-col gap-3">
                  <label htmlFor="description" className="text-xs font-semibold text-gray-500 dark:text-gray-300">
                    Açıklama
                  </label>
                  <Input
                    id="description"
                    placeholder="Kural açıklaması (isteğe bağlı)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-background text-base shadow-sm"
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse md:flex-row items-center justify-end gap-4 pt-8 mt-6 border-t border-gray-200 dark:border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full md:w-auto"
                  onClick={handleClose}
                  disabled={isCreating}
                >
                  İptal
                </Button>
                <Button
                  type="submit"
                  className="flex gap-2 items-center w-full md:w-auto"
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {isCreating ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

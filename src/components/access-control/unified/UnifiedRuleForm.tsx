
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, X, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DepartmentEmployeeSelector from "./DepartmentEmployeeSelector";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface UnifiedRuleFormProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface DepartmentEmployeeSelection {
  type: "department" | "employee";
  id: number;
  name: string;
}

interface Door {
  id: number;
  name: string;
  location: string | null;
  zone_id: number | null;
  zone_name?: string;
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
  const [doors, setDoors] = useState<number[]>([]);
  const [doorList, setDoorList] = useState<Door[]>([]);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("18:00");
  const [days, setDays] = useState<string[]>(["paz", "sal", "çar", "per", "cum"]);
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchDoors();
    }
  }, [open]);

  const fetchDoors = async () => {
    try {
      const { data, error } = await supabase
        .from('doors')
        .select(`
          *,
          zones (name)
        `)
        .order('name', { ascending: true });
      
      if (error) throw error;
      
      const formattedDoors = data.map(door => ({
        id: door.id,
        name: door.name,
        location: door.location,
        zone_id: door.zone_id,
        zone_name: door.zones?.name
      }));
      
      setDoorList(formattedDoors);
    } catch (error) {
      console.error("Kapı listesi alınırken hata:", error);
    }
  };

  function handleToggleDay(day: string) {
    setDays(d =>
      d.includes(day) ? d.filter((x) => x !== day) : [...d, day]
    );
  }

  const handleSelectionChange = (newSelection: DepartmentEmployeeSelection[]) => {
    setSelection(newSelection);
  };

  const handleToggleDoor = (doorId: number) => {
    setDoors(currentDoors => 
      currentDoors.includes(doorId)
        ? currentDoors.filter(id => id !== doorId)
        : [...currentDoors, doorId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || selection.length === 0 || doors.length === 0 || days.length === 0) {
      toast.error("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    setIsLoading(true);
    
    try {
      // Kural tipi ve ilgili ID'leri hazırla
      let ruleType = '';
      let employeeId = null;
      let departmentIds: number[] = [];
      let userIds: number[] = [];

      // Seçimler arası ayrım yap
      selection.forEach(item => {
        if (item.type === 'department') {
          departmentIds.push(item.id);
          if (!ruleType) ruleType = 'department';
        } else if (item.type === 'employee') {
          userIds.push(item.id);
          if (!ruleType) ruleType = 'user';
        }
      });
      
      // Karma seçim varsa (hem departman hem çalışan) tip 'mixed' olur
      if (departmentIds.length > 0 && userIds.length > 0) {
        ruleType = 'mixed';
      }

      const { data, error } = await supabase
        .call('create_access_rule', {
          p_type: ruleType,
          p_employee_id: employeeId,
          p_device_id: doors[0], // primary device
          p_days: days,
          p_start_time: startTime,
          p_end_time: endTime,
          p_department_ids: departmentIds.length > 0 ? departmentIds : null,
          p_user_ids: userIds.length > 0 ? userIds : null,
          p_door_ids: doors.length > 1 ? doors.slice(1) : null // additional doors
        });

      if (error) throw error;
      
      toast.success("Erişim kuralı başarıyla oluşturuldu.");
      
      // Formu sıfırla ve kapat
      setName("");
      setSelection([]);
      setDoors([]);
      setDays(["paz", "sal", "çar", "per", "cum"]);
      setStartTime("08:00");
      setEndTime("18:00");
      setIsActive(true);
      onOpenChange(false);
      
    } catch (error) {
      console.error("Erişim kuralı oluşturulurken hata:", error);
      toast.error("Erişim kuralı oluşturulurken bir hata oluştu.");
    } finally {
      setIsLoading(false);
    }
  };

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
        <form className="px-8 pt-2 pb-6 space-y-7" onSubmit={handleSubmit}>
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
              <DepartmentEmployeeSelector
                value={selection}
                onChange={handleSelectionChange}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="font-medium text-sm">Kapı ve Bölge Seçimi</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="justify-between w-full"
                  type="button"
                >
                  <span className={doors.length ? "" : "text-muted-foreground"}>
                    {doors.length
                      ? `${doors.length} kapı seçildi`
                      : "Erişim verilecek kapıları seçin"}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <ScrollArea className="h-[300px] p-4">
                  <div className="space-y-4">
                    {doorList.length > 0 ? (
                      doorList.map((door) => (
                        <div key={door.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`door-${door.id}`}
                            checked={doors.includes(door.id)}
                            onCheckedChange={() => handleToggleDoor(door.id)}
                          />
                          <div>
                            <label
                              htmlFor={`door-${door.id}`}
                              className="font-medium cursor-pointer"
                            >
                              {door.name}
                            </label>
                            {(door.location || door.zone_name) && (
                              <p className="text-xs text-muted-foreground">
                                {door.location ? `${door.location} ` : ""}
                                {door.zone_name && `(${door.zone_name})`}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        Henüz kapı bulunmuyor
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
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
              {DAYS.map((day) => (
                <Button
                  key={day.key}
                  type="button"
                  variant={days.includes(day.key) ? "default" : "outline"}
                  onClick={() => handleToggleDay(day.key)}
                  className="rounded-full min-w-12"
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              İptal
            </Button>
            <Button type="submit" className="flex gap-2 items-center" disabled={isLoading}>
              {isLoading ? (
                <span className="h-5 w-5 block rounded-full border-2 border-t-transparent border-white animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

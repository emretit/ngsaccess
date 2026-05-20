import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { parseDateString, formatDateString } from "@/lib/date";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Employee = FunctionReturnType<typeof api.employees.list>[number];
type Shift = FunctionReturnType<typeof api.shifts.list>[number];

interface BulkAssignShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Employee[];
  shifts: Shift[];
}

const WEEKDAY_OPTIONS: { code: string; label: string }[] = [
  { code: "MON", label: "Pzt" },
  { code: "TUE", label: "Sal" },
  { code: "WED", label: "Çrş" },
  { code: "THU", label: "Per" },
  { code: "FRI", label: "Cum" },
  { code: "SAT", label: "Cmt" },
  { code: "SUN", label: "Paz" },
];

export function BulkAssignShiftDialog({
  open,
  onOpenChange,
  employees,
  shifts,
}: BulkAssignShiftDialogProps) {
  const { toast } = useToast();
  const bulkAssign = useMutation(api.shifts.bulkAssignShift);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [shiftId, setShiftId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [patternEnabled, setPatternEnabled] = useState(false);
  const [weekPattern, setWeekPattern] = useState<string[]>([]);
  const [employeeOpen, setEmployeeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [overlapCount, setOverlapCount] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedEmployeeIds([]);
      setShiftId("");
      setStartDate("");
      setEndDate("");
      setPatternEnabled(false);
      setWeekPattern([]);
      setOverlapCount(null);
    }
  }, [open]);

  const activeShifts = useMemo(
    () => shifts.filter((s) => s.isActive !== false),
    [shifts],
  );

  const selectedEmployees = useMemo(
    () => employees.filter((e) => selectedEmployeeIds.includes(String(e._id))),
    [employees, selectedEmployeeIds],
  );

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleWeekday = (code: string) => {
    setWeekPattern((prev) =>
      prev.includes(code) ? prev.filter((x) => x !== code) : [...prev, code],
    );
  };

  const submit = async (forceConfirm: boolean) => {
    if (selectedEmployeeIds.length === 0) {
      toast({
        title: "Çalışan seçin",
        description: "En az bir çalışan seçmelisiniz.",
        variant: "destructive",
      });
      return;
    }
    if (!shiftId) {
      toast({ title: "Vardiya seçin", variant: "destructive" });
      return;
    }
    if (!startDate || !endDate) {
      toast({ title: "Tarih aralığı seçin", variant: "destructive" });
      return;
    }
    if (startDate > endDate) {
      toast({
        title: "Hatalı tarih",
        description: "Bitiş tarihi başlangıçtan önce olamaz.",
        variant: "destructive",
      });
      return;
    }
    if (patternEnabled && weekPattern.length === 0) {
      toast({
        title: "Gün seçin",
        description: "Haftalık tekrar için en az bir gün seçmelisiniz.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await bulkAssign({
        employeeIds: selectedEmployeeIds as Id<"employees">[],
        shiftId: shiftId as Id<"shifts">,
        startDate,
        endDate,
        weekPattern: patternEnabled ? weekPattern : undefined,
        forceConfirm,
      });
      const msg =
        result.skipped.length > 0
          ? `${result.insertedCount} atama oluşturuldu, ${result.skipped.length} atlandı.`
          : `${result.insertedCount} çalışana atama yapıldı.`;
      toast({ title: "Toplu atama tamam", description: msg });
      setOverlapCount(null);
      onOpenChange(false);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Toplu atama yapılamadı";
      const overlap = /OVERLAP:(\d+)/.exec(m);
      if (overlap) {
        setOverlapCount(Number(overlap[1]));
      } else {
        toast({ title: "Hata", description: m, variant: "destructive" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent size="md" className="p-0">
          <div className="p-6 border-b">
            <SheetHeader>
              <SheetTitle>Toplu Vardiya Ata</SheetTitle>
            </SheetHeader>
          </div>

          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <Label>Çalışanlar ({selectedEmployees.length})</Label>
                <Popover open={employeeOpen} onOpenChange={setEmployeeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between font-normal"
                    >
                      {selectedEmployees.length === 0
                        ? "Çalışan seçin..."
                        : `${selectedEmployees.length} çalışan seçildi`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Çalışan ara..." />
                      <CommandList>
                        <CommandEmpty>Sonuç yok.</CommandEmpty>
                        <CommandGroup>
                          {employees.map((e) => {
                            const label = `${e.firstName} ${e.lastName}`;
                            const checked = selectedEmployeeIds.includes(String(e._id));
                            return (
                              <CommandItem
                                key={e._id}
                                value={label}
                                onSelect={() => toggleEmployee(String(e._id))}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    checked ? "opacity-100" : "opacity-0",
                                  )}
                                />
                                {label}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedEmployees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedEmployees.map((e) => (
                      <Badge
                        key={e._id}
                        variant="secondary"
                        className="gap-1 pl-2 pr-1"
                      >
                        {e.firstName} {e.lastName}
                        <button
                          type="button"
                          onClick={() => toggleEmployee(String(e._id))}
                          className="ml-1 rounded-sm hover:bg-muted"
                          aria-label="Kaldır"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Vardiya</Label>
                <Select
                  value={shiftId}
                  onValueChange={setShiftId}
                  disabled={activeShifts.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        activeShifts.length === 0
                          ? "Aktif vardiya yok"
                          : "Vardiya seçin"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activeShifts.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        {s.name} ({s.startTime}–{s.endTime})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Başlangıç</Label>
                  <DatePicker
                    date={parseDateString(startDate)}
                    onSelect={(d) => setStartDate(formatDateString(d))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bitiş</Label>
                  <DatePicker
                    date={parseDateString(endDate)}
                    onSelect={(d) => setEndDate(formatDateString(d))}
                    minDate={parseDateString(startDate)}
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="patternEnabled" className="text-sm font-medium">
                      Sadece belirli günlerde tekrarla
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Kapalıyken her gün uygulanır.
                    </p>
                  </div>
                  <Switch
                    id="patternEnabled"
                    checked={patternEnabled}
                    onCheckedChange={setPatternEnabled}
                  />
                </div>
                {patternEnabled && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {WEEKDAY_OPTIONS.map((d) => {
                      const active = weekPattern.includes(d.code);
                      return (
                        <Button
                          key={d.code}
                          type="button"
                          variant={active ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleWeekday(d.code)}
                          className="h-8 w-12"
                        >
                          {d.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="border-t bg-background p-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              İptal
            </Button>
            <Button
              type="button"
              onClick={() => submit(false)}
              disabled={submitting}
            >
              {submitting
                ? "Atanıyor..."
                : `${selectedEmployees.length} Çalışana Ata`}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={overlapCount !== null}
        onOpenChange={(o) => !o && setOverlapCount(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Çakışan atamalar var</AlertDialogTitle>
            <AlertDialogDescription>
              Seçilen çalışanlardan {overlapCount} kişinin bu aralıkta mevcut
              ataması var. Yine de eklemek istiyor musunuz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void submit(true);
              }}
              disabled={submitting}
            >
              Yine de Ata
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

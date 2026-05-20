import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2, CalendarPlus, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { z } from "zod";
import { DatePicker } from "@/components/ui/date-picker";
import { parseDateString, formatDateString } from "@/lib/date";

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD formatında olmalı"),
  name: z.string().trim().min(1, "Tatil adı zorunlu").max(100, "Tatil adı en fazla 100 karakter"),
  isHalfDay: z.boolean(),
});

export function HolidayCalendarManager() {
  const { projectId, loading: projectLoading } = useActiveProject();
  const { toast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear());
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const holidays = useQuery(
    api.holidays.list,
    projectLoading ? "skip" : { projectId, year }
  );
  const create = useMutation(api.holidays.create);
  const remove = useMutation(api.holidays.remove);
  const seed = useMutation(api.holidays.seedTurkishHolidays);

  const handleAdd = async () => {
    const parsed = holidaySchema.safeParse({ date, name, isHalfDay });
    if (!parsed.success) {
      toast({
        title: "Eksik bilgi",
        description: parsed.error.issues[0]?.message ?? "Form bilgileri geçersiz",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      await create({ projectId, date: parsed.data.date, name: parsed.data.name, isHalfDay: parsed.data.isHalfDay });
      setDate("");
      setName("");
      setIsHalfDay(false);
      toast({ title: "Tatil eklendi" });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Ekleme başarısız",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const result = await seed({ projectId, years: [year] });
      const missing = result.missingReligiousYears ?? [];
      const missingMsg =
        missing.length > 0
          ? ` (${missing.join(", ")} için dini tatil tablosu yok — manuel girin)`
          : "";
      toast({
        title: `${year} TR resmi tatilleri yüklendi`,
        description: `${result.inserted} yeni eklendi, ${result.skipped} mevcut.${missingMsg}`,
      });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Yükleme başarısız",
        variant: "destructive",
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove({ id: id as Parameters<typeof remove>[0]["id"] });
      toast({ title: "Tatil silindi" });
    } catch (e) {
      toast({
        title: "Hata",
        description: e instanceof Error ? e.message : "Silme başarısız",
        variant: "destructive",
      });
    }
  };

  const sortedHolidays = [...(holidays ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-3">
        <CardTitle className="text-base">Resmi Tatil Takvimi</CardTitle>
        <div className="flex gap-1.5 items-center">
          <Label htmlFor="year-filter" className="text-xs">
            Yıl
          </Label>
          <Input
            id="year-filter"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-20 h-8 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSeed}
            disabled={seeding}
            className="h-8 text-xs"
          >
            {seeding ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {year} Otomatik Doldur
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2 p-2 border rounded-md bg-muted/30">
          <div className="space-y-1">
            <Label htmlFor="hol-date" className="text-xs">Tarih</Label>
            <DatePicker
              date={parseDateString(date)}
              onSelect={(d) => setDate(formatDateString(d))}
              className="w-40"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label htmlFor="hol-name" className="text-xs">İsim</Label>
            <Input
              id="hol-name"
              placeholder="Cumhuriyet Bayramı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5 h-8">
            <Checkbox
              id="hol-half"
              checked={isHalfDay}
              onCheckedChange={(v) => setIsHalfDay(!!v)}
              className="h-3.5 w-3.5"
            />
            <Label htmlFor="hol-half" className="text-xs">
              Yarım gün
            </Label>
          </div>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding}
            className="h-8 text-xs"
          >
            {adding ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
            )}
            Tatil Ekle
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 px-3 py-1 text-xs">Tarih</TableHead>
                <TableHead className="h-8 px-3 py-1 text-xs">Gün</TableHead>
                <TableHead className="h-8 px-3 py-1 text-xs">İsim</TableHead>
                <TableHead className="h-8 px-3 py-1 text-xs">Tip</TableHead>
                <TableHead className="h-8 px-3 py-1 text-xs w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHolidays.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-4 text-sm"
                  >
                    {year} yılı için tanımlı tatil yok
                  </TableCell>
                </TableRow>
              ) : (
                sortedHolidays.map((h) => (
                  <TableRow key={h._id} className="h-8">
                    <TableCell className="px-3 py-1 font-mono text-xs">
                      {format(new Date(`${h.date}T00:00:00`), "dd MMM yyyy", {
                        locale: tr,
                      })}
                    </TableCell>
                    <TableCell className="px-3 py-1 text-xs">
                      {format(new Date(`${h.date}T00:00:00`), "EEEE", {
                        locale: tr,
                      })}
                    </TableCell>
                    <TableCell className="px-3 py-1 text-xs">{h.name}</TableCell>
                    <TableCell className="px-3 py-1">
                      {h.isHalfDay ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Yarım gün</Badge>
                      ) : (
                        <Badge className="text-[10px] px-1.5 py-0 h-5">Tam gün</Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-0.5">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Tatili sil</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{h.name}" ({h.date}) tatilini silmek istediğinize emin misiniz?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(h._id)}>
                              Sil
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

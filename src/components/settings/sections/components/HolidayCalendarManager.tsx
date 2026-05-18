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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Resmi Tatil Takvimi</CardTitle>
        <div className="flex gap-2 items-center">
          <Label htmlFor="year-filter" className="text-sm">
            Yıl
          </Label>
          <Input
            id="year-filter"
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-24"
          />
          <Button
            variant="outline"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            {year} Tatillerini Otomatik Doldur
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end p-4 border rounded-lg bg-muted/30">
          <div className="space-y-2">
            <Label htmlFor="hol-date">Tarih</Label>
            <Input
              id="hol-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="hol-name">İsim</Label>
            <Input
              id="hol-name"
              placeholder="Cumhuriyet Bayramı"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="hol-half"
              checked={isHalfDay}
              onCheckedChange={(v) => setIsHalfDay(!!v)}
            />
            <Label htmlFor="hol-half" className="text-sm">
              Yarım gün
            </Label>
          </div>
          <Button
            onClick={handleAdd}
            disabled={adding}
            className="md:col-span-4"
          >
            {adding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="mr-2 h-4 w-4" />
            )}
            Tatil Ekle
          </Button>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tarih</TableHead>
                <TableHead>Gün</TableHead>
                <TableHead>İsim</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHolidays.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-muted-foreground py-8"
                  >
                    {year} yılı için tanımlı tatil yok
                  </TableCell>
                </TableRow>
              ) : (
                sortedHolidays.map((h) => (
                  <TableRow key={h._id}>
                    <TableCell className="font-mono">
                      {format(new Date(`${h.date}T00:00:00`), "dd MMM yyyy", {
                        locale: tr,
                      })}
                    </TableCell>
                    <TableCell>
                      {format(new Date(`${h.date}T00:00:00`), "EEEE", {
                        locale: tr,
                      })}
                    </TableCell>
                    <TableCell>{h.name}</TableCell>
                    <TableCell>
                      {h.isHalfDay ? (
                        <Badge variant="secondary">Yarım gün</Badge>
                      ) : (
                        <Badge>Tam gün</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <Trash2 className="h-4 w-4 text-destructive" />
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

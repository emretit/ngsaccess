import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useProjectAccess } from "@/hooks/useProjectAccess";
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
import { Trash2, CalendarPlus, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

export function HolidayCalendarManager() {
  const { projectIds, loading: projectLoading } = useProjectAccess();
  const projectId = projectIds[0];
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
    if (!date || !name.trim()) {
      toast({
        title: "Eksik bilgi",
        description: "Tarih ve isim zorunlu.",
        variant: "destructive",
      });
      return;
    }
    setAdding(true);
    try {
      await create({ projectId, date, name: name.trim(), isHalfDay });
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
      const result = await seed({ projectId, years: [2026, 2027] });
      toast({
        title: "TR resmi tatilleri yüklendi",
        description: `${result.inserted} yeni eklendi, ${result.skipped} mevcut.`,
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
            TR Tatillerini Yükle (2026-2027)
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
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(h._id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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

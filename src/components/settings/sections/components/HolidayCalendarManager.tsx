import { AdminDataBoundary } from "@/components/admin/components/AdminDataBoundary";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import type { FunctionReturnType } from "convex/server";
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
import { Trash2, CalendarPlus, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { z } from "zod";
import { DatePicker } from "@/components/ui/date-picker";
import { parseDateString, formatDateString } from "@/lib/date";

const holidaySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-MM-DD formatında olmalı"),
  name: z
    .string()
    .trim()
    .min(1, "Tatil adı zorunlu")
    .max(100, "Tatil adı en fazla 100 karakter"),
  isHalfDay: z.boolean(),
});

function HolidayCalendarContent() {
  const { projectId, loading: projectLoading } = useActiveProject();
  const { toast } = useToast();

  const [year, setYear] = useState(new Date().getFullYear());
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [deleteHoliday, setDeleteHoliday] = useState<
    FunctionReturnType<typeof api.holidays.list>[number] | null
  >(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const holidays = useQuery(
    api.holidays.list,
    !projectLoading && projectId ? { projectId, year } : "skip",
  );
  const create = useMutation(api.holidays.create);
  const remove = useMutation(api.holidays.remove);
  const seed = useMutation(api.holidays.seedTurkishHolidays);

  const { run: handleAdd, pending: adding } = useAsyncAction(
    async () => {
      if (!projectId) throw new Error("Önce bir proje seçin.");
      const parsed = holidaySchema.safeParse({ date, name, isHalfDay });
      if (!parsed.success)
        throw new Error(
          parsed.error.issues[0]?.message ?? "Form bilgileri geçersiz",
        );
      await create({ projectId, ...parsed.data });
      setDate("");
      setName("");
      setIsHalfDay(false);
      toast({ title: "Tatil eklendi" });
    },
    { error: "Tatil eklenemedi" },
  );

  const { run: handleSeed, pending: seeding } = useAsyncAction(
    async () => {
      if (!projectId) throw new Error("Önce bir proje seçin.");
      const result = await seed({ projectId, years: [year] });
      const missing = result.missingReligiousYears ?? [];
      toast({
        title: `${year} TR resmi tatilleri yüklendi`,
        description: `${result.inserted} yeni eklendi, ${result.skipped} mevcut.${missing.length ? ` (${missing.join(", ")} için dini tatil tablosu yok — manuel girin)` : ""}`,
      });
    },
    { error: "Tatiller yüklenemedi" },
  );

  const sortedHolidays = [...(holidays ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
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
            onClick={() => void handleSeed()}
            disabled={seeding || !projectId}
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
            <Label htmlFor="hol-date" className="text-xs">
              Tarih
            </Label>
            <DatePicker
              date={parseDateString(date)}
              onSelect={(d) => setDate(formatDateString(d))}
              className="w-40"
            />
          </div>
          <div className="space-y-1 flex-1 min-w-[180px]">
            <Label htmlFor="hol-name" className="text-xs">
              İsim
            </Label>
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
            onClick={() => void handleAdd()}
            disabled={adding || !projectId}
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

        {projectLoading || (projectId && holidays === undefined) ? (
          <SectionSkeleton label="Tatiller yükleniyor" />
        ) : !projectId ? (
          <EmptyState
            title="Proje seçin"
            description="Tatil takvimini görüntülemek için aktif bir proje seçin."
          />
        ) : sortedHolidays.length === 0 ? (
          <EmptyState
            title={`${year} yılı için tanımlı tatil yok`}
            description="Bir tatil ekleyin veya resmi tatilleri yükleyin."
          />
        ) : (
          <div className="rounded-md border overflow-x-auto">
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
                {sortedHolidays.map((h) => (
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
                    <TableCell className="px-3 py-1 text-xs">
                      {h.name}
                    </TableCell>
                    <TableCell className="px-3 py-1">
                      {h.isHalfDay ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 h-5"
                        >
                          Yarım gün
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] px-1.5 py-0 h-5">
                          Tam gün
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="px-3 py-0.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        aria-label={`${h.name} tatilini sil`}
                        onClick={() => {
                          setDeleteHoliday(h);
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <ConfirmDestructive
          confirmLabel="Tatili sil"
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Tatil silinsin mi?"
          objectName={deleteHoliday?.name ?? "Tatil"}
          effects={[
            `${deleteHoliday?.date ?? "Seçili gün"} için tatil tanımı kaldırılır.`,
          ]}
          onConfirm={async () => {
            if (!deleteHoliday) throw new Error("Tatil seçilmedi");
            await remove({ id: deleteHoliday._id });
            toast({ title: "Tatil silindi" });
          }}
        />
      </CardContent>
    </Card>
  );
}

export function HolidayCalendarManager() {
  const { projectId } = useActiveProject();
  return (
    <AdminDataBoundary key={projectId} label="Tatil takvimi">
      <HolidayCalendarContent />
    </AdminDataBoundary>
  );
}

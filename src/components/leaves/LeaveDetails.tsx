import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  dateLabel,
  pdksHref,
  leaveTypes,
  leaveStatuses,
  type LeaveRow,
} from "./lib/leaveState";
export function LeaveDetails({
  row,
  isAdmin,
  onClose,
  onEdit,
}: {
  row: LeaveRow | null;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: (row: LeaveRow) => void;
}) {
  return (
    <Sheet
      open={Boolean(row)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        size="md"
        className="flex h-dvh min-w-0 flex-col overflow-y-auto"
        aria-describedby="leave-detail-context"
      >
        <SheetHeader className="pr-8 text-left">
          <SheetTitle>İzin ayrıntıları</SheetTitle>
          <SheetDescription id="leave-detail-context">
            {row?.employeeName} ·{" "}
            {row?.departmentName ?? "Departman belirtilmemiş"}
          </SheetDescription>
        </SheetHeader>
        {row && (
          <>
            <dl className="space-y-5 text-sm break-words">
              <div>
                <dt className="text-muted-foreground">İzin türü</dt>
                <dd>{leaveTypes[row.leaveType]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Durum</dt>
                <dd>
                  <StatusBadge tone={leaveStatuses[row.status].tone}>
                    {leaveStatuses[row.status].label}
                  </StatusBadge>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tarih aralığı</dt>
                <dd className="tabular-nums">
                  {dateLabel(row.startDate)} – {dateLabel(row.endDate)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Takvim süresi</dt>
                <dd>
                  {row.calendarDays === null
                    ? "— · Tarihler geçersiz; kayıt düzeltilmeli."
                    : `${row.calendarDays} takvim günü · Başlangıç ve bitiş dahil.`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Açıklama</dt>
                <dd className="whitespace-pre-wrap">
                  {row.notesHidden
                    ? "Açıklama yalnız yöneticilere görünür."
                    : row.notes || "Açıklama eklenmemiş."}
                </dd>
              </div>
              {row.updatedAt && (
                <div>
                  <dt className="text-muted-foreground">Son güncelleme</dt>
                  <dd>{new Date(row.updatedAt).toLocaleString("tr-TR")}</dd>
                </div>
              )}
            </dl>
            {row.status !== "approved" && (
              <p className="text-sm text-muted-foreground">
                Bu eski kayıt salt okunurdur.
              </p>
            )}
            {row.employeeMissing && (
              <p className="text-sm text-muted-foreground">
                Personel bulunamadı. Kişinin proje bağlantısını kontrol edin.
              </p>
            )}
            <div className="rounded-md border bg-subtle p-3 text-xs leading-relaxed">
              <p>
                Takvim süresi, puantajdaki izin günü toplamı değildir. Gün
                durumunu ve bordro kodunu PDKS kayıtlarında inceleyin.
              </p>
              <p className="mt-2">
                {row.employeeName} · {dateLabel(row.startDate)} –{" "}
                {dateLabel(row.endDate)}.{" "}
                {row.employeeMissing
                  ? "PDKS sayfasında dönemi kontrol edin."
                  : "PDKS kişi adı araması ve bu dönem ile açılır; aynı adlı kişiler de eşleşebilir."}
              </p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              {isAdmin && row.status === "approved" && !row.employeeMissing && (
                <Button onClick={() => onEdit(row)}>Düzenle</Button>
              )}
              <Button variant="outline" asChild>
                <Link to={pdksHref(row)}>PDKS kayıtlarını aç</Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

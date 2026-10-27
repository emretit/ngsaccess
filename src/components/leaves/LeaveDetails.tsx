import { DetailFieldList } from "@/components/shared/DetailFieldList";
import { formatTrDateTime } from "@/lib/date";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DetailSheet } from "@/components/shared/DetailSheet";
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
  canManage,
  onClose,
  onEdit,
}: {
  row: LeaveRow | null;
  canManage: boolean;
  onClose: () => void;
  onEdit: (row: LeaveRow) => void;
}) {
  return (
    <DetailSheet
      open={Boolean(row)}
      onRequestClose={onClose}
      size="md"
      scroll="all"
      bodyClassName="pt-4"
      contentProps={{ className: "h-dvh" }}
      descriptionId="leave-detail-context"
      headerClassName="pr-8 text-left"
      title="İzin ayrıntıları"
      description={<>{row?.employeeName} · {row?.departmentName ?? "Departman belirtilmemiş"}</>}
    >
      {row && (
        <>
          <DetailFieldList fields={[
            { key: "type", label: "İzin türü", value: leaveTypes[row.leaveType] },
            { key: "status", label: "Durum", value: <StatusBadge tone={leaveStatuses[row.status].tone}>{leaveStatuses[row.status].label}</StatusBadge> },
            { key: "dates", label: "Tarih aralığı", numeric: true, value: `${dateLabel(row.startDate)} – ${dateLabel(row.endDate)}` },
            { key: "duration", label: "Takvim süresi", value: row.calendarDays === null
              ? "— · Tarihler geçersiz; kayıt düzeltilmeli."
              : `${row.calendarDays} takvim günü · Başlangıç ve bitiş dahil.` },
            { key: "notes", label: "Açıklama", value: <span className="whitespace-pre-wrap">{row.notesHidden
              ? "Açıklama yalnız yöneticilere görünür."
              : row.notes || "Açıklama eklenmemiş."}</span> },
            ...(row.updatedAt ? [{ key: "updated", label: "Son güncelleme", value: formatTrDateTime(new Date(row.updatedAt)) }] : []),
          ]} />
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
                : "PDKS seçili kişi ve bu dönem ile açılır."}
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-2 pt-4">
            {canManage && row.status === "approved" && !row.employeeMissing && (
              <Button onClick={() => onEdit(row)}>Düzenle</Button>
            )}
            <Button variant="outline" asChild>
              <Link to={pdksHref(row)}>PDKS kayıtlarını aç</Link>
            </Button>
          </div>
        </>
      )}
    </DetailSheet>
  );
}

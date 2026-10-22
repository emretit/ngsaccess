import { useAuth } from '@/components/auth/AuthProvider';
import { capabilities } from '@/lib/capabilities';
import { readPDKSPreferences, savePDKSPreferences, type PDKSExportPreferences } from '@/lib/pdksExportColumns';
import type { ColumnScope } from '@/lib/reports/columns';
import { PDKSExportColumns } from './export/PDKSExportColumns';
import { pdksToday } from "@/components/pdks/lib/calendar";
import { useRef, useState } from "react";
import { useConvex } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  exportToExcel,
  exportToCsv,
  exportToPdf,
  exportMonthlyPayrollSheet,
  type PDKSExportRecord,
} from "@/utils/pdksExport";
import { notify, errorMessage } from "@/lib/notify";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
type ExportType = "Excel" | "CSV" | "PDF" | "payroll" | "aphb";
type Aphb = FunctionReturnType<typeof api.sgkExport.buildAphbForMonth>;
export function aphbBlockedByReview(result: Aphb | null): boolean {
  if (!result) return false;
  if ("blockedByReview" in result && typeof result.blockedByReview === "boolean") return result.blockedByReview;
  return result.employees?.some(employee => employee.reviewDays.length > 0) ?? false;
}
interface Props {
  records?: PDKSExportRecord[];
  dateRange?: string;
  selectedDate?: Date;
  filterSummary?: string;
  selectedCount?: number;
  totalCount?: number;
  disabled?: boolean;
}
export function PDKSEnhancedExportPanel(props: Props) {
  const { profile } = useAuth();
  const { projectId } = useActiveProject();
  const scope = projectId && profile?._id ? { projectId, userId: profile._id } : undefined;
  const canSeePay = capabilities(profile?.role).admin;
  return <ExportPanel key={`${scope?.projectId}:${scope?.userId}:${canSeePay}`} {...props} scope={scope} canSeePay={canSeePay} />;
}
function ExportPanel({
  records = [],
  dateRange = "",
  selectedDate = pdksToday(),
  filterSummary = "Tüm personel",
  selectedCount = 0,
  totalCount = records.length,
  disabled,
  scope,
  canSeePay,
}: Props & { scope?: ColumnScope; canSeePay: boolean }) {
  const { projectId, activeProject } = useActiveProject();
  const convex = useConvex();
  const [preferences, setPreferences] = useState(() => readPDKSPreferences(scope, canSeePay));
  const updatePreferences = (next: PDKSExportPreferences) => {
    setPreferences(next);
    savePDKSPreferences(next, scope, canSeePay);
  };
  const [type, setType] = useState<ExportType | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [aphb, setAphb] = useState<Aphb | null>(null);
  const reviewEmployees = aphb?.employees?.filter(employee => employee.reviewDays.length > 0) ?? [];
  const reviewDays = reviewEmployees.flatMap(employee => employee.reviewDays.map(date => ({ employeeId: employee.employeeId, date })));
  const reviewBlocked = type === "aphb" && aphbBlockedByReview(aphb);
  const lock = useRef(false);
  const monthly = type === "aphb" || type === "payroll";
  const labels: Record<ExportType, string> = {
    Excel: "Excel (.xlsx)",
    CSV: "CSV",
    PDF: "PDF",
    payroll: "Aylık bordro cetveli",
    aphb: "SGK aylık bildirim taslağı (APHB)",
  };
  const choose = (next: ExportType) => {
    setError("");
    setAphb(null);
    if (next === 'Excel' || next === 'CSV' || next === 'PDF') {
      updatePreferences({ ...preferences, format: next });
    }
    setType(next);
  };
  const execute = async () => {
    if (lock.current || !type || reviewBlocked) return;
    lock.current = true;
    setPending(true);
    setError("");
    try {
      if (type === "aphb") {
        if (!aphb) {
          const result = await convex.query(api.sgkExport.buildAphbForMonth, {
            projectId,
            year: selectedDate.getFullYear(),
            month: selectedDate.getMonth() + 1,
          });
          if (!result.xml && !aphbBlockedByReview(result)) throw new Error("Bildirim için veri bulunamadı.");
          setAphb(result);
          return;
        }
        const url = URL.createObjectURL(
          new Blob([aphb.xml], { type: "application/xml" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = aphb.filename;
        a.click();
        URL.revokeObjectURL(url);
      } else if (type === "payroll") {
        const data = await convex.query(
          api.cardReadings.getMonthlyPayrollSheet,
          {
            projectId,
            year: selectedDate.getFullYear(),
            month: selectedDate.getMonth() + 1,
          },
        );
        await exportMonthlyPayrollSheet(data);
      } else if (type === "Excel") await exportToExcel(records, { dateRange, ...preferences, canSeePay });
      else if (type === "CSV") exportToCsv(records, { dateRange, ...preferences, canSeePay });
      else await exportToPdf(records, { dateRange, ...preferences, canSeePay });
      notify.success("Rapor oluşturuldu");
      setType(null);
    } catch (e) {
      setError(`Rapor oluşturulamadı. Seçiminiz korundu. ${errorMessage(e)}`);
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button disabled={disabled}>Dışa aktar</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(["Excel", "CSV", "PDF"] as const).map((k) => (
            <DropdownMenuItem key={k} onClick={() => choose(k)}>
              {labels[k]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {(["payroll", "aphb"] as const).map((k) => (
            <DropdownMenuItem key={k} onClick={() => choose(k)}>
              {labels[k]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={type !== null}
        onOpenChange={(open) => {
          if (!open && !lock.current) setType(null);
        }}
      >
        <DialogContent className="max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{type ? labels[type] : "Dışa aktar"}</DialogTitle>
            <DialogDescription>
              İndirmeden önce rapor kapsamını kontrol edin.
            </DialogDescription>
          </DialogHeader>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Proje</dt>
              <dd>{activeProject?.name ?? "Proje seçilmedi"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dönem</dt>
              <dd>
                {monthly
                  ? format(selectedDate, "MMMM yyyy", { locale: tr })
                  : dateRange}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Filtreler</dt>
              <dd>{filterSummary}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Kapsam</dt>
              <dd>
                {monthly
                  ? "Tüm proje / ay; kişi, durum, organizasyon filtreleri ve satır seçimi uygulanmaz."
                  : selectedCount
                    ? `${selectedCount} seçili / ${totalCount} filtreli satır`
                    : `${records.length} filtreli satır (tümü)`}
              </dd>
            </div>
          </dl>
          {!monthly && type && <PDKSExportColumns records={records} preferences={preferences} canSeePay={canSeePay} disabled={pending} onChange={updatePreferences} />}
          {monthly && <p className="text-xs text-muted-foreground">Aylık bordro ve APHB sabit kolonlarla hazırlanır; kolon seçimi uygulanmaz.</p>}
          {type === "aphb" && (
            <p className="text-xs text-muted-foreground">
              Taslak — resmi SGK formatı değildir, kontrol edin.
              Önce taslak hazırlanır; uyarılar indirmeden önce aşağıda gösterilir.
            </p>
          )}
          {aphb && (
            <div role="status" className="border-y py-3 text-sm">
              <h3 className="font-medium">APHB taslak kontrol sonucu</h3>
              {aphb.warnings.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {aphb.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              ) : (
                <p>Uyarı bulunamadı.</p>
              )}
            </div>
          )}
          {reviewBlocked && <div role="alert" className="space-y-2 rounded-md border border-warning p-3 text-sm">
            <h3 className="font-medium">{reviewEmployees.length > 0 ? `${reviewEmployees.length} çalışanın günleri inceleme bekliyor` : "Bazı günler inceleme bekliyor"}</h3>
            <ul className="list-disc pl-4">{reviewDays.slice(0, 10).map(({ employeeId, date }) => {
              const record = records.find(row => row.employeeId === employeeId || row.id === employeeId);
              const employeeNumber = reviewEmployees.findIndex(employee => employee.employeeId === employeeId) + 1;
              return <li key={`${employeeId}:${date}`}>{record?.name ?? `Çalışan ${employeeNumber}`}: {date}</li>;
            })}</ul>
            {reviewDays.length > 10 && <p>ve {reviewDays.length - 10} gün daha</p>}
            <p>Bu günler kesinleşmeden bildirim indirilemez. Eksik okutmaları PDKS'te elle düzeltin; ay henüz bitmediyse ay sonunu bekleyin.</p>
          </div>}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setType(null)}
            >
              Vazgeç
            </Button>
            <Button
              disabled={
                pending || reviewBlocked || !projectId || (!monthly && records.length === 0)
              }
              onClick={() => void execute()}
            >
              {pending
                ? "Rapor hazırlanıyor…"
                : type === "aphb" && !aphb
                  ? "Önizlemeyi hazırla"
                  : "İndir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

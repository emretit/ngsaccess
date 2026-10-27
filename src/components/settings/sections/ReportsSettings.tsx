import { NativeSelect } from "@/components/ui/native-select";
import { usePermissions } from "@/hooks/usePermissions";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convexApi";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Button } from "@/components/ui/button";
import { FormFieldWrapper } from "@/components/shared/FormFieldWrapper";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { Input } from "@/components/ui/input";
import { MonthPicker } from "@/components/ui/date-picker";

import { FileSpreadsheet, FileText } from "lucide-react";
import { exportScopedExcel, exportScopedSgkPdf } from "./reports/exportReport";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { todayInTurkey } from "@/lib/date";

import { REPORT_TEMPLATES, type ReportType } from "./reports/reportTypes";
import { ReportReminderSettings } from "./reports/ReportReminderSettings";
import { useSettingsFormState } from "../SettingsFormState";

const MONTHS = [
  { value: 1, label: "Ocak" },
  { value: 2, label: "Şubat" },
  { value: 3, label: "Mart" },
  { value: 4, label: "Nisan" },
  { value: 5, label: "Mayıs" },
  { value: 6, label: "Haziran" },
  { value: 7, label: "Temmuz" },
  { value: 8, label: "Ağustos" },
  { value: 9, label: "Eylül" },
  { value: 10, label: "Ekim" },
  { value: 11, label: "Kasım" },
  { value: 12, label: "Aralık" },
];

const currentDate = todayInTurkey();
const currentYear = Number(currentDate.slice(0, 4));
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export function linkedReportType(value: string | null | undefined): ReportType {
  return value === "dept-cost" ? "department" : value === "overtime" ? "overtime" : "sgk";
}

function ReportDownloadSettings({ requestedReport }: { requestedReport?: string | null }) {
  const { can } = usePermissions();
  const canSeePay = can("pay.view");
  const section = useRef<HTMLElement>(null);
  const { projectId: activeProjectId, projectIds, activeProject, loading: accessLoading } = useActiveProjectScope();
  const [scopeSelection, setScopeSelection] = useState("active");
  const projectId = scopeSelection === "all" ? undefined : activeProjectId ?? undefined;
  const scopeReady = !accessLoading && (scopeSelection === "all" ? projectIds.length > 0 : !!projectId);
  const scopeLabel = scopeSelection === "all" ? "Tüm erişilebilir projeler" : activeProject?.name ?? "Proje seçilmedi";
  useEffect(() => { setScopeSelection("active"); }, [activeProjectId]);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(Number(currentDate.slice(5, 7)));
  const [reportType, setReportType] = useState<ReportType>(() => linkedReportType(requestedReport));
  useEffect(() => {
    if (requestedReport) { setReportType(linkedReportType(requestedReport)); section.current?.scrollIntoView?.({ block: "start", behavior: "smooth" }); }
  }, [requestedReport]);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>(undefined);
  const debouncedHourlyRate = useDebouncedValue(hourlyRate, 300);
  const [overtimePeriod, setOvertimePeriod] = useState<"month" | "year">("month");

  const reportData = useQuery(
    api.reports.getSgkMonthlyReport,
    scopeReady && reportType === "sgk"
      ? { year, month, projectId }
      : "skip"
  );
  const overtimeData = useQuery(
    api.reports.getOvertimeSummaryReport,
    scopeReady && reportType === "overtime"
      ? {
          year,
          month: overtimePeriod === "month" ? month : undefined,
          projectId,
        }
      : "skip"
  );
  const attendanceData = useQuery(
    api.reports.getAttendanceSummaryReport,
    scopeReady && reportType === "attendance"
      ? { year, month, projectId }
      : "skip"
  );
  const hourlyRateError = canSeePay && hourlyRate !== undefined && (!Number.isFinite(hourlyRate) || hourlyRate < 0) ? "Sıfır veya pozitif bir ücret girin" : undefined;
  const departmentData = useQuery(
    api.reports.getDepartmentCostReport,
    scopeReady && reportType === "department" && !hourlyRateError && (!canSeePay || debouncedHourlyRate === undefined || (Number.isFinite(debouncedHourlyRate) && debouncedHourlyRate >= 0))
      ? { year, month, projectId, hourlyRate: canSeePay ? debouncedHourlyRate : undefined }
      : "skip"
  );

  const excelAction = useAsyncAction(async () => {
    if (reportType === "sgk" && reportData) await exportScopedExcel({ type: "sgk", data: reportData });
    else if (reportType === "overtime" && overtimeData) await exportScopedExcel({ type: "overtime", data: overtimeData }, canSeePay);
    else if (reportType === "attendance" && attendanceData) await exportScopedExcel({ type: "attendance", data: attendanceData });
    else if (reportType === "department" && departmentData) await exportScopedExcel({ type: "department", data: departmentData }, canSeePay);
  }, { error: "Excel indirilemedi" });
  const pdfAction = useAsyncAction(async () => {
    if (reportType === "sgk" && reportData) await exportScopedSgkPdf(reportData);
  }, { error: "PDF indirilemedi" });
  useSettingsFormState("report-download", false, excelAction.pending || pdfAction.pending);

  const isLoading =
    accessLoading ||
    (reportType === "sgk" && reportData === undefined) ||
    (reportType === "overtime" && overtimeData === undefined) ||
    (reportType === "attendance" && attendanceData === undefined) ||
    (reportType === "department" && departmentData === undefined);

  const currentData =
    reportType === "sgk"
      ? reportData
      : reportType === "overtime"
        ? overtimeData
        : reportType === "attendance"
          ? attendanceData
          : departmentData;

  const hasData = (currentData?.rows.length ?? 0) > 0;
  const isEmpty = currentData?.rows.length === 0;

  return (
    <div className="space-y-6">
      <section ref={section} id="settings-report-download" className="min-w-0 space-y-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold">Rapor indir</h3>
          <p className="text-sm text-muted-foreground">
            Rapor türünü seçin, yıl/ay belirleyin ve Excel veya PDF olarak indirin.
          </p>
        </div>
        <div className="space-y-4">
          <p className="text-sm font-medium" role="status">Kapsam: {currentData?.scopeLabel ?? scopeLabel}</p>
          <fieldset disabled={excelAction.pending || pdfAction.pending} className="grid min-w-0 grid-cols-1 gap-4 min-[761px]:grid-cols-2">
            {projectIds.length > 1 && <FormFieldWrapper htmlFor="report-scope" label="İndirme kapsamı">
              <NativeSelect className="min-w-0" value={scopeSelection} onChange={event => setScopeSelection(event.target.value)}>
                <option value="active">{activeProject?.name ?? "Aktif proje"}</option><option value="all">Tüm erişilebilir projeler</option>
              </NativeSelect>
            </FormFieldWrapper>}
            <FormFieldWrapper htmlFor="report-type" label="Rapor türü">
              <NativeSelect className="min-w-0" value={reportType} onChange={event => {
                const value = event.target.value;
                if (value === "sgk" || value === "overtime" || value === "attendance" || value === "department") setReportType(value);
              }}>{REPORT_TEMPLATES.map(template => <option key={template.id} value={template.id}>{template.label}</option>)}</NativeSelect>
            </FormFieldWrapper>
            {reportType === "overtime" && overtimePeriod === "year" ? <FormFieldWrapper htmlFor="report-year" label="Yıl">
              <NativeSelect className="min-w-0" value={year} onChange={event => setYear(Number(event.target.value))}>{YEARS.map(value => <option key={value} value={value}>{value}</option>)}</NativeSelect>
            </FormFieldWrapper> : <FormFieldWrapper htmlFor="report-month" label="Ay">
              <MonthPicker className="text-sm" date={new Date(year, month - 1, 1)} onSelect={date => { setYear(date.getFullYear()); setMonth(date.getMonth() + 1); }} />
            </FormFieldWrapper>}
            {reportType === "overtime" && <FormFieldWrapper htmlFor="report-period" label="Dönem">
              <NativeSelect className="min-w-0" value={overtimePeriod} onChange={event => { if (event.target.value === "month" || event.target.value === "year") setOvertimePeriod(event.target.value); }}><option value="month">Aylık</option><option value="year">Yıllık</option></NativeSelect>
            </FormFieldWrapper>}
            {canSeePay && reportType === "department" && <FormFieldWrapper htmlFor="report-hourly-rate" label="Ücret bilgisi olmayanlar için saatlik ücret (₺)" error={hourlyRateError}>
              <Input type="number" min={0} value={hourlyRate ?? ""} onChange={event => setHourlyRate(event.target.value === "" ? undefined : Number(event.target.value))} placeholder="Çalışan ücreti yoksa" />
            </FormFieldWrapper>}
          </fieldset>

          {currentData && <p className="text-sm text-muted-foreground">{currentData.reliabilityNote}</p>}
          {attendanceData && reportType === "attendance" && (
            <div className="space-y-2 text-sm">
              <p>Son tamamlanmış gün (TR): {attendanceData.completedThrough ?? "Bu dönemde tamamlanmış gün yok"}</p>
              {[...new Set(attendanceData.rows.map((row) => row.reliabilityNote).filter(Boolean))].map((note) => <p key={note} role="status">{note}</p>)}
            </div>
          )}
          {!accessLoading && !scopeReady ? (
            <EmptyState title="Proje seçin" description="Rapor oluşturmak için üst menüden erişebildiğiniz bir projeyi seçin." />
          ) : hourlyRateError && reportType === "department" ? (
            <p role="status" className="text-sm text-muted-foreground">Rapor için geçerli bir ücret girin.</p>
          ) : isLoading ? (
            <SectionSkeleton label="Rapor yükleniyor" rows={3} />
          ) : isEmpty ? (
            <EmptyState
              icon={FileText}
              title="Seçilen dönem için kayıt bulunamadı"
              description="Dönemi ve proje kapsamını kontrol edin."
            />
          ) : (
            <>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  {`${currentData?.rows.length ?? 0} ${reportType === "department" ? "departman" : "personel"}`}{" "}
                  — {reportType === "overtime" && overtimePeriod === "year" ? year : `${MONTHS.find((m) => m.value === month)?.label} ${year}`}
                </p>
                {reportType === "overtime" && overtimeData && "totalOvertimeHours" in overtimeData && (
                  <>
                    <p className="text-sm font-medium mt-1">
                      Toplam fazla mesai: {overtimeData.totalOvertimeHours} saat
                    </p>
                    {canSeePay && "totalOvertimePayTRY" in overtimeData &&
                      overtimeData.totalOvertimePayTRY !== null &&
                      overtimeData.totalOvertimePayTRY > 0 && (
                        <p className="text-sm font-medium">
                          Toplam mesai ücreti:{" "}
                          {overtimeData.totalOvertimePayTRY.toLocaleString(
                            "tr-TR",
                            { style: "currency", currency: "TRY" }
                          )}
                        </p>
                      )}
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void excelAction.run()} disabled={!hasData || excelAction.pending || pdfAction.pending} variant="default">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel indir
                </Button>
                {reportType === "sgk" && <Button
                  onClick={() => void pdfAction.run()}
                  disabled={!hasData || reportType !== "sgk" || pdfAction.pending || excelAction.pending}
                  variant="outline"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF indir
                </Button>}
              </div>
            </>
          )}
        </div>
      </section>


    </div>
  );
}

export function ReportsSettings({ requestedReport }: { requestedReport?: string | null }) {
  const { projectId } = useActiveProjectScope();
  const isAdmin = usePermissions().can("reports.view");
  return <div className="min-w-0 space-y-8">
    <QuerySectionBoundary resetKey={projectId} title="Raporlar yüklenemedi"><ReportDownloadSettings requestedReport={requestedReport} /></QuerySectionBoundary>
    {isAdmin && <QuerySectionBoundary resetKey={projectId} title="Hatırlatma yüklenemedi"><ReportReminderSettings /></QuerySectionBoundary>}
  </div>;
}

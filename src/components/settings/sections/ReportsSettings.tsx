import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convexApi";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, FileText, Mail } from "lucide-react";
import { exportScopedExcel, exportScopedSgkPdf } from "./reports/exportReport";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { todayInTurkey } from "@/lib/date";

type ReportType = "sgk" | "overtime" | "attendance" | "department";

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

const REPORT_TEMPLATES = [
  { id: "sgk", label: "SGK Aylık Döküm", description: "Çalışan başına gün, saat, mesai, izin" },
  { id: "overtime", label: "Fazla Mesai Özet", description: "Aylık/yıllık mesai toplamları" },
  { id: "attendance", label: "Devam Özet" , description: "Devam, devamsızlık, izin günleri" },
  { id: "department", label: "Departman Maliyet", description: "Maliyet analizi" },
];

const currentDate = todayInTurkey();
const currentYear = Number(currentDate.slice(0, 4));
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export function ReportsSettings() {
  const { projectId: activeProjectId, projectIds, activeProject, isAdmin, loading: accessLoading } = useActiveProjectScope();
  const [scopeSelection, setScopeSelection] = useState("active");
  const projectId = scopeSelection === "all" ? undefined : activeProjectId ?? undefined;
  const scopeReady = !accessLoading && (scopeSelection === "all" ? projectIds.length > 0 : !!projectId);
  const scopeLabel = scopeSelection === "all" ? "Tüm erişilebilir projeler" : activeProject?.name ?? "Proje seçilmedi";
  useEffect(() => { setScopeSelection("active"); }, [activeProjectId]);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(Number(currentDate.slice(5, 7)));
  const [reportType, setReportType] = useState<ReportType>("sgk");
  const [scheduledEmail, setScheduledEmail] = useState("");
  const [scheduledEnabled, setScheduledEnabled] = useState(false);
  const [hourlyRate, setHourlyRate] = useState<number | undefined>(undefined);
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
  const departmentData = useQuery(
    api.reports.getDepartmentCostReport,
    scopeReady && reportType === "department"
      ? { year, month, projectId, hourlyRate }
      : "skip"
  );

  const saveSchedule = useMutation(api.reports.saveReportSchedule);
  const scheduleData = useQuery(api.reports.getReportSchedule, scopeReady && isAdmin ? { projectId } : "skip");

  const hydratedFor = useRef<string | null>(null);
  const scheduleScope = projectId ?? "all";
  useEffect(() => {
    hydratedFor.current = null;
    setScheduledEmail("");
    setScheduledEnabled(false);
    setReportType("sgk");
  }, [scheduleScope]);
  useEffect(() => {
    if (!scopeReady || scheduleData === undefined || hydratedFor.current === scheduleScope) return;
    hydratedFor.current = scheduleScope;
    setScheduledEmail(scheduleData?.email ?? "");
    setScheduledEnabled(scheduleData?.enabled ?? false);
    const savedType = scheduleData?.reportType;
    if (savedType === "sgk" || savedType === "overtime" || savedType === "attendance" || savedType === "department") setReportType(savedType);
  }, [scheduleData, scheduleScope, scopeReady]);

  const excelAction = useAsyncAction(async () => {
    if (reportType === "sgk" && reportData) await exportScopedExcel({ type: "sgk", data: reportData });
    else if (reportType === "overtime" && overtimeData) await exportScopedExcel({ type: "overtime", data: overtimeData });
    else if (reportType === "attendance" && attendanceData) await exportScopedExcel({ type: "attendance", data: attendanceData });
    else if (reportType === "department" && departmentData) await exportScopedExcel({ type: "department", data: departmentData });
  }, { error: "Excel indirilemedi" });
  const pdfAction = useAsyncAction(async () => {
    if (reportType === "sgk" && reportData) await exportScopedSgkPdf(reportData);
  }, { error: "PDF indirilemedi" });
  const { run: handleSaveSchedule, pending: isSavingSchedule } = useAsyncAction(async () => {
    if (scheduleData === undefined || !scopeReady) throw new Error("Rapor kapsamının yüklenmesini bekleyin");
    await saveSchedule({ projectId, reportType, email: scheduledEmail.trim(), enabled: scheduledEnabled });
  }, { success: "Zamanlanmış rapor ayarları kaydedildi", error: "Kaydetme başarısız" });

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
      <div>
        <h2 className="text-xl font-semibold">Raporlar</h2>
        <p className="text-muted-foreground text-sm mt-1">
          SGK, fazla mesai, devam ve maliyet raporlarını oluşturun. Ayarlar → Raporlar bölümü.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rapor Şablonları</CardTitle>
          <CardDescription>
            Rapor türünü seçin, yıl/ay belirleyin ve Excel veya PDF olarak indirin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm font-medium" role="status">Kapsam: {currentData?.scopeLabel ?? scopeLabel}</p>
          {projectIds.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="report-scope">Proje kapsamı</Label>
              <Select value={scopeSelection} onValueChange={setScopeSelection} disabled={isSavingSchedule}>
                <SelectTrigger id="report-scope" className="w-full max-w-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktif proje: {activeProject?.name ?? "Proje seçin"}</SelectItem>
                  <SelectItem value="all">Tüm erişilebilir projeler</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label htmlFor="report-type">Rapor Türü</Label>
              <Select value={reportType} onValueChange={(value) => { if (value === "sgk" || value === "overtime" || value === "attendance" || value === "department") setReportType(value); }}>
                <SelectTrigger id="report-type" className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-year">Yıl</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger id="report-year" className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {reportType !== "overtime" || overtimePeriod === "month" ? (
              <div className="space-y-2">
                <Label htmlFor="report-month">Ay</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger id="report-month" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => (
                      <SelectItem key={m.value} value={String(m.value)}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {reportType === "overtime" && (
              <div className="space-y-2">
                <Label htmlFor="report-period">Dönem</Label>
                <Select
                  value={overtimePeriod}
                  onValueChange={(value) => { if (value === "month" || value === "year") setOvertimePeriod(value); }}
                >
                  <SelectTrigger id="report-period" className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Aylık</SelectItem>
                    <SelectItem value="year">Yıllık</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {reportType === "department" && (
              <div className="space-y-2">
                <Label htmlFor="report-hourly-rate">Saatlik Ücret Fallback (₺)</Label>
                <Input
                  id="report-hourly-rate"
                  type="number"
                  min={0}
                  value={hourlyRate ?? ""}
                  onChange={(e) =>
                    setHourlyRate(
                      e.target.value === "" ? undefined : Number(e.target.value)
                    )
                  }
                  placeholder="Çalışan ücreti yoksa"
                  className="w-[160px]"
                />
              </div>
            )}
          </div>

          {currentData && <p className="text-sm text-muted-foreground">{currentData.reliabilityNote}</p>}
          {attendanceData && reportType === "attendance" && (
            <div className="space-y-2 text-sm">
              <p>Son tamamlanmış gün (TR): {attendanceData.completedThrough ?? "Bu dönemde tamamlanmış gün yok"}</p>
              {[...new Set(attendanceData.rows.map((row) => row.reliabilityNote).filter(Boolean))].map((note) => <p key={note} role="status">{note}</p>)}
            </div>
          )}
          {!accessLoading && !scopeReady ? (
            <EmptyState title="Proje seçin" description="Rapor oluşturmak için üst menüden erişebildiğiniz bir projeyi seçin." />
          ) : isLoading ? (
            <SectionSkeleton label="Rapor yükleniyor" rows={3} />
          ) : isEmpty ? (
            <EmptyState
              icon={FileText}
              title="Veri bulunamadı"
              description="Seçilen dönem için kayıt bulunmuyor."
            />
          ) : (
            <>
              <div className="rounded-lg border p-4 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  {`${currentData?.rows.length ?? 0} kayıt`}{" "}
                  — {reportType === "overtime" && overtimePeriod === "year" ? year : `${MONTHS.find((m) => m.value === month)?.label} ${year}`}
                </p>
                {reportType === "overtime" && overtimeData && "totalOvertimeHours" in overtimeData && (
                  <>
                    <p className="text-sm font-medium mt-1">
                      Toplam fazla mesai: {overtimeData.totalOvertimeHours} saat
                    </p>
                    {"totalOvertimePayTRY" in overtimeData &&
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
              <div className="flex gap-2">
                <Button onClick={() => void excelAction.run()} disabled={!hasData || excelAction.pending || pdfAction.pending} variant="default">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel İndir
                </Button>
                <Button
                  onClick={() => void pdfAction.run()}
                  disabled={!hasData || reportType !== "sgk" || pdfAction.pending || excelAction.pending}
                  variant="outline"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  PDF İndir
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {isAdmin && <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Zamanlanmış Rapor
          </CardTitle>
          <CardDescription>
            Aylık rapor hatırlatması ve kapsam bilgisi her ayın ilk günü gönderilir; rapor dosyasını bu ekrandan indirirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">Zamanlama kapsamı: {scopeLabel} — {REPORT_TEMPLATES.find((template) => template.id === reportType)?.label}</p>
          <div className="flex items-center gap-4">
            <Switch
              id="report-schedule-enabled"
              checked={scheduledEnabled}
              disabled={isSavingSchedule || scheduleData === undefined}
              onCheckedChange={setScheduledEnabled}
            />
            <Label htmlFor="report-schedule-enabled">Aylık rapor e-postasını al</Label>
          </div>
          {scheduledEnabled && (
            <div className="space-y-2 max-w-md">
              <Label htmlFor="report-email">E-posta adresi</Label>
              <Input
                id="report-email"
                type="email"
                placeholder="rapor@firma.com"
                value={scheduledEmail}
                disabled={isSavingSchedule || scheduleData === undefined}
                onChange={(e) => setScheduledEmail(e.target.value)}
              />
            </div>
          )}
          <Button onClick={() => void handleSaveSchedule()} size="sm" disabled={isSavingSchedule || scheduleData === undefined}>
            {isSavingSchedule ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          {scheduleData !== undefined && (
            <p className="text-sm text-muted-foreground" role="status">
              Kayıtlı durum: {scheduleData?.enabled ? `Açık — ${scheduleData.email}` : "Kapalı"}
            </p>
          )}
        </CardContent>
      </Card>}
    </div>
  );
}

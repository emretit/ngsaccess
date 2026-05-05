import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convexApi";
import { useProjectAccess } from "@/hooks/useProjectAccess";
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
import { FileSpreadsheet, FileText, Loader2, Mail } from "lucide-react";
import { exportSgkToExcel, exportSgkToPdf, type SgkReportData } from "@/utils/sgkExport";
import { exportReportsToExcel } from "@/utils/reportsExport";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";

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

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

export function ReportsSettings() {
  const { projectIds, isSuperAdmin, loading: accessLoading } = useProjectAccess();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [reportType, setReportType] = useState("sgk");
  const [scheduledEmail, setScheduledEmail] = useState("");
  const [scheduledEnabled, setScheduledEnabled] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(100);
  const [overtimePeriod, setOvertimePeriod] = useState<"month" | "year">("month");

  const reportData = useQuery(
    api.reports.getSgkMonthlyReport,
    !accessLoading && reportType === "sgk"
      ? { year, month, projectIds, isSuperAdmin }
      : "skip"
  );
  const overtimeData = useQuery(
    api.reports.getOvertimeSummaryReport,
    !accessLoading && reportType === "overtime"
      ? {
          year,
          month: overtimePeriod === "month" ? month : undefined,
          projectIds,
          isSuperAdmin,
        }
      : "skip"
  );
  const attendanceData = useQuery(
    api.reports.getAttendanceSummaryReport,
    !accessLoading && reportType === "attendance"
      ? { year, month, projectIds, isSuperAdmin }
      : "skip"
  );
  const departmentData = useQuery(
    api.reports.getDepartmentCostReport,
    !accessLoading && reportType === "department"
      ? { year, month, projectIds, isSuperAdmin, hourlyRate }
      : "skip"
  );

  const saveSchedule = useMutation(api.reports.saveReportSchedule);
  const scheduleData = useQuery(api.reports.getReportSchedule, !accessLoading ? {} : "skip");

  useEffect(() => {
    if (scheduleData) {
      setScheduledEmail(scheduleData.email ?? "");
      setScheduledEnabled(scheduleData.enabled ?? false);
      setReportType(scheduleData.reportType ?? "sgk");
    }
  }, [scheduleData]);

  const handleExportExcel = async () => {
    if (reportType === "sgk" && reportData && "rows" in reportData && reportData.rows.length > 0) {
      await exportSgkToExcel(reportData as SgkReportData);
    } else if (reportType === "overtime" && overtimeData && "rows" in overtimeData) {
      await exportReportsToExcel.overtime(overtimeData);
    } else if (reportType === "attendance" && attendanceData && "rows" in attendanceData) {
      await exportReportsToExcel.attendance(attendanceData);
    } else if (reportType === "department" && departmentData && "rows" in departmentData) {
      await exportReportsToExcel.department(departmentData);
    }
  };

  const handleExportPdf = () => {
    if (reportType === "sgk" && reportData && "rows" in reportData && reportData.rows.length > 0) {
      exportSgkToPdf(reportData as SgkReportData);
    } else {
      toast.info("PDF export sadece SGK raporu için destekleniyor.");
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduledEmail) {
      toast.error("Email adresi girin");
      return;
    }
    try {
      await saveSchedule({
        reportType,
        email: scheduledEmail,
        enabled: scheduledEnabled,
      });
      toast.success("Zamanlanmış rapor ayarları kaydedildi");
    } catch {
      toast.error("Kaydetme başarısız");
    }
  };

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

  const hasData =
    currentData &&
    "rows" in currentData &&
    Array.isArray((currentData as { rows: unknown[] }).rows) &&
    (currentData as { rows: unknown[] }).rows.length > 0;

  const isEmpty =
    currentData &&
    "rows" in currentData &&
    Array.isArray((currentData as { rows: unknown[] }).rows) &&
    (currentData as { rows: unknown[] }).rows.length === 0;

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
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2">
              <Label>Rapor Türü</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-[200px]">
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
              <Label>Yıl</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                <SelectTrigger className="w-[120px]">
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
                <Label>Ay</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                  <SelectTrigger className="w-[140px]">
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
                <Label>Dönem</Label>
                <Select
                  value={overtimePeriod}
                  onValueChange={(v) => setOvertimePeriod(v as "month" | "year")}
                >
                  <SelectTrigger className="w-[120px]">
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
                <Label>Saatlik Ücret (₺)</Label>
                <Input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value) || 100)}
                  className="w-[120px]"
                />
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Rapor yükleniyor...</span>
            </div>
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
                  {currentData && "rows" in currentData
                    ? `${(currentData as { rows: unknown[] }).rows.length} kayıt`
                    : "0 kayıt"}{" "}
                  — {reportType === "overtime" && overtimePeriod === "year" ? year : `${MONTHS.find((m) => m.value === month)?.label} ${year}`}
                </p>
                {reportType === "overtime" && overtimeData && "totalOvertimeHours" in overtimeData && (
                  <p className="text-sm font-medium mt-1">
                    Toplam fazla mesai: {(overtimeData as { totalOvertimeHours: number }).totalOvertimeHours} saat
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleExportExcel} disabled={!hasData} variant="default">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel İndir
                </Button>
                <Button
                  onClick={handleExportPdf}
                  disabled={!hasData || reportType !== "sgk"}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Zamanlanmış Rapor
          </CardTitle>
          <CardDescription>
            Aylık raporu otomatik olarak e-posta ile alabilirsiniz. Her ayın ilk günü gönderilir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Switch
              checked={scheduledEnabled}
              onCheckedChange={setScheduledEnabled}
            />
            <Label>Aylık rapor e-postasını al</Label>
          </div>
          {scheduledEnabled && (
            <div className="space-y-2 max-w-md">
              <Label>E-posta adresi</Label>
              <Input
                type="email"
                placeholder="rapor@firma.com"
                value={scheduledEmail}
                onChange={(e) => setScheduledEmail(e.target.value)}
              />
              <Button onClick={handleSaveSchedule} size="sm">
                Kaydet
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

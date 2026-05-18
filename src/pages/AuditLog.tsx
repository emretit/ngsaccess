import { Fragment, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  create: { label: "Oluştur", cls: "bg-green-100 text-green-800" },
  update: { label: "Güncelle", cls: "bg-blue-100 text-blue-800" },
  delete: { label: "Sil", cls: "bg-red-100 text-red-800" },
};

const TABLE_LABELS: Record<string, string> = {
  pdksRecords: "PDKS Kaydı",
  holidays: "Tatil",
  overtimeRates: "Mesai Oranı",
  employees: "Çalışan",
  workSettings: "Çalışma Ayarı",
};

function formatJson(value: unknown): string {
  if (value === undefined || value === null) return "—";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function AuditLog() {
  const { profile } = useAuth();
  const { projectId, loading } = useActiveProject();

  const [targetTable, setTargetTable] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const startTimestamp = startDate
    ? new Date(`${startDate}T00:00:00.000`).getTime()
    : undefined;
  const endTimestamp = endDate
    ? new Date(`${endDate}T23:59:59.999`).getTime()
    : undefined;

  const rows = useQuery(
    api.auditLog.list,
    loading
      ? "skip"
      : {
          projectId,
          targetTable: targetTable === "all" ? undefined : targetTable,
          startTimestamp,
          endTimestamp,
        }
  );
  const tables = useQuery(api.auditLog.distinctTargetTables, {});

  const isAuthorized =
    profile?.role === "super_admin" || profile?.role === "project_admin";

  const visibleRows = useMemo(() => rows ?? [], [rows]);

  if (!isAuthorized) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Bu sayfayı görüntüleme yetkiniz yok.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card shadow-xs p-4 md:p-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 mr-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-tight">Denetim Kaydı</h2>
              <p className="text-xs text-muted-foreground">
                {visibleRows.length} kayıt gösteriliyor
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Select value={targetTable} onValueChange={setTargetTable}>
              <SelectTrigger id="target" className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Hedef Tablo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Tüm Tablolar</SelectItem>
                {(tables ?? []).map((t) => (
                  <SelectItem key={t} value={t} className="text-xs">
                    {TABLE_LABELS[t] ?? t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 w-[130px] text-xs"
              aria-label="Başlangıç"
            />
            <Input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-8 w-[130px] text-xs"
              aria-label="Bitiş"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setTargetTable("all");
                setStartDate("");
                setEndDate("");
              }}
              className="h-8 gap-1.5 text-xs"
            >
              Temizle
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Zaman</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>Aksiyon</TableHead>
                <TableHead>Hedef</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Not</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground py-8"
                  >
                    Kayıt bulunamadı
                  </TableCell>
                </TableRow>
              ) : (
                visibleRows.map((r) => {
                  const expanded = expandedRow === r._id;
                  const actionInfo = ACTION_LABELS[r.action] ?? {
                    label: r.action,
                    cls: "bg-gray-100",
                  };
                  return (
                    <Fragment key={r._id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedRow(expanded ? null : r._id)}
                      >
                        <TableCell>
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(r.timestamp), "dd MMM yyyy HH:mm:ss", {
                            locale: tr,
                          })}
                        </TableCell>
                        <TableCell>{r.userName ?? "—"}</TableCell>
                        <TableCell>
                          <Badge className={actionInfo.cls}>
                            {actionInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {TABLE_LABELS[r.targetTable] ?? r.targetTable}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.targetId.slice(0, 12)}…
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {r.note ?? ""}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow>
                          <TableCell colSpan={7} className="bg-muted/30">
                            <div className="grid grid-cols-2 gap-4 p-4">
                              <div>
                                <h4 className="font-semibold mb-2 text-sm">
                                  Eski Değer
                                </h4>
                                <pre className="text-xs bg-card p-3 rounded border overflow-auto max-h-60">
                                  {formatJson(r.oldValue)}
                                </pre>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2 text-sm">
                                  Yeni Değer
                                </h4>
                                <pre className="text-xs bg-card p-3 rounded border overflow-auto max-h-60">
                                  {formatJson(r.newValue)}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
      </div>
    </div>
  );
}

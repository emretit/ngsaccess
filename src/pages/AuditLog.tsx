import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useAuth } from "@/components/auth/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ChevronDown, ChevronRight } from "lucide-react";

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
  const { projectIds, loading } = useProjectAccess();
  const projectId = projectIds[0];

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
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Denetim Kaydı</h1>
        <p className="text-gray-600 mt-2">
          Sistemdeki tüm değişikliklerin kim, ne zaman, neyi yaptığını gösterir.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtre</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-2">
              <Label htmlFor="target">Hedef Tablo</Label>
              <Select value={targetTable} onValueChange={setTargetTable}>
                <SelectTrigger id="target">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {(tables ?? []).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TABLE_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="start">Başlangıç</Label>
              <Input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">Bitiş</Label>
              <Input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setTargetTable("all");
                setStartDate("");
                setEndDate("");
              }}
            >
              Filtreyi Temizle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Kayıtlar
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              ({visibleRows.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                    <>
                      <TableRow
                        key={r._id}
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
                        <TableRow key={`${r._id}-expanded`}>
                          <TableCell colSpan={7} className="bg-muted/30">
                            <div className="grid grid-cols-2 gap-4 p-4">
                              <div>
                                <h4 className="font-semibold mb-2 text-sm">
                                  Eski Değer
                                </h4>
                                <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-60">
                                  {formatJson(r.oldValue)}
                                </pre>
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2 text-sm">
                                  Yeni Değer
                                </h4>
                                <pre className="text-xs bg-white p-3 rounded border overflow-auto max-h-60">
                                  {formatJson(r.newValue)}
                                </pre>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Fragment, useState, useEffect, useRef } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import type { FunctionArgs } from "convex/server";
import { useSearchParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import {
  AUDIT_TARGET_LABELS,
  auditDateRange,
} from "../../convex/lib/auditLogQuery";
import { capabilities } from "@/lib/capabilities";
import { useAuth } from "@/components/auth/AuthProvider";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { AccessDenied } from "@/components/shared/AccessDenied";
import { AdminDataBoundary } from "@/components/admin/components/AdminDataBoundary";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { parseDateString, formatDateString } from "@/lib/date";
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
import { ChevronDown, ChevronRight } from "lucide-react";

type AuditArgs = Omit<FunctionArgs<typeof api.auditLog.list>, "paginationOpts">;
const actions = { create: "Oluştur", update: "Güncelle", delete: "Sil" };
const timestampFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "medium",
});

function AuditRows({ args }: { args: AuditArgs }) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.auditLog.list,
    args,
    { initialNumItems: 50 },
  );
  const autoLoads = useRef(0);
  const lastAutoLoad = useRef<typeof loadMore | null>(null);
  useEffect(() => {
    if (results.length > 0) {
      autoLoads.current = 0;
      return;
    }
    if (status !== "CanLoadMore" || autoLoads.current >= 5 || lastAutoLoad.current === loadMore) return;
    lastAutoLoad.current = loadMore;
    autoLoads.current += 1;
    loadMore(50);
  }, [results.length, status, loadMore]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const secondary = Boolean(
    args.action || args.search || (args.targetTable && args.userId),
  );
  const filtered = Boolean(
    args.targetTable ||
    args.userId ||
    args.action ||
    args.search ||
    args.startDate ||
    args.endDate,
  );
  if (status === "LoadingFirstPage")
    return <SectionSkeleton label="Denetim kayıtları yükleniyor" rows={5} />;
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Yüklenen {results.length} eşleşen kayıt ·{" "}
        {status === "Exhausted"
          ? "Kapsamın sonuna ulaşıldı"
          : "Daha fazla kayıt var"}
        {secondary &&
          " · İşlem/metin ve birleşik kullanıcı filtresi yüklenen kayıtlarda uygulanır."}
      </p>
      {results.length === 0 ? (
        <EmptyState
          title={
            status !== "Exhausted"
              ? "Yüklenen kayıtlarda eşleşme yok — daha fazla yükle"
              : filtered
                ? "Filtrelere uygun kayıt yok"
                : "Henüz denetim kaydı yok"
          }
          description={
            status !== "Exhausted"
              ? "Eski kayıtları aramak için daha fazla yükleyin."
              : "Seçili proje kapsamındaki sonuçlar gösteriliyor."
          }
        />
      ) : (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Zaman (TR saati)</TableHead>
                <TableHead>Kullanıcı</TableHead>
                <TableHead>İşlem</TableHead>
                <TableHead>Hedef</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Not</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((row) => {
                const expanded = expandedRow === row._id;
                return (
                  <Fragment key={row._id}>
                    <TableRow>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Kayıt detayını aç/kapat"
                          aria-expanded={expanded}
                          onClick={() =>
                            setExpandedRow(expanded ? null : row._id)
                          }
                        >
                          {expanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {timestampFormat.format(row.timestamp)}
                      </TableCell>
                      <TableCell>{row.userName ?? "Bilinmeyen"}</TableCell>
                      <TableCell>
                        <StatusBadge
                          tone={
                            row.action === "delete"
                              ? "danger"
                              : row.action === "create"
                                ? "success"
                                : "info"
                          }
                        >
                          {actions[row.action]}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>
                        {AUDIT_TARGET_LABELS[row.targetTable] ??
                          row.targetTable}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs"
                        title={row.targetId}
                      >
                        {row.targetId}
                      </TableCell>
                      <TableCell>{row.note ?? "—"}</TableCell>
                    </TableRow>
                    {expanded && (
                      <TableRow>
                        <TableCell colSpan={7}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3">
                            {[
                              ["Eski değer", row.oldValue],
                              ["Yeni değer", row.newValue],
                            ].map(([label, value], index) => (
                              <div key={index}>
                                <h4 className="text-sm font-semibold mb-2">
                                  {String(label)}
                                </h4>
                                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-60">
                                  {value == null
                                    ? "—"
                                    : JSON.stringify(value, null, 2)}
                                </pre>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      {status !== "Exhausted" && (
        <Button
          variant="outline"
          disabled={status === "LoadingMore"}
          onClick={() => loadMore(50)}
        >
          {status === "LoadingMore" ? "Yükleniyor…" : "Daha fazla yükle"}
        </Button>
      )}
    </div>
  );
}

function UserFilter({
  args,
  value,
  onChange,
}: {
  args: AuditArgs;
  value: string;
  onChange: (value: string) => void;
}) {
  const users = useQuery(api.auditLog.filterUsers, {
    projectId: args.projectId,
    allProjects: args.allProjects,
  });
  return (
    <Select value={value || "all"} onValueChange={onChange}>
      <SelectTrigger className="w-48" aria-label="Kullanıcı">
        <SelectValue placeholder="Kullanıcı" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Tüm kullanıcılar</SelectItem>
        {value && !users?.some((user) => user._id === value) && (
          <SelectItem value={value}>Bilinmeyen kullanıcı</SelectItem>
        )}
        {users?.map((user) => (
          <SelectItem key={user._id} value={user._id}>
            {user.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default function AuditLog() {
  const { profile } = useAuth();
  const { projectId, activeProject, loading } = useActiveProjectScope();
  const [params, setParams] = useSearchParams();
  const authorized = capabilities(profile?.role).auditLog;
  const allProjects =
    profile?.role === "super_admin" && params.get("allProjects") === "true";
  const searchUrl = params.get("q") ?? "";
  const [searchText, setSearchText] = useState(searchUrl);
  const debouncedSearch = useDebouncedValue(searchText, 300);
  const lastSearchUrl = useRef(searchUrl);
  useEffect(() => {
    if (lastSearchUrl.current !== searchUrl) {
      lastSearchUrl.current = searchUrl;
      setSearchText(searchUrl);
      return;
    }
    if (searchText !== debouncedSearch || searchUrl === debouncedSearch) return;
    lastSearchUrl.current = debouncedSearch;
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (debouncedSearch) next.set("q", debouncedSearch);
      else next.delete("q");
      return next;
    }, { replace: true });
  }, [searchUrl, searchText, debouncedSearch, setParams]);
  const previousScope = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    const scope = `${projectId ?? "none"}:${allProjects}`;
    if (previousScope.current !== null && previousScope.current !== scope) {
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("user");
        return next;
      }, { replace: true });
    }
    previousScope.current = scope;
  }, [projectId, allProjects, loading, setParams]);
  const startDate = params.get("start") || "";
  const endDate = params.get("end") || "";
  const actionValue = params.get("action");
  const action =
    actionValue === "create" ||
    actionValue === "update" ||
    actionValue === "delete"
      ? actionValue
      : undefined;
  const args: AuditArgs = {
    projectId: allProjects ? undefined : projectId,
    allProjects,
    targetTable: params.get("target") || undefined,
    userId: (params.get("user") || undefined) as Id<"users"> | undefined,
    action,
    search: params.get("q") || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };
  let rangeError: string | undefined;
  try {
    auditDateRange(args.startDate, args.endDate);
  } catch (error) {
    rangeError =
      error instanceof Error ? error.message : "Tarih aralığı geçersiz";
  }
  const update = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!value || value === "all") next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );
  if (!authorized)
    return <AccessDenied message="Denetim kaydını görüntüleme yetkiniz yok." />;
  const scopeReady = !loading && (allProjects || Boolean(projectId));
  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold">Denetim Kaydı</h2>
          <Badge variant="secondary">
            {allProjects
              ? "Tüm projeler"
              : (activeProject?.name ?? "Proje seçilmedi")}
          </Badge>
          <span className="text-xs text-muted-foreground">TR saati</span>
          {profile?.role === "super_admin" && (
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={allProjects}
                onCheckedChange={(checked) =>
                  update("allProjects", checked ? "true" : "")
                }
              />
              Tüm projeler
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={args.targetTable || "all"}
            onValueChange={(value) => update("target", value)}
          >
            <SelectTrigger className="w-48" aria-label="Hedef tablo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm hedefler</SelectItem>
              {Object.entries(AUDIT_TARGET_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {scopeReady && (
            <AdminDataBoundary
              key={`users-${projectId}-${allProjects}`}
              label="Kullanıcı seçenekleri"
            >
              <UserFilter
                args={args}
                value={args.userId ?? ""}
                onChange={(value) => update("user", value)}
              />
            </AdminDataBoundary>
          )}
          <Select
            value={action ?? "all"}
            onValueChange={(value) => update("action", value)}
          >
            <SelectTrigger className="w-40" aria-label="İşlem türü">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm işlemler</SelectItem>
              {Object.entries(actions).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="w-60"
            aria-label="Denetim kayıtlarında ara"
            placeholder="Hedef, kullanıcı veya metin ara"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div aria-label="Başlangıç tarihi">
            <DatePicker
              date={parseDateString(startDate)}
              onSelect={(date) => update("start", formatDateString(date))}
              placeholder="Başlangıç"
              className="w-40"
            />
          </div>
          <div aria-label="Bitiş tarihi">
            <DatePicker
              date={parseDateString(endDate)}
              onSelect={(date) => update("end", formatDateString(date))}
              placeholder="Bitiş"
              className="w-40"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setSearchText("");
              setParams((current) => {
                const next = new URLSearchParams(current);
                for (const key of [
                  "target",
                  "user",
                  "action",
                  "q",
                  "start",
                  "end",
                  "allProjects",
                ])
                  next.delete(key);
                return next;
              });
            }}
          >
            Tüm filtreleri temizle
          </Button>
        </div>
        {profile?.role !== "super_admin" && (
          <p className="text-xs text-muted-foreground">
            Denetim kaydı için üst menüden bir proje seçin. Birden fazla proje
            tek cursor altında birleştirilmez.
          </p>
        )}
        {rangeError && (
          <p role="alert" className="text-sm text-destructive">
            {rangeError}
          </p>
        )}
      </div>
      {loading ? (
        <SectionSkeleton label="Proje yükleniyor" />
      ) : !scopeReady ? (
        <EmptyState
          title="Proje seçin"
          description="Denetim kayıtlarını görmek için aktif bir proje seçin."
        />
      ) : rangeError ? (
        <ErrorState title="Tarih aralığı geçersiz" description={rangeError} />
      ) : (
        <AdminDataBoundary key={JSON.stringify(args)} label="Denetim kayıtları">
          <AuditRows args={args} />
        </AdminDataBoundary>
      )}
    </div>
  );
}

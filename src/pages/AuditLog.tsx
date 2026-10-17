import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useState, useEffect, useRef } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuditChangeDetail } from "@/components/audit/AuditChangeDetail";
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
    if (
      status !== "CanLoadMore" ||
      autoLoads.current >= 5 ||
      lastAutoLoad.current === loadMore
    )
      return;
    lastAutoLoad.current = loadMore;
    autoLoads.current += 1;
    loadMore(50);
  }, [results.length, status, loadMore]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
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
        {args.search && " · Arama sonuçları uygunluk sırasındadır."}
      </p>
      <p className="text-xs text-muted-foreground">
        Metin araması yeni kayıtların kullanıcı adı, hedef etiketi ve kayıt
        adı alanlarında çalışır. Eski kayıtların arama metni bulunmadığından
        metin aramasına dahil edilmez; geçmişi incelemek için aramayı temizleyin.
        {args.search &&
          (args.startDate || args.endDate) &&
          " Aramada tarih aralığı yüklenen sonuçlara uygulanır; eşleşme görmüyorsanız daha fazla yükleyin."}
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
              ? "Kapsamdaki diğer eşleşmeleri incelemek için daha fazla yükleyin."
              : "Seçili proje kapsamındaki sonuçlar gösteriliyor."
          }
        />
      ) : (
        <div
          className="space-y-3 md:space-y-0 md:rounded-xl md:border md:bg-card"
          role="table"
          aria-label="Denetim kayıtları"
        >
          <div
            role="row"
            className={`hidden gap-3 border-b p-3 text-sm font-medium md:grid ${args.allProjects ? "md:grid-cols-7" : "md:grid-cols-6"}`}
          >
            <span role="columnheader">Ayrıntı / Zaman (TR)</span>
            {args.allProjects && <span role="columnheader">Proje</span>}
            <span role="columnheader">Kullanıcı</span>
            <span role="columnheader">İşlem</span>
            <span role="columnheader">Hedef</span>
            <span role="columnheader">Kimlik</span>
            <span role="columnheader">Not</span>
          </div>
          {results.map((row) => {
            const expanded = expandedRow === row._id;
            const detailId = `audit-detail-${row._id}`;
            return (
              <div
                key={row._id}
                role="rowgroup"
                className="min-w-0 rounded-xl border bg-card md:rounded-none md:border-0 md:border-b md:last:border-b-0"
              >
                <div
                  role="row"
                  className={`grid min-w-0 grid-cols-1 items-start gap-3 p-3 text-sm ${args.allProjects ? "md:grid-cols-7" : "md:grid-cols-6"}`}
                >
                  <div role="cell" className="min-w-0">
                    <Button
                      variant="ghost"
                      className="h-auto min-h-11 w-full justify-start gap-2 whitespace-normal px-1 text-left"
                      aria-expanded={expanded}
                      aria-controls={detailId}
                      aria-label={`${timestampFormat.format(row.timestamp)} tarihli ${row.userName ?? "Bilinmeyen"} kaydının ayrıntısını ${expanded ? "kapat" : "aç"}`}
                      onClick={() => setExpandedRow(expanded ? null : row._id)}
                    >
                      {expanded ? (
                        <ChevronDown
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <ChevronRight
                          className="h-4 w-4 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span className="text-xs">
                        {timestampFormat.format(row.timestamp)}
                      </span>
                    </Button>
                  </div>
                  {args.allProjects && (
                    <div role="cell" className="min-w-0 break-words">
                      <span className="mr-2 font-medium md:hidden">Proje:</span>
                      {row.projectName}
                    </div>
                  )}
                  <div role="cell" className="min-w-0 break-words">
                    <span className="mr-2 font-medium md:hidden">
                      Kullanıcı:
                    </span>
                    {row.userName ?? "Bilinmeyen"}
                  </div>
                  <div role="cell">
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
                  </div>
                  <div role="cell" className="min-w-0 break-words">
                    <span className="mr-2 font-medium md:hidden">Hedef:</span>
                    {AUDIT_TARGET_LABELS[row.targetTable] ?? row.targetTable}
                  </div>
                  <div
                    role="cell"
                    className="min-w-0 break-all font-mono text-xs"
                  >
                    <span className="mr-2 font-sans font-medium md:hidden">
                      Kimlik:
                    </span>
                    {row.targetId}
                  </div>
                  <div
                    role="cell"
                    className="min-w-0 whitespace-pre-wrap break-words"
                  >
                    <span className="mr-2 font-medium md:hidden">Not:</span>
                    {row.note ?? "—"}
                  </div>
                </div>
                <div id={detailId} role="row" hidden={!expanded}>
                  <div role="cell" aria-colspan={args.allProjects ? 7 : 6}>
                    {expanded && (
                      <AuditChangeDetail
                        targetTable={row.targetTable}
                        targetId={row.targetId}
                        oldValue={row.oldValue}
                        newValue={row.newValue}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
      <SelectTrigger className="w-full sm:w-48" aria-label="Kullanıcı">
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
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (debouncedSearch) next.set("q", debouncedSearch);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
  }, [searchUrl, searchText, debouncedSearch, setParams]);
  const previousScope = useRef<string | null>(null);
  useEffect(() => {
    if (loading) return;
    const scope = `${projectId ?? "none"}:${allProjects}`;
    if (previousScope.current !== null && previousScope.current !== scope) {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("user");
          return next;
        },
        { replace: true },
      );
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
            <SelectTrigger className="w-full sm:w-48" aria-label="Hedef tablo">
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
            <SelectTrigger className="w-full sm:w-40" aria-label="İşlem türü">
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
            className="w-full sm:w-60"
            aria-label="Denetim kayıtlarında ara"
            placeholder="Kullanıcı, hedef etiketi veya not ara"
            maxLength={500}
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
          />
          <div className="w-full sm:w-auto" aria-label="Başlangıç tarihi">
            <DatePicker
              date={parseDateString(startDate)}
              onSelect={(date) => update("start", formatDateString(date))}
              placeholder="Başlangıç"
              className="w-full sm:w-40"
            />
          </div>
          <div className="w-full sm:w-auto" aria-label="Bitiş tarihi">
            <DatePicker
              date={parseDateString(endDate)}
              onSelect={(date) => update("end", formatDateString(date))}
              placeholder="Bitiş"
              className="w-full sm:w-40"
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

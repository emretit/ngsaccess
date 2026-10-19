import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { RowActions } from "@/components/shared/RowActions";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { StatInline } from "@/components/shared/StatInline";
import { DeviceSyncStatusBanner } from "@/components/sync/DeviceSyncStatusBanner";
import { useActiveProject } from "@/contexts/ActiveProjectContext";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useAccessRuleMutations } from "@/hooks/access-rules/useAccessRuleMutations";
import { formatWeekdaysAbbr } from "./components/weekdays";
import { AccessRuleDetails } from "./AccessRuleDetails";
import { ProjectSyncButton, RecentRuns } from "./SyncRuns";
import { loadRuleEditor } from "./lib/loadRuleEditor";
import { ruleTypeMatches } from "./lib/presentation";
import type { AccessRule } from "@/types/access-control";
import { PaginationBar } from "@/components/shared/PaginationBar";
type Summary = FunctionReturnType<
  typeof api.accessRules.listSummaries
>["page"][number];
interface Props {
  onCreateRule: () => void;
  onEditRule?: (rule: AccessRule) => void;
}
function scopeText(rule: Summary) {
  if (rule.scopeTruncated) return "Geniş kapsam · Ayrıntıyı aç";
  const panels = rule.panels
    .map(
      (panel) =>
        `${panel.label} · ${panel.wholePanel ? "tüm kapılar" : `${panel.selectedDoors}/${panel.totalDoors} kapı`}`,
    )
    .join(", ");
  return (
    [
      panels,
      rule.unassignedDoors.length
        ? "Panel bağlantısı yok; cihaza uygulanamaz"
        : "",
    ]
      .filter(Boolean)
      .join(" · ") || "Kapı veya panel seçilmemiş"
  );
}
function RuleRow({
  rule,
  projectId,
  onEditRule,
}: {
  rule: Summary;
  projectId: Id<"projects">;
  onEditRule?: Props["onEditRule"];
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const convex = useConvex();
  const { isAdmin } = useActiveProject();
  const { updateAccessRule, deleteAccessRule } = useAccessRuleMutations();
  const toggle = useAsyncAction(
    async () => {
      await updateAccessRule.mutateAsync({
        id: rule._id,
        updates: { isActive: !(rule.isActive ?? true) },
      });
    },
    { error: "Kural durumu değiştirilemedi" },
  );
  const edit = useAsyncAction(
    async () => {
      const details = await loadRuleEditor(convex, rule._id, projectId);
      onEditRule?.(details);
    },
    { error: "Kural ayrıntısı yüklenemedi" },
  );
  return (
    <>
      <TableRow className="h-16 md:h-[42px] md:[&_td]:py-1">
        <TableCell className="min-w-0">
          <Button
            variant="link"
            className="h-auto max-w-full whitespace-normal break-words p-0 text-left justify-start text-foreground"
            onClick={() => setOpen(true)}
          >
            {rule.name}
          </Button>
          <p className="md:hidden text-xs text-muted-foreground break-words">
            {scopeText(rule)}
          </p>
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          {rule.targetType === "visitor"
            ? "Ziyaretçi şablonu"
            : "Personel yetkisi"}
        </TableCell>
        <TableCell className="hidden lg:table-cell tabular-nums">
          {rule.memberCount}
          {rule.memberCountTruncated ? "+" : ""} kişi
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <p className="truncate" title={scopeText(rule)}>
            {scopeText(rule)}
          </p>
        </TableCell>
        <TableCell className="hidden xl:table-cell">
          <p>{formatWeekdaysAbbr(rule.days ?? [])}</p>
          <p className="text-xs text-muted-foreground">
            {rule.startTime && rule.endTime
              ? `${rule.startTime}–${rule.endTime}`
              : rule.startTime || rule.endTime
                ? "Eksik saat aralığı"
                : "Tüm gün"}
          </p>
        </TableCell>
        <TableCell className="px-2">
          <StatusBadge tone={(rule.isActive ?? true) ? "success" : "neutral"}>
            {(rule.isActive ?? true) ? "Aktif" : "Pasif"}
          </StatusBadge>
        </TableCell>
        <TableCell className="px-1 max-md:[&_button]:h-11 max-md:[&_button]:w-11">
          <RowActions label={`${rule.name} işlemleri`}>
            <DropdownMenuItem onSelect={() => setOpen(true)}>
              Ayrıntı
            </DropdownMenuItem>
            {isAdmin && (
              <>
                <DropdownMenuItem
                  disabled={edit.pending}
                  onSelect={() => void edit.run()}
                >
                  Düzenle
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={toggle.pending}
                  onSelect={() => void toggle.run()}
                >
                  {(rule.isActive ?? true) ? "Pasifleştir" : "Aktifleştir"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={deleteAccessRule.isPending}
                  onSelect={() => setDeleting(true)}
                >
                  Sil
                </DropdownMenuItem>
              </>
            )}
          </RowActions>
        </TableCell>
      </TableRow>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="break-words">{rule.name}</SheetTitle>
            <SheetDescription>
              {rule.targetType === "visitor"
                ? "Ziyaretçi şablonu"
                : "Personel yetkisi"}{" "}
              · {(rule.isActive ?? true) ? "Aktif" : "Pasif"} ·{" "}
              {formatWeekdaysAbbr(rule.days ?? [])} ·{" "}
              {rule.startTime && rule.endTime
                ? `${rule.startTime}–${rule.endTime}`
                : rule.startTime || rule.endTime
                  ? "Eksik saat aralığı · düzenleyin"
                  : "Tüm gün"}{" "}
              (Türkiye saati)
            </SheetDescription>
          </SheetHeader>
          <p className="mt-4 break-words">{rule.description}</p>
          {open && (
            <QuerySectionBoundary
              resetKey={rule._id}
              title="Kural ayrıntısı yüklenemedi"
            >
              <AccessRuleDetails ruleId={rule._id} projectId={projectId} />
            </QuerySectionBoundary>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDestructive
        open={deleting}
        onOpenChange={setDeleting}
        title="Erişim kuralı silinsin mi?"
        objectName={rule.name}
        effects={[
          "Kuralın kişi, cihaz ve kapı bağlantıları kaldırılır.",
          "Cihaz erişimleri kalan kurallara göre yeniden hesaplanır.",
        ]}
        confirmLabel="Kuralı sil"
        onConfirm={() => deleteAccessRule.mutateAsync(rule._id)}
      />
    </>
  );
}
function RulesPage({
  projectId,
  search,
  searchBy,
  status,
  type,
  onEditRule,
  onCreateRule,
  clear,
  onCount,
}: Props & {
  projectId: Id<"projects">;
  search: string;
  searchBy: "rule" | "person" | "door";
  status: "all" | "active" | "inactive";
  type: string;
  clear: () => void;
  onCount: (count: number | undefined) => void;
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const result = useQuery(api.accessRules.listSummaries, {
    projectId,
    search,
    searchBy,
    status,
    paginationOpts: {
      cursor: cursors[cursors.length - 1] ?? null,
      numItems: 20,
    },
  });
  useEffect(() => {
    onCount(
      result?.page.filter((rule) => ruleTypeMatches(rule.targetType, type))
        .length,
    );
  }, [result, type, onCount]);
  if (!result)
    return <SectionSkeleton rows={4} label="Erişim kuralları yükleniyor" />;
  const rows = result.page.filter((rule) =>
    ruleTypeMatches(rule.targetType, type),
  );
  return (
    <div className="space-y-3 min-w-0">
      {type !== "all" && (
        <p className="text-xs text-muted-foreground">
          Tür filtresi bu cursor sayfasındaki kayıtları daraltır. Diğer sonuçlar
          için sonraki sayfaya geçin.
        </p>
      )}
      {result.searchLimited ? (
        <EmptyState
          title="Aramayı daraltın"
          description="Çok fazla eşleşme var. Daha uzun bir kişi veya kapı adı yazın."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            search || status !== "all" || type !== "all"
              ? "Eşleşen kural yok"
              : "Henüz erişim kuralı yok"
          }
          description={
            !result.isDone
              ? "Bu sayfada eşleşme yok; sonraki sayfada devam edebilirsiniz."
              : "Kişi, kapı ve zaman seçerek kural oluşturabilirsiniz."
          }
          action={{
            onClick:
              search || status !== "all" || type !== "all"
                ? clear
                : onCreateRule,
            label:
              search || status !== "all" || type !== "all"
                ? "Filtreleri temizle"
                : "Yeni kural",
          }}
        />
      ) : (
        <div className="min-w-0 overflow-x-auto rounded-md border">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Kural</TableHead>
                <TableHead className="hidden lg:table-cell w-32">Tür</TableHead>
                <TableHead className="hidden lg:table-cell w-24">Kim</TableHead>
                <TableHead className="hidden md:table-cell w-[24%]">
                  Nereye
                </TableHead>
                <TableHead className="hidden xl:table-cell w-40">
                  Ne zaman
                </TableHead>
                <TableHead className="w-20">Durum</TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">İşlemler</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rule) => (
                <RuleRow
                  key={rule._id}
                  rule={rule}
                  projectId={projectId}
                  onEditRule={onEditRule}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PaginationBar
        summary={`Sayfa ${cursors.length} · ${rows.length} kural gösteriliyor`}
        page={cursors.length}
        onPrevious={() => setCursors((prev) => prev.slice(0, -1))}
        onNext={() => setCursors((prev) => [...prev, result.continueCursor])}
        nextDisabled={result.isDone}
      />
    </div>
  );
}
export default function AccessRulesList(props: Props) {
  const { projectId, activeProject, loading, isAdmin } = useActiveProject();
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const searchBy =
    params.get("by") === "person"
      ? "person"
      : params.get("by") === "door"
        ? "door"
        : "rule";
  const status =
    params.get("durum") === "active"
      ? "active"
      : params.get("durum") === "inactive"
        ? "inactive"
        : "all";
  const type =
    params.get("tur") === "visitor"
      ? "visitor"
      : params.get("tur") === "personnel"
        ? "personnel"
        : "all";
  const change = (key: string, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== "all") next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };
  const clear = () =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      ["q", "by", "durum", "tur"].forEach((key) => next.delete(key));
      return next;
    });
  const [pageCount, setPageCount] = useState<{
    key: string;
    count: number | undefined;
  } | null>(null);
  const queryKey = JSON.stringify([projectId, search, searchBy, status, type]);
  const onCount = useCallback(
    (count: number | undefined) => setPageCount({ key: queryKey, count }),
    [queryKey, setPageCount],
  );
  return (
    <div className="space-y-4 min-w-0">
      <PageHeader
        title="Geçiş Kontrol"
        scope={`${activeProject?.name ?? "Proje seçilmedi"} · Erişim kuralları`}
        primaryAction={
          isAdmin && projectId
            ? { label: "Yeni kural", onClick: props.onCreateRule }
            : undefined
        }
      >
        {isAdmin && projectId && (
          <QuerySectionBoundary resetKey={projectId}>
            <ProjectSyncButton projectId={projectId} />
          </QuerySectionBoundary>
        )}
      </PageHeader>
      {loading ? (
        <SectionSkeleton label="Proje yükleniyor" />
      ) : !projectId ? (
        <EmptyState
          title="Önce bir proje seçin"
          description="Erişim kuralları seçili proje için gösterilir."
        />
      ) : (
        <>
          <StatInline
            items={[
              {
                label: "Bu sayfada",
                value:
                  pageCount?.key === queryKey && pageCount.count !== undefined
                    ? `${pageCount.count} kural`
                    : null,
              },
            ]}
          />
          <QuerySectionBoundary resetKey={projectId}>
            <DeviceSyncStatusBanner />
          </QuerySectionBoundary>
          <FilterBar
            search={search}
            onSearchChange={(value) => change("q", value)}
            placeholder={
              searchBy === "person"
                ? "Kişi adı ara"
                : searchBy === "door"
                  ? "Kapı adı ara"
                  : "Kural adı ara"
            }
            hasFilters={
              status !== "all" || type !== "all" || searchBy !== "rule"
            }
            onClear={clear}
          >
            {[
              {
                key: "by",
                label: "Arama alanı",
                value: searchBy,
                options: [
                  ["rule", "Kural adı"],
                  ["person", "Kişi adı"],
                  ["door", "Kapı adı"],
                ],
              },
              {
                key: "durum",
                label: "Durum",
                value: status,
                options: [
                  ["all", "Tüm durumlar"],
                  ["active", "Aktif"],
                  ["inactive", "Pasif"],
                ],
              },
              {
                key: "tur",
                label: "Tür",
                value: type,
                options: [
                  ["all", "Tüm türler"],
                  ["personnel", "Personel yetkisi"],
                  ["visitor", "Ziyaretçi şablonu"],
                ],
              },
            ].map((filter) => (
              <label key={filter.key} className="min-w-0 text-xs">
                <span className="sr-only">{filter.label}</span>
                <select
                  className="h-9 max-w-full rounded-md border border-input bg-background px-2"
                  value={filter.value}
                  onChange={(event) => change(filter.key, event.target.value)}
                >
                  {filter.options.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </FilterBar>
          <QuerySectionBoundary
            resetKey={queryKey}
            title="Erişim kuralları yüklenemedi"
          >
            <RulesPage
              key={queryKey}
              projectId={projectId}
              search={search}
              searchBy={searchBy}
              status={status}
              type={type}
              clear={clear}
              onCount={onCount}
              {...props}
            />
          </QuerySectionBoundary>
          <QuerySectionBoundary resetKey={projectId}>
            <RecentRuns projectId={projectId} />
          </QuerySectionBoundary>
        </>
      )}
    </div>
  );
}

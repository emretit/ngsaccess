import { useEffect, useState } from "react";
import { useAction, useConvex, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { useActiveProjectScope } from "@/hooks/useActiveProjectScope";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useAccessRuleMutations } from "@/hooks/access-rules/useAccessRuleMutations";
import {
  useDeviceSyncing,
  deviceSyncStore,
} from "@/hooks/access-rules/deviceSyncStore";
import { notify } from "@/lib/notify";
import {
  ChevronDown,
  Edit,
  Plus,
  Shield,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { formatWeekdaysAbbr } from "./components/weekdays";
import { AccessRuleDetails } from "./AccessRuleDetails";
import type { AccessRule } from "@/types/access-control";

type Summary = FunctionReturnType<
  typeof api.accessRules.listSummaries
>["page"][number];
type SearchBy = "rule" | "person" | "door";
type Status = "all" | "active" | "inactive";
interface AccessRulesListProps {
  onCreateRule: () => void;
  onEditRule?: (rule: AccessRule) => void;
}

function RuleCard({
  rule,
  projectId,
  onEditRule,
}: {
  rule: Summary;
  projectId: Id<"projects">;
  onEditRule?: AccessRulesListProps["onEditRule"];
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const convex = useConvex();
  const { updateAccessRule, deleteAccessRule } = useAccessRuleMutations();
  const toggle = useAsyncAction(
    async (isActive: boolean) => {
      await updateAccessRule.mutateAsync({
        id: rule._id,
        updates: { isActive },
      });
    },
    { error: "Kural durumu değiştirilemedi" },
  );
  const edit = useAsyncAction(
    async () => {
      const details = await convex.query(api.accessRules.getDetails, {
        ruleId: rule._id,
        projectId,
      });
      onEditRule?.(details);
    },
    { error: "Kural ayrıntısı yüklenemedi" },
  );
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card className="min-w-0">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h3 className="break-words text-lg font-semibold">{rule.name}</h3>
              <StatusBadge
                tone={(rule.isActive ?? true) ? "success" : "neutral"}
              >
                {(rule.isActive ?? true) ? "Aktif" : "Pasif"}
              </StatusBadge>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <Switch
                aria-label={`${rule.name} kuralı aktif`}
                checked={rule.isActive ?? true}
                disabled={toggle.pending || deleteAccessRule.isPending}
                onCheckedChange={(checked) => void toggle.run(checked)}
              />
              {onEditRule && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`${rule.name} kuralını düzenle`}
                  disabled={edit.pending || deleteAccessRule.isPending}
                  onClick={() => void edit.run()}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                aria-label={`${rule.name} kuralını sil`}
                disabled={
                  toggle.pending || edit.pending || deleteAccessRule.isPending
                }
                onClick={() => setDeleting(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`${rule.name} ayrıntılarını ${open ? "kapat" : "aç"}`}
                >
                  <ChevronDown
                    className={`h-4 w-4 ${open ? "rotate-180" : ""}`}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
          {rule.description && (
            <p className="break-words text-sm text-muted-foreground">
              {rule.description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>
              {rule.memberCountTruncated
                ? `${rule.memberCount}+`
                : rule.memberCount}{" "}
              kişi
            </span>
            <span>
              {rule.startTime && rule.endTime
                ? `${rule.startTime} – ${rule.endTime}`
                : rule.startTime || rule.endTime
                  ? "Eksik saat aralığı — düzenleyin"
                  : "Tüm gün"}
            </span>
            <span>{formatWeekdaysAbbr(rule.days ?? [])}</span>
          </div>
          {rule.scopeTruncated ? (
            <p className="text-sm text-muted-foreground">
              Geniş kapı kapsamı; tam liste için ayrıntıyı açın.
            </p>
          ) : rule.panels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kapı veya panel seçilmemiş
            </p>
          ) : (
            <ul className="space-y-2">
              {rule.panels.map((panel) => (
                <li key={panel.deviceId} className="min-w-0 text-sm">
                  <p className="break-words font-medium">{panel.label}</p>
                  <p className="break-words text-xs text-muted-foreground">
                    {panel.doors
                      .map(
                        (door) =>
                          `${door.zoneName ? `${door.zoneName} → ` : ""}${door.name}`,
                      )
                      .join(", ")}
                    {panel.doorsTruncated ? " …" : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {rule.unassignedDoors.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Panel bağlantısı olmayan kapılar:{" "}
              {rule.unassignedDoors.map((door) => door.name).join(", ")} — kapı
              kapsamı cihaza uygulanamaz.
            </p>
          )}
          <CollapsibleContent>
            {open && (
              <QuerySectionBoundary
                title="Kural ayrıntısı yüklenemedi"
                resetKey={rule._id}
              >
                <AccessRuleDetails ruleId={rule._id} projectId={projectId} />
              </QuerySectionBoundary>
            )}
          </CollapsibleContent>
        </CardContent>
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
      </Card>
    </Collapsible>
  );
}

function RulesPage({
  projectId,
  search,
  searchBy,
  status,
  onEditRule,
}: {
  projectId: Id<"projects">;
  search: string;
  searchBy: SearchBy;
  status: Status;
  onEditRule?: AccessRulesListProps["onEditRule"];
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1] ?? null;
  const result = useQuery(api.accessRules.listSummaries, {
    projectId,
    search,
    searchBy,
    status,
    paginationOpts: { cursor, numItems: 20 },
  });
  if (!result)
    return <SectionSkeleton rows={4} label="Erişim kuralları yükleniyor" />;
  return (
    <div className="space-y-3">
      {result.searchLimited ? (
        <EmptyState
          title="Aramayı daraltın"
          description="Çok fazla kişi, kapı veya kural eşleşti. Daha uzun bir ad yazarak yeniden arayın."
        />
      ) : result.page.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={
            search || status !== "all"
              ? "Bu sayfada eşleşen kural yok"
              : "Henüz erişim kuralı yok"
          }
          description={
            !result.isDone
              ? "Diğer sonuçları görmek için sonraki sayfaya geçin."
              : "Arama ve durum filtrelerini değiştirebilir veya yeni kural oluşturabilirsiniz."
          }
        />
      ) : (
        result.page.map((rule) => (
          <RuleCard
            key={rule._id}
            rule={rule}
            projectId={projectId}
            onEditRule={onEditRule}
          />
        ))
      )}
      <nav
        aria-label="Kural sayfaları"
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <Button
          variant="outline"
          disabled={cursors.length === 1}
          onClick={() => setCursors((prev) => prev.slice(0, -1))}
        >
          Önceki
        </Button>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          Sayfa {cursors.length} · {result.page.length} kural
        </span>
        <Button
          variant="outline"
          disabled={result.isDone}
          onClick={() => setCursors((prev) => [...prev, result.continueCursor])}
        >
          Sonraki
        </Button>
      </nav>
    </div>
  );
}

function ProjectRules({
  projectId,
  onCreateRule,
  onEditRule,
}: AccessRulesListProps & { projectId: Id<"projects"> }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searchBy, setSearchBy] = useState<SearchBy>("rule");
  const [status, setStatus] = useState<Status>("all");
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);
  const backfillRules = useAction(
    api.actions.hikvisionSync.backfillAllRulesToDevices,
  );
  const syncing = useDeviceSyncing();
  const backfill = useAsyncAction(
    async () => {
      const finish = deviceSyncStore.start();
      try {
        const result = await backfillRules({ projectId });
        notify.info(
          "Senkronizasyon kuyruğa alındı",
          `${result.rulesProcessed} kural işlendi · ${result.synced} cihaz işlemi başlatıldı · ${result.failed} başlangıç hatası`,
        );
      } finally {
        finish();
      }
    },
    { error: "Senkronizasyon başlatılamadı" },
  );
  const queryKey = JSON.stringify([
    projectId,
    debouncedSearch,
    searchBy,
    status,
  ]);
  const selectClass =
    "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Erişim kuralları</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={syncing || backfill.pending}
              onClick={() => void backfill.run()}
            >
              <UploadCloud className="mr-2 h-4 w-4" />
              {syncing || backfill.pending
                ? "Senkronize ediliyor…"
                : "Cihazlara gönder"}
            </Button>
            <Button size="sm" onClick={onCreateRule}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni kural
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_9rem_8rem]">
          <div className="space-y-1">
            <Label htmlFor="rule-search">Ara</Label>
            <Input
              id="rule-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ad yazın…"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rule-search-by">Arama alanı</Label>
            <select
              id="rule-search-by"
              className={selectClass}
              value={searchBy}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "rule" || value === "person" || value === "door")
                  setSearchBy(value);
              }}
            >
              <option value="rule">Kural adı</option>
              <option value="person">Kişi adı</option>
              <option value="door">Kapı adı</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="rule-status">Durum</Label>
            <select
              id="rule-status"
              className={selectClass}
              value={status}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "all" ||
                  value === "active" ||
                  value === "inactive"
                )
                  setStatus(value);
              }}
            >
              <option value="all">Tümü</option>
              <option value="active">Aktif</option>
              <option value="inactive">Pasif</option>
            </select>
          </div>
        </div>
      </div>
      <QuerySectionBoundary
        title="Erişim kuralları yüklenemedi"
        resetKey={queryKey}
      >
        <RulesPage
          key={queryKey}
          projectId={projectId}
          search={debouncedSearch}
          searchBy={searchBy}
          status={status}
          onEditRule={onEditRule}
        />
      </QuerySectionBoundary>
    </div>
  );
}

export default function AccessRulesList(props: AccessRulesListProps) {
  const { projectId, loading } = useActiveProjectScope();
  if (loading) return <SectionSkeleton label="Proje yükleniyor" />;
  if (!projectId)
    return (
      <EmptyState
        title="Önce bir proje seçin"
        description="Erişim kuralları seçili proje için gösterilir."
      />
    );
  return <ProjectRules key={projectId} projectId={projectId} {...props} />;
}

import { usePermissions } from "@/hooks/usePermissions";
import { RuleScheduleSummary } from "../templates/RuleScheduleSummary";
import { useState } from "react";
import { useConvex } from "convex/react";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDestructive } from "@/components/shared/ConfirmDestructive";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { RowActions } from "@/components/shared/RowActions";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useAccessRuleMutations } from "@/hooks/access-rules/useAccessRuleMutations";
import { formatWeekdaysAbbr } from "../components/weekdays";
import { AccessRuleDetails } from "../AccessRuleDetails";
import { loadRuleEditor } from "../lib/loadRuleEditor";
import { scopeText } from "./accessRulesListModel";
import { onRowActivate, ROW_CLICK_CLASS } from "@/lib/tableRowClick";
import type { Summary } from "./accessRulesListModel";
import type { Props } from "./types";
export function RuleRow({
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
  const { can } = usePermissions();
  const canManage = can("accessRules.manage");
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
      setOpen(false);
      onEditRule?.(details);
    },
    { error: "Kural ayrıntısı yüklenemedi" },
  );
  return (
    <>
      <TableRow
        className={`h-16 md:h-[42px] md:[&_td]:py-1 ${ROW_CLICK_CLASS}`}
        onClick={onRowActivate(() => setOpen(true))}
      >
        <TableCell className="min-w-0">
          <Button
            variant="link"
            className="h-auto min-h-11 md:min-h-0 w-full max-w-full whitespace-normal break-words p-0 text-left justify-start text-foreground hover:no-underline"
            onClick={() => setOpen(true)}
          >
            {rule.name}
          </Button>
          <p className="md:hidden text-xs text-muted-foreground break-words">
            {scopeText(rule)}
          </p>
          <p className="xl:hidden text-xs text-muted-foreground break-words">
            {rule.scheduleTemplateId ? (
              <RuleScheduleSummary
                templateId={rule.scheduleTemplateId}
                projectId={projectId}
              />
            ) : (
              <>
                {formatWeekdaysAbbr(rule.days ?? [])} ·{" "}
                {rule.startTime && rule.endTime
                  ? `${rule.startTime}–${rule.endTime}`
                  : rule.startTime || rule.endTime
                    ? "Eksik saat aralığı"
                    : "Tüm gün"}
              </>
            )}
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
          {rule.scheduleTemplateId ? (
            <RuleScheduleSummary
              templateId={rule.scheduleTemplateId}
              projectId={projectId}
            />
          ) : (
            <>
              <p>{formatWeekdaysAbbr(rule.days ?? [])}</p>
              <p className="text-xs text-muted-foreground">
                {rule.startTime && rule.endTime
                  ? `${rule.startTime}–${rule.endTime}`
                  : rule.startTime || rule.endTime
                    ? "Eksik saat aralığı"
                    : "Tüm gün"}
              </p>
            </>
          )}
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
            {canManage && (
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
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <SheetTitle className="min-w-0 break-words">{rule.name}</SheetTitle>
              {canManage && (
                <Button
                  variant="outline"
                  className="min-h-11 md:min-h-0"
                  disabled={edit.pending}
                  onClick={() => void edit.run()}
                >
                  Düzenle
                </Button>
              )}
            </div>
            <SheetDescription>
              {rule.targetType === "visitor"
                ? "Ziyaretçi şablonu"
                : "Personel yetkisi"}{" "}
              · {(rule.isActive ?? true) ? "Aktif" : "Pasif"} ·{" "}
              {rule.scheduleTemplateId ? (
                <RuleScheduleSummary
                  templateId={rule.scheduleTemplateId}
                  projectId={projectId}
                />
              ) : (
                <>
                  {formatWeekdaysAbbr(rule.days ?? [])} ·{" "}
                  {rule.startTime && rule.endTime
                    ? `${rule.startTime}–${rule.endTime}`
                    : rule.startTime || rule.endTime
                      ? "Eksik saat aralığı · düzenleyin"
                      : "Tüm gün"}{" "}
                  (Türkiye saati)
                </>
              )}
            </SheetDescription>
          </SheetHeader>
          {rule.description?.trim() && (
            <p className="mt-4 break-words">{rule.description}</p>
          )}
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

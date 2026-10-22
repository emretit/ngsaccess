import { EmptyState } from "@/components/shared/EmptyState";
import type { readRuleFilters } from "./accessRulesListModel";
export function RulesEmptyState({
  search,
  status,
  type,
  isDone,
  clear,
  onCreateRule,
}: Pick<ReturnType<typeof readRuleFilters>, "search" | "status" | "type"> & {
  isDone: boolean;
  clear: () => void;
  onCreateRule: () => void;
}) {
  return (
    <EmptyState
      title={
        search || status !== "all" || type !== "all"
          ? "Eşleşen kural yok"
          : "Henüz erişim kuralı yok"
      }
      description={
        !isDone
          ? "Bu sayfada eşleşme yok; sonraki sayfada devam edebilirsiniz."
          : "Kişi, kapı ve zaman seçerek kural oluşturabilirsiniz."
      }
      action={{
        onClick:
          search || status !== "all" || type !== "all" ? clear : onCreateRule,
        label:
          search || status !== "all" || type !== "all"
            ? "Filtreleri temizle"
            : "Yeni kural",
      }}
    />
  );
}

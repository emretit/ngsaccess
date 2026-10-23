import type { PdksRecordsView } from "./usePdksRecordsView";
import { PdksCounters } from "./PdksCounters";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { BulkBar } from "@/components/shared/BulkBar";
import { clearPdksFilters } from "@/components/pdks/dashboard/PDKSFilterBar";
import { PDKSTableView } from "@/components/pdks/dashboard/PDKSTableView";
import { PDKSHeatmapView } from "@/components/pdks/dashboard/PDKSHeatmapView";
export function PdksRecordsResults({ view }: { view: PdksRecordsView }) {
  const { projectLoading, isLoading, projectId, selectedIds, setSelection, scope, records, hasFilters, setSmartPreset, setFilters, filters, navigate, openDetail, selectedDateKey, startDate, endDate } = view;
  return (<>
      {projectLoading || isLoading ? (
        <SectionSkeleton rows={6} label="PDKS kayıtları yükleniyor." />
      ) : !projectId ? (
        <EmptyState
          title="Bir proje seçin."
          description="PDKS kayıtlarını görmek için üst çubuktan proje seçin."
        />
      ) : (
        <>
          <PdksCounters {...view} />
          <BulkBar
            count={selectedIds.size}
            onClear={() => setSelection({ scope, ids: new Set() })}
          >
            <span className="text-xs">
              Dışa aktar menüsü seçili satırları kullanır.
            </span>
          </BulkBar>
          {records.length === 0 ? (
            <EmptyState
              title={
                hasFilters
                  ? "Bu filtrelerle eşleşen personel yok."
                  : "Bu projede personel bulunamadı."
              }
              description={
                hasFilters
                  ? "Aramayı değiştirin veya filtreleri temizleyin."
                  : "Personel ekleyerek PDKS kayıtlarını izlemeye başlayın."
              }
              action={{
                label: hasFilters ? "Filtreleri temizle" : "Kişilere git",
                onClick: () => {
                  if (hasFilters) {
                    setSmartPreset(null);
                    setFilters(clearPdksFilters(filters));
                  } else navigate("/employees");
                },
              }}
            />
          ) : filters.reportType === "daily" ? (
            <PDKSTableView
              records={records}
              selectedIds={selectedIds}
              onSelectionChange={(ids) => setSelection({ scope, ids })}
              onShowDetail={(id) => openDetail(id, selectedDateKey)}
            />
          ) : (
            <PDKSHeatmapView
              records={records}
              loading={false}
              startDate={startDate}
              endDate={endDate}
              onCellClick={openDetail}
            />
          )}
          <p className="text-xs text-muted-foreground">
            {records.length} personel gösteriliyor · Saatler İstanbul saatidir.
          </p>
        </>
      )}
  </>);
}

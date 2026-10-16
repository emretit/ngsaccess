import { useProjectFilteredCardReadings } from "@/hooks/useProjectFilteredCardReadings";
import { CardReadingsFilters } from "./CardReadingsFilters";
import { CardReadingsTable } from "./CardReadingsTable";
import { SectionSkeleton } from "@/components/shared/SectionSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const CardReadings = () => {
  const state = useProjectFilteredCardReadings(100);
  const { data, isLoading, hasProject, hasMore, isLoadingMore, loadMore, dateRangeError,
    searchTerm, setSearchTerm, dateFilter, setDateFilter, endDateFilter, setEndDateFilter,
    accessFilter, setAccessFilter, deviceId, setDeviceId } = state;
  const handleClearFilters = () => {
    setSearchTerm(""); setDateFilter(undefined); setEndDateFilter(undefined);
    setAccessFilter("all"); setDeviceId(undefined);
  };
  const emptyMessage = searchTerm.trim()
    ? hasMore
      ? "Yüklenen kayıtlarda eşleşme yok. Daha eski kayıtlarda olabilir — daha fazla yükle."
      : "Yüklenen kayıtlarda eşleşme yok. Seçili kapsamın tüm kayıtları yüklendi."
    : hasMore ? "Henüz kayıt yüklenmedi. Daha eski kayıtlar için daha fazla yükle." : "Seçili proje ve filtrelerde geçiş kaydı bulunamadı.";

  return (
    <div className="space-y-3">
      <CardReadingsFilters {...state} loadedCount={data.loadedCount} />
      {!hasProject && !isLoading ? <EmptyState title="Proje seçin" description="Geçiş kayıtlarını görmek için aktif bir proje seçin." />
        : dateRangeError ? <p role="alert" className="text-sm text-destructive">{dateRangeError}</p>
        : isLoading ? <SectionSkeleton rows={6} label="Geçiş kayıtları yükleniyor" />
        : <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
          <CardReadingsTable readings={data.readings} emptyMessage={emptyMessage}
            showClearFilters={Boolean(searchTerm || dateFilter || endDateFilter || deviceId || accessFilter !== "all")}
            onClearFilters={handleClearFilters} />
        </div>}
      {hasProject && !dateRangeError && hasMore && <div className="flex justify-center">
        <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
          {isLoadingMore ? "Yükleniyor…" : "Daha fazla yükle"}
        </Button>
      </div>}
    </div>
  );
};
export default CardReadings;

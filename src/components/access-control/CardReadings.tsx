import { Loader2 } from "lucide-react";
import { EmployeePagination } from "@/components/employees/EmployeePagination";
import { useProjectFilteredCardReadings } from "@/hooks/useProjectFilteredCardReadings";
import { CardReadingsFilters } from "./CardReadingsFilters";
import { CardReadingsTable } from "./CardReadingsTable";
import { ErrorState } from "@/components/shared/ErrorState";

const PAGE_SIZE = 100;

const CardReadings = () => {
  const {
    data,
    isLoading,
    error,
    currentPage,
    setCurrentPage,
    searchTerm,
    setSearchTerm,
    dateFilter,
    setDateFilter,
    accessFilter,
    setAccessFilter,
    totalPages,
  } = useProjectFilteredCardReadings(PAGE_SIZE);

  const handleRefresh = () => {};
  const handleClearFilters = () => {
    setSearchTerm("");
    setDateFilter(undefined);
    setAccessFilter("all");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-lg">Yükleniyor...</span>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState description="Kart okutma kayıtları yüklenirken bir hata oluştu." />
    );
  }

  const readings = data?.readings ?? [];
  const totalCount = data?.totalCount ?? 0;
  const emptyMessage =
    searchTerm || dateFilter || accessFilter !== "all"
      ? "Arama kriterlerinize uygun kayıt bulunamadı."
      : "Görüntülenecek kart okutma kaydı bulunamadı.";

  return (
    <div className="space-y-3">
      <CardReadingsFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        accessFilter={accessFilter}
        setAccessFilter={setAccessFilter}
        handleRefresh={handleRefresh}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
      />

      <div className="rounded-xl border bg-card shadow-xs overflow-hidden">
        <CardReadingsTable
          readings={readings}
          emptyMessage={emptyMessage}
          showClearFilters={Boolean(searchTerm || dateFilter || accessFilter !== "all")}
          onClearFilters={handleClearFilters}
        />
      </div>

      {totalPages > 1 && (
        <EmployeePagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};

export default CardReadings;

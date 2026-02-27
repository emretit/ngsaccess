import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { EmployeePagination } from "@/components/employees/EmployeePagination";
import { useProjectFilteredCardReadings } from "@/hooks/useProjectFilteredCardReadings";
import { CardReadingsFilters } from "./CardReadingsFilters";
import { CardReadingsTable } from "./CardReadingsTable";

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

  // Convex useQuery otomatik realtime sağlar

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
      <div className="p-6 text-center text-red-500">
        <p>Kart okutma kayıtları yüklenirken bir hata oluştu.</p>
      </div>
    );
  }

  const readings = data?.readings ?? [];
  const totalCount = data?.totalCount ?? 0;
  const emptyMessage =
    searchTerm || dateFilter || accessFilter !== "all"
      ? "Arama kriterlerinize uygun kayıt bulunamadı."
      : "Görüntülenecek kart okutma kaydı bulunamadı.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <h2 className="text-2xl font-bold">Kart Okuma Kayıtları</h2>
        <CardReadingsFilters
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          accessFilter={accessFilter}
          setAccessFilter={setAccessFilter}
          handleRefresh={handleRefresh}
        />
      </div>

      <Card>
        <div className="p-6">
          {totalCount > 0 && (
            <div className="mb-4 text-sm text-muted-foreground">
              {totalCount} kayıttan {(currentPage - 1) * PAGE_SIZE + 1} -{" "}
              {Math.min(currentPage * PAGE_SIZE, totalCount)} arası görüntüleniyor
            </div>
          )}

          <CardReadingsTable
            readings={readings}
            emptyMessage={emptyMessage}
            showClearFilters={Boolean(searchTerm || dateFilter || accessFilter !== "all")}
            onClearFilters={handleClearFilters}
          />

          {totalPages > 1 && (
            <div className="mt-4">
              <EmployeePagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default CardReadings;

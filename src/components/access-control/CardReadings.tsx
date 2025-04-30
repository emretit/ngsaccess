
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmployeePagination } from "@/components/employees/EmployeePagination";
import { useCardReadings } from "@/hooks/useCardReadings";
import { CardReadingsFilters } from "./CardReadingsFilters";
import { CardReadingsTable } from "./CardReadingsTable";

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
    handleRefresh,
    handleClearFilters,
    totalPages,
    pageSize
  } = useCardReadings(100);

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
        <p>{(error as Error).message}</p>
      </div>
    );
  }

  if (!data?.readings || data.readings.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">Kart Okuma Kayıtları</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <Loader2 className="h-4 w-4 mr-2" />
              Yenile
            </Button>
          </div>
        </div>
        <Card>
          <div className="p-6 text-center text-muted-foreground">
            {searchTerm || dateFilter || accessFilter !== 'all' ? (
              <>
                <p>Arama kriterlerinize uygun kayıt bulunamadı.</p>
                <Button variant="ghost" size="sm" onClick={handleClearFilters} className="mt-2">
                  Filtreleri Temizle
                </Button>
              </>
            ) : (
              <p>Görüntülenecek kart okutma kaydı bulunamadı.</p>
            )}
          </div>
        </Card>
      </div>
    );
  }

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
          <div className="mb-4 text-sm text-muted-foreground">
            {data.totalCount} kayıttan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, data.totalCount)} arası görüntüleniyor
          </div>
          
          <CardReadingsTable readings={data.readings} />
          
          <div className="mt-4">
            <EmployeePagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CardReadings;

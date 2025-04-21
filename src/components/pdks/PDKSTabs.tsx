
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AiInsightsCard } from "@/components/pdks/AiInsightsCard";
import { PDKSTable } from "./PDKSTable";

interface PDKSRecord {
  id: number;
  employee_first_name: string;
  employee_last_name: string;
  date: string;
  entry_time: string;
  exit_time: string;
  status: string;
}

interface PDKSTabsProps {
  records: PDKSRecord[];
  filteredRecords: PDKSRecord[];
  loading: boolean;
  searchTerm: string;
  statusFilter: string;
  insight: string;
  isLoadingInsight: boolean;
}

export function PDKSTabs({
  records,
  filteredRecords,
  loading,
  searchTerm,
  statusFilter,
  insight,
  isLoadingInsight
}: PDKSTabsProps) {
  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="summary">Özet</TabsTrigger>
        <TabsTrigger value="attendance">Devam Tablosu</TabsTrigger>
        <TabsTrigger value="department">Departman</TabsTrigger>
        <TabsTrigger value="detailed">Detaylı</TabsTrigger>
      </TabsList>
      
      <TabsContent value="summary" className="mt-4 space-y-4">
        <AiInsightsCard insight={insight} isLoading={isLoadingInsight} />
        {/* Add other summary cards/stats here */}
      </TabsContent>
      
      <TabsContent value="attendance" className="mt-4">
        <div className="glass-card overflow-hidden">
          <PDKSTable
            records={filteredRecords}
            loading={loading}
            searchTerm={searchTerm}
            statusFilter={statusFilter}
          />
        </div>
      </TabsContent>
      
      <TabsContent value="department" className="mt-4">
        <div className="glass-card p-6">
          <h3 className="font-medium text-lg mb-4">Departman Raporları</h3>
          <p className="text-gray-500">Bu özellik henüz geliştirilmektedir.</p>
        </div>
      </TabsContent>
      
      <TabsContent value="detailed" className="mt-4">
        <div className="glass-card p-6">
          <h3 className="font-medium text-lg mb-4">Detaylı Raporlar</h3>
          <p className="text-gray-500">Bu özellik henüz geliştirilmektedir.</p>
        </div>
      </TabsContent>
    </Tabs>
  );
}

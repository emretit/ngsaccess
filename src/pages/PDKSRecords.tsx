import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Filter, Download, RefreshCcw, MessageSquare } from "lucide-react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AiChatPanel } from "@/components/pdks/AiChatPanel";
import { AiDrawer } from "@/components/pdks/AiDrawer";
import { AiInsightsCard } from "@/components/pdks/AiInsightsCard";
import { usePdksAi } from "@/hooks/usePdksAi";
import { useMedia } from "@/hooks/use-mobile";
import { PDKSHeader } from "@/components/pdks/PDKSHeader";
import { PDKSTabs } from "@/components/pdks/PDKSTabs";

interface PDKSRecord {
  id: number;
  employee_first_name: string;
  employee_last_name: string;
  date: string;
  entry_time: string;
  exit_time: string;
  status: string;
}

export default function PDKSRecords() {
  const [records, setRecords] = useState<PDKSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const { insight, isLoadingInsight, fetchInsight } = usePdksAi();
  const isMobile = useMedia("(max-width: 768px)");

  useEffect(() => {
    fetchRecords();
    fetchInsight({});
  }, []);

  async function fetchRecords() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pdks_records')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (error) {
      console.error('Error fetching PDKS records:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRecords = records.filter(record => {
    const fullName = `${record.employee_first_name} ${record.employee_last_name}`.toLowerCase();
    const matchesSearch = searchTerm === "" || fullName.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleRefresh = () => {
    fetchRecords();
  };

  const handleExportCSV = () => {
    const headers = ["Ad Soyad", "Tarih", "Giriş Saati", "Çıkış Saati", "Durum"];
    
    const csvRows = [
      headers.join(','),
      ...filteredRecords.map(record => {
        const values = [
          `${record.employee_first_name} ${record.employee_last_name}`,
          new Date(record.date).toLocaleDateString('tr-TR'),
          record.entry_time,
          record.exit_time,
          record.status === 'present' ? 'Mevcut' : record.status === 'late' ? 'Geç' : 'Yok'
        ];
        return values.join(',');
      })
    ];
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.setAttribute('href', url);
    link.setAttribute('download', `pdks_records_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="flex-1 p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <PDKSHeader
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          onRefresh={handleRefresh}
          onExportCSV={handleExportCSV}
          onAiPanelToggle={() => setShowAiPanel(!showAiPanel)}
          showAiPanel={showAiPanel}
          isMobile={isMobile}
          AiDrawer={isMobile ? <AiDrawer filters={{ statusFilter }} /> : undefined}
        />

        <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-12rem)]">
          <ResizablePanel defaultSize={showAiPanel ? 60 : 100} minSize={40}>
            <PDKSTabs
              records={records}
              filteredRecords={filteredRecords}
              loading={loading}
              searchTerm={searchTerm}
              statusFilter={statusFilter}
              insight={insight}
              isLoadingInsight={isLoadingInsight}
            />
          </ResizablePanel>
          
          {showAiPanel && !isMobile && (
            <>
              <ResizableHandle withHandle className="border-l border-r border-gray-200" />
              <ResizablePanel defaultSize={40} minSize={30}>
                <AiChatPanel 
                  onClose={() => setShowAiPanel(false)}
                  filters={{ statusFilter }}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </main>
  );
}

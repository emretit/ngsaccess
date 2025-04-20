
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-2xl font-semibold text-gray-900">PDKS Kayıtları</h1>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                placeholder="Personel ara..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Durum Filtrele" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="all">Tümü</SelectItem>
                  <SelectItem value="present">Mevcut</SelectItem>
                  <SelectItem value="late">Geç</SelectItem>
                  <SelectItem value="absent">Yok</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handleRefresh} title="Yenile">
                <RefreshCcw size={16} />
              </Button>
              <Button variant="outline" size="icon" onClick={handleExportCSV} title="CSV İndir">
                <Download size={16} />
              </Button>
              {!isMobile && (
                <Button 
                  variant={showAiPanel ? "default" : "outline"} 
                  size="icon" 
                  onClick={() => setShowAiPanel(!showAiPanel)}
                  title="AI Asistan"
                >
                  <MessageSquare size={16} />
                </Button>
              )}
              {isMobile && <AiDrawer filters={{ statusFilter }} />}
            </div>
          </div>
        </div>

        <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-12rem)]">
          <ResizablePanel defaultSize={showAiPanel ? 60 : 100} minSize={40}>
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
                  {loading ? (
                    <div className="flex justify-center items-center py-12">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-primary rounded-full animate-bounce"></div>
                        <div className="w-3 h-3 bg-primary rounded-full animate-bounce animation-delay-200"></div>
                        <div className="w-3 h-3 bg-primary rounded-full animate-bounce animation-delay-400"></div>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead className="font-semibold">Ad Soyad</TableHead>
                            <TableHead className="font-semibold">Tarih</TableHead>
                            <TableHead className="font-semibold">Giriş Saati</TableHead>
                            <TableHead className="font-semibold">Çıkış Saati</TableHead>
                            <TableHead className="font-semibold">Durum</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecords.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                {searchTerm || statusFilter !== "all" 
                                  ? "Arama kriterlerine uygun kayıt bulunamadı" 
                                  : "Henüz kayıt bulunmuyor"}
                              </TableCell>
                            </TableRow>
                          ) : (
                            filteredRecords.map((record) => (
                              <TableRow key={record.id} className="hover:bg-muted/30 transition-colors">
                                <TableCell className="font-medium">
                                  {record.employee_first_name} {record.employee_last_name}
                                </TableCell>
                                <TableCell>{new Date(record.date).toLocaleDateString('tr-TR')}</TableCell>
                                <TableCell>{record.entry_time}</TableCell>
                                <TableCell>{record.exit_time}</TableCell>
                                <TableCell>
                                  <span className={`pill-badge ${
                                    record.status === 'present' 
                                      ? 'bg-green-100 text-green-800'
                                      : record.status === 'late'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}>
                                    {record.status === 'present' ? 'Mevcut' 
                                     : record.status === 'late' ? 'Geç' 
                                     : 'Yok'}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
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

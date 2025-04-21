
import { Search, RefreshCcw, Download, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PDKSHeaderProps {
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  onRefresh: () => void;
  onExportCSV: () => void;
  onAiPanelToggle?: () => void;
  showAiPanel?: boolean;
  isMobile: boolean;
  AiDrawer?: React.ReactNode;
}

export function PDKSHeader({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  onRefresh,
  onExportCSV,
  onAiPanelToggle,
  showAiPanel,
  isMobile,
  AiDrawer
}: PDKSHeaderProps) {
  return (
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
          <Button variant="outline" size="icon" onClick={onRefresh} title="Yenile">
            <RefreshCcw size={16} />
          </Button>
          <Button variant="outline" size="icon" onClick={onExportCSV} title="CSV İndir">
            <Download size={16} />
          </Button>
          {!isMobile && onAiPanelToggle && (
            <Button 
              variant={showAiPanel ? "default" : "outline"} 
              size="icon" 
              onClick={onAiPanelToggle}
              title="AI Asistan"
            >
              <MessageSquare size={16} />
            </Button>
          )}
          {isMobile && AiDrawer}
        </div>
      </div>
    </div>
  );
}

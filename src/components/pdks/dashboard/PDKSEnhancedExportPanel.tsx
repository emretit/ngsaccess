
import { useState } from "react";
import { Download, Mail, Calendar, FileText, FileSpreadsheet, FilePdf } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export function PDKSEnhancedExportPanel() {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExport = async (format: string) => {
    setIsExporting(true);
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    toast({
      title: "Dışa Aktarma Tamamlandı",
      description: `Rapor ${format} formatında başarıyla oluşturuldu.`,
    });
    
    setIsExporting(false);
  };

  const handleEmailReport = () => {
    toast({
      title: "Email Gönderildi",
      description: "Rapor belirlenen email adreslerine gönderildi.",
    });
  };

  const handleScheduleReport = () => {
    toast({
      title: "Rapor Zamanlandı",
      description: "Otomatik rapor zamanlaması ayarlandı.",
    });
  };

  return (
    <div className="space-y-4">
      {/* Quick Export Actions */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="h-5 w-5 text-[#711A1A]" />
            Hızlı Dışa Aktarma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                className="w-full bg-[#711A1A] hover:bg-[#711A1A]/90 text-white shadow-md"
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Dışa Aktarılıyor..." : "Rapor İndir"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48">
              <DropdownMenuItem onClick={() => handleExport("Excel")}>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("PDF")}>
                <FilePdf className="mr-2 h-4 w-4 text-red-600" />
                PDF Raporu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("CSV")}>
                <FileText className="mr-2 h-4 w-4 text-blue-600" />
                CSV Verileri
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="grid grid-cols-2 gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleEmailReport}
              className="border-[#711A1A] text-[#711A1A] hover:bg-[#711A1A]/5"
            >
              <Mail className="mr-1 h-3 w-3" />
              Email
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleScheduleReport}
              className="border-[#711A1A] text-[#711A1A] hover:bg-[#711A1A]/5"
            >
              <Calendar className="mr-1 h-3 w-3" />
              Zamanla
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export Templates */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Rapor Şablonları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-sm font-medium">Günlük Özet</span>
              <Badge variant="outline" className="text-xs">Popüler</Badge>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-medium">Haftalık Analiz</span>
              <Badge variant="outline" className="text-xs">Yeni</Badge>
            </div>
            <div className="flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-200">
              <span className="text-sm font-medium">Aylık Rapor</span>
              <Badge variant="outline" className="text-xs">Standart</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Exports */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-white to-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Son Dışa Aktarmalar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Günlük Rapor - 30.06.2025</span>
              <span className="text-green-600">✓</span>
            </div>
            <div className="flex justify-between">
              <span>Haftalık Özet - 29.06.2025</span>
              <span className="text-green-600">✓</span>
            </div>
            <div className="flex justify-between">
              <span>Departman Analizi - 28.06.2025</span>
              <span className="text-green-600">✓</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

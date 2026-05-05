
import { useState } from "react";
import { Download, Mail, Calendar, FileText, FileSpreadsheet, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PDKSExportPanel() {
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);

  const handleExport = (format: string) => {
    console.log(`Exporting as ${format}`);
    // Implement export logic here
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Dışa Aktarma & İşlemler
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full bg-primary hover:bg-primary/90">
              <Download className="mr-2 h-4 w-4" />
              Rapor İndir
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem onClick={() => handleExport('excel')}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('pdf')}>
              <FileImage className="mr-2 h-4 w-4" />
              PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')}>
              <FileText className="mr-2 h-4 w-4" />
              CSV
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Email Report */}
        <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Mail className="mr-2 h-4 w-4" />
              E-posta Gönder
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Raporu E-posta ile Gönder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">E-posta Adresi</Label>
                <Input id="email" type="email" placeholder="ornek@sirket.com" />
              </div>
              <div>
                <Label htmlFor="subject">Konu</Label>
                <Input id="subject" placeholder="PDKS Raporu" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
                  İptal
                </Button>
                <Button className="bg-primary hover:bg-primary/90">
                  Gönder
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Schedule Report */}
        <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Calendar className="mr-2 h-4 w-4" />
              Rapor Zamanla
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Otomatik Rapor Zamanla</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="frequency">Sıklık</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Rapor sıklığı seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Günlük</SelectItem>
                    <SelectItem value="weekly">Haftalık</SelectItem>
                    <SelectItem value="monthly">Aylık</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="schedule-email">E-posta Adresi</Label>
                <Input id="schedule-email" type="email" placeholder="ornek@sirket.com" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                  İptal
                </Button>
                <Button className="bg-primary hover:bg-primary/90">
                  Zamanla
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

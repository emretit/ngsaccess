
import { useState } from "react";
import { Menu, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PDKSFilterBar } from "./PDKSFilterBar";

interface PDKSMobileDrawerProps {
  onFiltersChange: (filters: any) => void;
}

export function PDKSMobileDrawer({ onFiltersChange }: PDKSMobileDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="border-primary text-primary">
            <Menu className="h-4 w-4 mr-2" />
            Filtreler
          </Button>
        </SheetTrigger>
        <SheetContent side="top" className="h-auto max-h-[80vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtreler ve Arama
            </SheetTitle>
          </SheetHeader>
          <PDKSFilterBar onFiltersChange={onFiltersChange} />
          <div className="mt-6 pt-4 border-t">
            <Button 
              onClick={() => setIsOpen(false)}
              className="w-full bg-primary hover:bg-primary/90"
            >
              <X className="mr-2 h-4 w-4" />
              Kapat
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

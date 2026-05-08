import { useState } from "react";
import { Menu, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PDKSFilterBar, type FilterValues } from "./PDKSFilterBar";

interface PDKSMobileDrawerProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  activeFilterCount?: number;
}

export function PDKSMobileDrawer({
  values,
  onChange,
  activeFilterCount = 0,
}: PDKSMobileDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="relative gap-2">
            <Menu className="h-4 w-4" />
            <span className="hidden xs:inline">Filtreler</span>
            {activeFilterCount > 0 && (
              <Badge
                variant="default"
                className="ml-1 h-5 min-w-5 px-1.5 text-[10px] rounded-full"
              >
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="top" className="h-auto max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              Filtreler ve Arama
            </SheetTitle>
          </SheetHeader>
          <PDKSFilterBar values={values} onChange={onChange} />
          <div className="mt-4">
            <Button onClick={() => setIsOpen(false)} className="w-full" size="sm">
              <X className="mr-2 h-4 w-4" />
              Kapat
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Visitor } from "@/types/visitor";
import VisitorForm from "./VisitorForm";

interface VisitorSlideOverPanelProps {
  isOpen: boolean;
  onClose: () => void;
  visitor: Visitor | null;
  onSave: (payload?: unknown) => void;
}

export default function VisitorSlideOverPanel({
  isOpen,
  onClose,
  visitor,
  onSave,
}: VisitorSlideOverPanelProps) {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent size="md" className="p-0">
        <div className="p-6 border-b">
          <SheetHeader>
            <SheetTitle>{visitor ? "Ziyaretçi Düzenle" : "Yeni Ziyaretçi"}</SheetTitle>
          </SheetHeader>
        </div>

        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="p-6">
            <VisitorForm visitor={visitor} onClose={onClose} onSave={onSave} />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

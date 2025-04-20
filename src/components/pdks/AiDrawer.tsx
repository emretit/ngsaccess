
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { AiChatPanel } from "./AiChatPanel";
import { useState } from "react";

interface AiDrawerProps {
  filters?: {
    dateRange?: { from: Date; to: Date };
    department?: string;
    shift?: string;
    statusFilter?: string;  // Add statusFilter to the interface
  };
}

export function AiDrawer({ filters }: AiDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <MessageSquare size={18} />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-[85vh] flex flex-col">
        <AiChatPanel onClose={() => setOpen(false)} filters={filters} />
      </DrawerContent>
    </Drawer>
  );
}


import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PDKSAiChat } from "./PDKSAiChat";
import { MessageSquare, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AiDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg"
          size="icon"
          onClick={() => setIsOpen(true)}
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl p-0" side="right">
        <div className="flex flex-col h-full">
          <PDKSAiChat />
        </div>
      </SheetContent>
    </Sheet>
  );
}

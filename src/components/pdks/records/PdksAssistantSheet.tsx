import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { PDKSAiChat } from "@/components/pdks/PDKSAiChat";
import type { PdksRecordsView } from "./usePdksRecordsView";
export function PdksAssistantSheet({ ai, setAi }: Pick<PdksRecordsView, "ai" | "setAi">) {
  return (
      <Sheet open={ai} onOpenChange={setAi}>
        <SheetContent className="flex w-full flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>PDKS Asistanı</SheetTitle>
            <SheetDescription>
              Asistan sorguları kendi kapsamını belirtir. Bu sayfanın
              filtrelerini otomatik uygulamaz.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <PDKSAiChat />
          </div>
        </SheetContent>
      </Sheet>
  );
}

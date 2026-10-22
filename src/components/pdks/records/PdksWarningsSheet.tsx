import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { PdksRecordsView } from "./usePdksRecordsView";
import { QuerySectionBoundary } from "@/components/shared/QuerySectionBoundary";
import { PDKSSmartPresets } from "@/components/pdks/dashboard/PDKSSmartPresets";
import { PDKSOvertimeAlert } from "@/components/pdks/dashboard/PDKSOvertimeAlert";
export function PdksWarningsSheet({ warningsOpen, setWarningsOpen, activeProject, projectId, selectedDateKey, selectedDate, effectiveSmartPreset, setSmartPreset }: PdksRecordsView) {
  return (
      <Sheet open={warningsOpen} onOpenChange={setWarningsOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Uyarılar</SheetTitle>
            <SheetDescription>
              {activeProject?.name} · Her uyarının tarih kapsamı aşağıda
              belirtilir.
            </SheetDescription>
          </SheetHeader>
          <QuerySectionBoundary
            resetKey={`${projectId}:${selectedDateKey}`}
            title="Uyarılar yüklenemedi."
          >
            <div className="mt-5 space-y-5">
              <PDKSSmartPresets
                anchorDate={selectedDate}
                selection={effectiveSmartPreset}
                onChange={setSmartPreset}
              />
              <PDKSOvertimeAlert year={selectedDate.getFullYear()} />
            </div>
          </QuerySectionBoundary>
        </SheetContent>
      </Sheet>
  );
}

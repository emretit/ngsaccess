
import { PDKSRecordsContent } from "@/components/pdks/PDKSRecordsContent";
import { PDKSRecordsSidebar } from "@/components/pdks/PDKSRecordsSidebar";
import { AiDrawer } from "@/components/pdks/AiDrawer";

export default function PDKSRecords() {
  return (
    <div className="flex h-full">
      <PDKSRecordsSidebar />
      <div className="flex-1 overflow-hidden">
        <PDKSRecordsContent />
      </div>
      <AiDrawer />
    </div>
  );
}

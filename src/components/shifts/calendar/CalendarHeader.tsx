import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

export function CalendarHeader({ projectName, activeCount, loading, onAssign, openDefinitions }: {
  projectName: string; activeCount: number; loading: boolean;
  onAssign: () => void; openDefinitions: () => void;
}) {
  return (
      <PageHeader
        title="Vardiyalar"
        scope={<span className="break-all">{projectName} · Çalışma planı</span>}
        primaryAction={{
          label: activeCount ? "Vardiya ata" : "Önce vardiya tanımla",
          disabled: loading,
          onClick: () =>
            activeCount
              ? onAssign()
              : openDefinitions(),
        }}
        secondaryMenu={
          <Button variant="outline" onClick={openDefinitions}>
            Vardiya tanımları
          </Button>
        }
      />
  );
}

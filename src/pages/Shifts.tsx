import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ShiftCalendarView } from "@/components/shifts/ShiftCalendarView";
import { AssignmentsTable } from "@/components/shifts/AssignmentsTable";
import { ShiftSettings } from "@/components/settings/sections/ShiftSettings";

export default function Shifts() {
  const { loading: projectLoading } = useProjectAccess();
  const [tab, setTab] = useState<string>("calendar");

  const employees = useQuery(api.employees.list, projectLoading ? "skip" : {});
  const shifts = useQuery(api.shifts.list, projectLoading ? "skip" : {});
  const assignments = useQuery(
    api.shifts.listAssignments,
    projectLoading ? "skip" : {},
  );

  if (projectLoading) {
    return <LoadingSpinner text="Vardiya verileri yükleniyor..." />;
  }

  const isLoading =
    employees === undefined || shifts === undefined || assignments === undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Vardiya Yönetimi</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Haftalık takvim, atamalar ve vardiya tanımları
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar">Takvim</TabsTrigger>
          <TabsTrigger value="assignments">Atamalar</TabsTrigger>
          <TabsTrigger value="definitions">Vardiya Tanımları</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          {isLoading ? (
            <LoadingSpinner text="Yükleniyor..." />
          ) : (
            <ShiftCalendarView
              employees={employees ?? []}
              shifts={shifts ?? []}
              assignments={assignments ?? []}
            />
          )}
        </TabsContent>

        <TabsContent value="assignments">
          {isLoading ? (
            <LoadingSpinner text="Yükleniyor..." />
          ) : (
            <AssignmentsTable
              employees={employees ?? []}
              shifts={shifts ?? []}
              assignments={assignments ?? []}
            />
          )}
        </TabsContent>

        <TabsContent value="definitions">
          <ShiftSettings embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Plus } from "lucide-react";

const ZonesAndDoors = () => {
  const zonesData = useQuery(api.zones.list, {});
  const doorsData = useQuery(api.doors.list, {});
  const zonesLoading = zonesData === undefined;
  const doorsLoading = doorsData === undefined;
  const zones = zonesData ?? [];
  const doors = doorsData ?? [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Bölgeler ve Kapılar</h2>
        <div className="space-x-2">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Bölge
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Yeni Kapı
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Bölgeler</CardTitle></CardHeader>
          <CardContent>
            {zonesLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Yükleniyor...
              </div>
            ) : zones.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Bölge yok</p>
            ) : (
              <div className="space-y-2">
                {zones.map((zone: { _id: string; name: string; description?: string }) => (
                  <div key={zone._id} className="p-4 rounded-lg border hover:bg-accent transition-colors">
                    <div className="font-medium">{zone.name}</div>
                    {zone.description && <div className="text-sm text-muted-foreground">{zone.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Kapılar</CardTitle></CardHeader>
          <CardContent>
            {doorsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Yükleniyor...
              </div>
            ) : doors.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Kapı yok</p>
            ) : (
              <div className="space-y-2">
                {doors.map((door: { _id: string; name: string; location?: string; status?: string }) => (
                  <div key={door._id} className="p-4 rounded-lg border hover:bg-accent transition-colors">
                    <div className="font-medium">{door.name}</div>
                    <div className="text-sm text-muted-foreground">{door.location ?? "Konum belirtilmemiş"}</div>
                    <div className="mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${door.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                        {door.status === "active" ? "Aktif" : "Pasif"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ZonesAndDoors;

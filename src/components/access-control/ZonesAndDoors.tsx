
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Door, Zone } from "@/types/access-control";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ZonesAndDoors = () => {
  const { toast } = useToast();

  const { data: zones, isLoading: zonesLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .order('name');
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Bölgeler yüklenirken bir hata oluştu."
        });
        throw error;
      }
      return data as Zone[];
    }
  });

  const { data: doors, isLoading: doorsLoading } = useQuery({
    queryKey: ['doors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doors')
        .select('*')
        .order('name');
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Hata",
          description: "Kapılar yüklenirken bir hata oluştu."
        });
        throw error;
      }
      return data as Door[];
    }
  });

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
          <CardHeader>
            <CardTitle>Bölgeler</CardTitle>
          </CardHeader>
          <CardContent>
            {zonesLoading ? (
              <div>Yükleniyor...</div>
            ) : (
              <div className="space-y-2">
                {zones?.map((zone) => (
                  <div
                    key={zone.id}
                    className="p-4 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="font-medium">{zone.name}</div>
                    {zone.description && (
                      <div className="text-sm text-muted-foreground">
                        {zone.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Kapılar</CardTitle>
          </CardHeader>
          <CardContent>
            {doorsLoading ? (
              <div>Yükleniyor...</div>
            ) : (
              <div className="space-y-2">
                {doors?.map((door) => (
                  <div
                    key={door.id}
                    className="p-4 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <div className="font-medium">{door.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {door.location || 'Konum belirtilmemiş'}
                    </div>
                    <div className="mt-2">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        door.status === 'active' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {door.status === 'active' ? 'Aktif' : 'Pasif'}
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

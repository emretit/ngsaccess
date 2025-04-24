
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useZonesAndDoors } from "@/hooks/useZonesAndDoors";
import { useState } from "react";
import { Device } from "@/types/device";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
  zoneId: z.string().min(1, "Bölge seçiniz"),
  doorId: z.string().min(1, "Kapı seçiniz"),
});

interface AssignLocationFormProps {
  device: Device;
}

export function AssignLocationForm({ device }: AssignLocationFormProps) {
  const [open, setOpen] = useState(false);
  const { zones, doors } = useZonesAndDoors();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      zoneId: device.zone_id?.toString() || "",
      doorId: device.door_id?.toString() || "",
    },
  });

  const filteredDoors = doors.filter(
    (door) => door.zone_id === Number(form.watch("zoneId"))
  );

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { error } = await supabase
      .from("devices")
      .update({
        zone_id: Number(values.zoneId),
        door_id: Number(values.doorId),
      })
      .eq("id", device.id);

    if (error) {
      toast({
        title: "Hata",
        description: "Konum güncellenirken bir hata oluştu",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Başarılı",
      description: "Cihaz konumu güncellendi",
    });
    
    queryClient.invalidateQueries({ queryKey: ["devices"] });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Konum Ata
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cihaz Konumu</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="zoneId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bölge</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Bölge seçiniz" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {zones.map((zone) => (
                        <SelectItem key={zone.id} value={zone.id.toString()}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="doorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kapı</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!form.watch("zoneId")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Kapı seçiniz" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredDoors.map((door) => (
                        <SelectItem key={door.id} value={door.id.toString()}>
                          {door.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                İptal
              </Button>
              <Button type="submit">Kaydet</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

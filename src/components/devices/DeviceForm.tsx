
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDeviceForm } from "@/hooks/useDeviceForm";

interface DeviceFormProps {
  onAddDevice: (serialNumber: string) => void;
  isLoading: boolean;
}

export function DeviceForm({ onAddDevice, isLoading }: DeviceFormProps) {
  const { form, open, setOpen, handleSubmit } = useDeviceForm({
    onAddDevice,
    isLoading,
  });

  return (
    <>
      <Button 
        onClick={() => setOpen(true)}
        className="bg-primary hover:bg-primary/90"
      >
        <Plus className="mr-2 h-4 w-4" /> Yeni Cihaz Ekle
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Cihaz Ekle</DialogTitle>
            <DialogDescription>
              Projenize eklemek istediğiniz cihazın seri numarasını girin ya da yeni bir cihaz oluşturun.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seri Numarası</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Cihaz seri numarasını girin"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  İptal
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading || !form.formState.isValid}
                >
                  {isLoading ? "Ekleniyor..." : "Cihazı Ekle"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

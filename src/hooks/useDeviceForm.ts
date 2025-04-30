
import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

// Define validation schema
const deviceFormSchema = z.object({
  serialNumber: z.string()
    .min(1, { message: "Seri numarası boş olamaz" })
    .regex(/^[A-Za-z0-9-]+$/, { 
      message: "Seri numarası yalnızca harf, rakam ve tire içerebilir" 
    })
});

type DeviceFormValues = z.infer<typeof deviceFormSchema>;

interface UseDeviceFormProps {
  onAddDevice: (serialNumber: string) => void;
  isLoading: boolean;
}

export function useDeviceForm({ onAddDevice, isLoading }: UseDeviceFormProps) {
  const [open, setOpen] = useState(false);
  
  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: {
      serialNumber: "",
    },
  });

  const handleSubmit = (values: DeviceFormValues) => {
    onAddDevice(values.serialNumber);
    form.reset();
    setOpen(false);
  };

  return {
    form,
    open,
    setOpen,
    isLoading,
    handleSubmit,
  };
}

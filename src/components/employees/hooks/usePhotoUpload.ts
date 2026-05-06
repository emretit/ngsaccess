import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { toast } from "@/hooks/use-toast";

export function usePhotoUpload() {
  const [isLoading, setIsLoading] = useState(false);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveEmployeePhoto = useMutation(api.files.saveEmployeePhoto);

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onPhotoChange: (url: string) => void,
    onPreviewChange: (preview: string) => void,
    employeeId?: Id<"employees">
  ) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Hata",
        description: "Sadece JPEG, PNG veya WebP fotoğraflar yüklenebilir",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Hata",
        description: "Dosya boyutu 5 MB'dan küçük olmalıdır",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    const previewUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = (event) => resolve(event.target?.result as string);
      reader.onerror = () => reject(new Error("Önizleme oluşturulamadı"));
      reader.readAsDataURL(file);
    });
    onPreviewChange(previewUrl);

    try {
      setIsLoading(true);

      const uploadUrl = await generateUploadUrl();

      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Dosya sunucuya yüklenemedi");
      const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };

      if (employeeId) {
        const url = await saveEmployeePhoto({ employeeId, storageId });
        onPhotoChange(url);
        return;
      }

      const urlResponse = await fetch(`/api/convex/files/${storageId}`);
      if (!urlResponse.ok) {
        throw new Error("Fotoğraf URL'i alınamadı");
      }
      const { url } = (await urlResponse.json()) as { url: string };
      onPhotoChange(url);
    } catch (error) {
      onPreviewChange("");
      const message = error instanceof Error ? error.message : "Fotoğraf yüklenemedi";
      toast({
        title: "Fotoğraf Yükleme Hatası",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleFileChange };
}

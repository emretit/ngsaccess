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
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Hata",
        description: "Dosya boyutu 5 MB'dan küçük olmalıdır",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onPreviewChange(event.target?.result as string);
    };
    reader.readAsDataURL(file);

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

      // Yeni personel akışı: kayıt henüz yok, URL'i geçici endpoint ile çöz.
      const urlResponse = await fetch(`/api/convex/files/${storageId}`);
      if (!urlResponse.ok) {
        throw new Error("Fotoğraf URL'i alınamadı");
      }
      const { url } = (await urlResponse.json()) as { url: string };
      onPhotoChange(url);
    } catch (error) {
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

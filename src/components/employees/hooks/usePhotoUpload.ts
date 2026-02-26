import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";

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
      alert("Dosya boyutu 5MB'dan küçük olmalıdır");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      onPreviewChange(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setIsLoading(true);

      // 1. Upload URL al
      const uploadUrl = await generateUploadUrl();

      // 2. Dosyayı yükle
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!result.ok) throw new Error("Dosya yüklenemedi");
      const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };

      // 3. Employee kaydını güncelle (eğer employeeId verilmişse)
      if (employeeId) {
        const url = await saveEmployeePhoto({ employeeId, storageId });
        onPhotoChange(url);
      } else {
        // Sadece URL üret, kaydet değil
        const urlResponse = await fetch(`/api/convex/files/${storageId}`);
        if (urlResponse.ok) {
          const { url } = (await urlResponse.json()) as { url: string };
          onPhotoChange(url);
        }
      }
    } catch (error) {
      console.error("Fotoğraf yüklenirken hata:", error);
      alert("Fotoğraf yüklenemedi. Lütfen daha sonra tekrar deneyiniz.");
    } finally {
      setIsLoading(false);
    }
  };

  return { isLoading, handleFileChange };
}

import { useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export function usePhotoUpload() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const getUploadUrl = useMutation(api.files.getUploadUrl);
  const preview = useRef<string | null>(null);
  const upload = useAsyncAction(async (
    file: File,
    onPhotoChange: (url: string) => void,
    onPreviewChange: (url: string) => void,
  ) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Sadece JPEG, PNG veya WebP fotoğraflar yüklenebilir");
    if (file.size > 5 * 1024 * 1024) throw new Error("Dosya boyutu 5 MB'dan küçük olmalıdır");
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = URL.createObjectURL(file);
    onPreviewChange(preview.current);
    try {
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!result.ok) throw new Error("Dosya sunucuya yüklenemedi");
      const payload: unknown = await result.json();
      if (typeof payload !== "object" || payload === null || !("storageId" in payload) || typeof payload.storageId !== "string") throw new Error("Dosya sunucusu geçersiz yanıt verdi");
      const url = await getUploadUrl({ storageId: payload.storageId as Id<"_storage"> });
      onPhotoChange(url);
      onPreviewChange(url);
    } catch (error: unknown) {
      onPreviewChange("");
      throw error;
    } finally {
      if (preview.current) URL.revokeObjectURL(preview.current);
      preview.current = null;
    }
  }, { error: "Fotoğraf yüklenemedi" });

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    onPhotoChange: (url: string) => void,
    onPreviewChange: (url: string) => void,
    _employeeId?: Id<"employees">,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) await upload.run(file, onPhotoChange, onPreviewChange);
  };
  return { isLoading: upload.pending, handleFileChange };
}

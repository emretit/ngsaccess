import { errorMessage } from "@/lib/notify";
import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export function usePhotoUpload() {
  const [error, setError] = useState<string>();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const claimUpload = useMutation(api.files.claimUpload);
  const getUploadUrl = useMutation(api.files.getUploadUrl);
  const preview = useRef<string | null>(null);
  const upload = useAsyncAction(
    async (
      file: File,
      onPhotoChange: (url: string, storageId: Id<"_storage">) => void,
      onPreviewChange: (url: string) => void,
    ) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("JPEG, PNG veya WebP biçiminde, en çok 5 MB bir dosya seçin.");
        throw new Error("Sadece JPEG, PNG veya WebP fotoğraflar yüklenebilir");
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("JPEG, PNG veya WebP biçiminde, en çok 5 MB bir dosya seçin.");
        throw new Error("Dosya boyutu 5 MB'dan küçük olmalıdır");
      }
      if (preview.current) URL.revokeObjectURL(preview.current);
      preview.current = URL.createObjectURL(file);
      onPreviewChange(preview.current);
      try {
        const uploadUrl = await generateUploadUrl();
        const result = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!result.ok) throw new Error("Dosya sunucuya yüklenemedi");
        const payload: unknown = await result.json();
        if (
          typeof payload !== "object" ||
          payload === null ||
          !("storageId" in payload) ||
          typeof payload.storageId !== "string"
        )
          throw new Error("Dosya sunucusu geçersiz yanıt verdi");
        await claimUpload({ storageId: payload.storageId as Id<"_storage"> });
        const url = await getUploadUrl({
          storageId: payload.storageId as Id<"_storage">,
        });
        onPhotoChange(url, payload.storageId as Id<"_storage">);
        onPreviewChange(url);
      } catch (error: unknown) {
        setError(errorMessage(error));
        onPreviewChange("");
        throw error;
      } finally {
        if (preview.current) URL.revokeObjectURL(preview.current);
        preview.current = null;
      }
    },
    { error: "Fotoğraf yüklenemedi" },
  );

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    onPhotoChange: (url: string, storageId: Id<"_storage">) => void,
    onPreviewChange: (url: string) => void,
    _employeeId?: Id<"employees">,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      setError(undefined);
      await upload.run(file, onPhotoChange, onPreviewChange);
    }
  };
  return { isLoading: upload.pending, handleFileChange, error };
}

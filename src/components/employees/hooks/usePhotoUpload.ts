import { errorMessage } from "@/lib/notify";
import { useRef, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useAsyncAction } from "@/hooks/useAsyncAction";

export function usePhotoUpload() {
  const [error, setError] = useState<string>();
  const uploadFile = useAction(api.files.upload);
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
        const storageId = await uploadFile({ bytes: await file.arrayBuffer(), mimeType: file.type });
        const url = await getUploadUrl({ storageId });
        onPhotoChange(url, storageId);
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

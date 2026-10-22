import { useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { errorMessage } from "@/lib/notify";

export function useConsentDocumentUpload() {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const claimUpload = useMutation(api.files.claimUpload);
  const [storageId, setStorageId] = useState<Id<"_storage">>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const busy = useRef(false);
  const reset = () => {
    generation.current += 1;
    setStorageId(undefined);
    setError(undefined);
  };
  const upload = async (file: File) => {
    if (busy.current) return;
    const current = ++generation.current;
    setStorageId(undefined);
    setError(undefined);
    if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setError("PDF, JPEG veya PNG biçiminde, en çok 10 MB bir dosya seçin.");
      return;
    }
    busy.current = true;
    setPending(true);
    try {
      const url = await generateUploadUrl();
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Belge yüklenemedi.");
      const payload: unknown = await response.json();
      if (typeof payload !== "object" || payload === null || !("storageId" in payload) || typeof payload.storageId !== "string") {
        throw new Error("Dosya sunucusu geçersiz yanıt verdi.");
      }
      const id = payload.storageId as Id<"_storage">;
      await claimUpload({ storageId: id });
      if (current === generation.current) setStorageId(id);
    } catch (cause: unknown) {
      if (current === generation.current) setError(errorMessage(cause));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return { storageId, pending, error, upload, reset };
}

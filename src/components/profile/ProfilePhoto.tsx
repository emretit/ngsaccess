import { useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { notify } from "@/lib/notify";
import { useAsyncAction } from "@/hooks/useAsyncAction";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Loader2, Camera } from "lucide-react";

interface ProfilePhotoProps {
  photoUrl: string;
  userInitials: string;
  userId: string;
  onPhotoUpdated: (newUrl: string) => void;
}

export default function ProfilePhoto({
  photoUrl,
  userInitials,
  onPhotoUpdated,
}: ProfilePhotoProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const claimUpload = useMutation(api.files.claimUpload);
  const saveUserPhoto = useMutation(api.files.saveUserPhoto);

  const { run: upload, pending: isLoading } = useAsyncAction(async (file: File) => {
    const uploadUrl = await generateUploadUrl();
    const result = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    if (!result.ok) throw new Error("Dosya yüklenemedi");
    const { storageId } = (await result.json()) as { storageId: Id<"_storage"> };
    await claimUpload({ storageId });
    const publicUrl = await saveUserPhoto({ storageId });
    onPhotoUpdated(publicUrl);
  }, { success: "Fotoğraf güncellendi", error: "Fotoğraf yüklenemedi" });
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { notify.error("Sadece JPEG, PNG veya WebP yüklenebilir."); return; }
    if (file.size > 2 * 1024 * 1024) { notify.error("Profil fotoğrafı 2 MB'dan küçük olmalıdır."); return; }
    await upload(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profil Fotoğrafı</CardTitle>
        <CardDescription>
          Profil fotoğrafınızı buradan değiştirebilirsiniz
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-4">
        <div className="relative">
          <Avatar className="w-32 h-32">
            <AvatarImage src={photoUrl || ""} alt="Profil fotoğrafı" />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {userInitials}
            </AvatarFallback>
          </Avatar>

          <button
            type="button"
            aria-label="Profil fotoğrafını değiştir"
            aria-busy={isLoading}
            disabled={isLoading}
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground cursor-pointer hover:bg-primary/90 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </button>
          <input
            type="file"
            id="photo-upload"
            ref={inputRef}
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handlePhotoUpload}
            disabled={isLoading}
          />
        </div>

        <p className="text-sm text-muted-foreground mt-4">
          Önerilen: 200x200px, maksimum 2MB
        </p>
      </CardContent>
    </Card>
  );
}

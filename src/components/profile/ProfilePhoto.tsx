import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
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
  const [isLoading, setIsLoading] = useState(false);

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveUserPhoto = useMutation(api.files.saveUserPhoto);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Dosya çok büyük",
        description: "Profil fotoğrafı 2MB'dan küçük olmalıdır.",
        variant: "destructive",
      });
      return;
    }

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

      // 3. Kullanıcı kaydını güncelle
      const publicUrl = await saveUserPhoto({ storageId });

      onPhotoUpdated(publicUrl);

      toast({
        title: "Fotoğraf güncellendi",
        description: "Profil fotoğrafınız başarıyla güncellendi.",
      });
    } catch (error: unknown) {
      toast({
        title: "Hata",
        description: (error as Error)?.message ?? "Fotoğraf yüklenirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
            <AvatarFallback className="bg-[#711A1A] text-white text-2xl">
              {userInitials}
            </AvatarFallback>
          </Avatar>

          <label
            htmlFor="photo-upload"
            className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#711A1A] text-white cursor-pointer hover:bg-[#8a2020] transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </label>
          <input
            type="file"
            id="photo-upload"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoUpload}
            disabled={isLoading}
          />
        </div>

        <p className="text-sm text-gray-500 mt-4">
          Önerilen: 200x200px, maksimum 2MB
        </p>
      </CardContent>
    </Card>
  );
}

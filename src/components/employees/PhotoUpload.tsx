import { useRef } from "react";
import { Camera, Upload } from "lucide-react";

interface PhotoUploadProps {
  photoPreview: string | null;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function PhotoUpload({
  photoPreview,
  onPhotoChange,
}: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative h-16 w-16 shrink-0">
      {photoPreview ? (
        <img
          src={photoPreview}
          alt="Personel fotoğrafı"
          className="h-16 w-16 rounded-full border-2 border-border object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Camera className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <button
        type="button"
        aria-label="Personel fotoğrafı seç"
        onClick={() => fileInputRef.current?.click()}
        className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground before:absolute before:-inset-1.5"
      >
        <Upload className="h-3.5 w-3.5" />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={onPhotoChange}
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
      />
    </div>
  );
}

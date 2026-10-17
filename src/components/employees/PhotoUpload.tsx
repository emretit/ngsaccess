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
    <div className="flex flex-col items-center mb-2">
      <div className="relative w-24 h-24 mb-2">
        {photoPreview ? (
          <img
            src={photoPreview}
            alt="Personel fotoğrafı"
            className="w-24 h-24 rounded-full object-cover border-2 border-border"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
            <Camera className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
        <button
          type="button"
          aria-label="Personel fotoğrafı seç"
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 bg-primary text-primary-foreground h-11 w-11 flex items-center justify-center rounded-full"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onPhotoChange}
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
        />
      </div>
      <span className="text-xs text-muted-foreground">
        Fotoğraf eklemek için tıklayın
      </span>
    </div>
  );
}

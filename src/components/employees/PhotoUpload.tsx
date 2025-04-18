
import { useRef } from 'react';
import { Camera, Upload } from 'lucide-react';

interface PhotoUploadProps {
  photoPreview: string | null;
  onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function PhotoUpload({ photoPreview, onPhotoChange }: PhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center mb-2">
      <div className="relative w-24 h-24 mb-2">
        {photoPreview ? (
          <img 
            src={photoPreview} 
            alt="Personel fotoğrafı" 
            className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <Camera className="w-8 h-8 text-gray-400" />
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 bg-primary text-white p-1.5 rounded-full hover:bg-primary-dark"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={onPhotoChange}
          className="hidden" 
          accept="image/*"
        />
      </div>
      <span className="text-xs text-gray-500">Fotoğraf eklemek için tıklayın</span>
    </div>
  );
}


-- devices tablosuna access_direction enum sütunu ekle
DO $$ BEGIN
    CREATE TYPE access_direction_enum AS ENUM ('entry', 'exit', 'both');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- devices tablosuna access_direction sütunu ekle
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS access_direction access_direction_enum DEFAULT 'both';

-- Mevcut kayıtları güncelle (isteğe bağlı)
UPDATE devices 
SET access_direction = 'both' 
WHERE access_direction IS NULL;

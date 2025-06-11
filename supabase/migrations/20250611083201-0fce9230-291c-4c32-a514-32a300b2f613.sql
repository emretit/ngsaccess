
-- info@ngsteknoloji.com kullanıcısını proje 1'e project_admin olarak ata
DO $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Kullanıcının UUID'sini bul
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'info@ngsteknoloji.com';
    
    IF user_uuid IS NOT NULL THEN
        -- Önce users tablosundaki rolü güncelle
        UPDATE users 
        SET role = 'project_admin' 
        WHERE id = user_uuid;
        
        -- Eğer user_projects tablosunda kayıt varsa güncelle, yoksa ekle
        INSERT INTO user_projects (user_id, project_id)
        VALUES (user_uuid, 1)
        ON CONFLICT (user_id, project_id) DO NOTHING;
        
        RAISE NOTICE 'Kullanıcı % proje 1''e project_admin olarak atandı', user_uuid;
    ELSE
        RAISE NOTICE 'info@ngsteknoloji.com kullanıcısı bulunamadı';
    END IF;
END $$;

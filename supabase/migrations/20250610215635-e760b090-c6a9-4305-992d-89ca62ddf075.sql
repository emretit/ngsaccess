
-- Önce mevcut yanlış foreign key constraint'i kaldır
ALTER TABLE group_members DROP CONSTRAINT IF EXISTS group_members_group_id_fkey;
ALTER TABLE group_devices DROP CONSTRAINT IF EXISTS group_devices_group_id_fkey;

-- Doğru foreign key constraint'leri ekle
ALTER TABLE group_members 
ADD CONSTRAINT group_members_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES access_rules(id) ON DELETE CASCADE;

ALTER TABLE group_devices 
ADD CONSTRAINT group_devices_group_id_fkey 
FOREIGN KEY (group_id) REFERENCES access_rules(id) ON DELETE CASCADE;

-- Şimdi örnek kuralları tekrar ekle
INSERT INTO access_rules (name, description, target_type, access_direction, priority, start_time, end_time, days, is_active, project_id) VALUES
('Genel Çalışan Erişimi', 'Tüm çalışanlar için normal mesai saatleri erişimi', 'individual', 'both', 100, '08:00:00', '18:00:00', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], true, 1),
('IT Departmanı 7/24 Erişim', 'IT çalışanları için hafta sonu dahil 7/24 erişim', 'individual', 'both', 90, NULL, NULL, ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], true, 1),
('Güvenlik Vardiya Erişimi', 'Güvenlik personeli için gece vardiyası erişimi', 'individual', 'both', 95, '22:00:00', '06:00:00', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], true, 1),
('Yönetim Katı Erişimi', 'Üst düzey yöneticiler için özel alan erişimi', 'individual', 'both', 80, '07:00:00', '20:00:00', ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], true, 1);

-- Kurallar için çalışan atamalarını ekle
INSERT INTO group_members (group_id, employee_id, project_id)
SELECT 
    ar.id as group_id,
    e.id as employee_id,
    1 as project_id
FROM access_rules ar
CROSS JOIN (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn 
    FROM employees 
    WHERE project_id = 1 OR project_id IS NULL
    LIMIT 4
) e
WHERE ar.name IN ('Genel Çalışan Erişimi', 'IT Departmanı 7/24 Erişim', 'Güvenlik Vardiya Erişimi', 'Yönetim Katı Erişimi')
AND (
    (ar.name = 'Genel Çalışan Erişimi' AND e.rn = 1) OR
    (ar.name = 'IT Departmanı 7/24 Erişim' AND e.rn = 2) OR
    (ar.name = 'Güvenlik Vardiya Erişimi' AND e.rn = 3) OR
    (ar.name = 'Yönetim Katı Erişimi' AND e.rn = 4)
);

-- Kurallar için cihaz atamalarını ekle
INSERT INTO group_devices (group_id, device_id, project_id)
SELECT 
    ar.id as group_id,
    d.id as device_id,
    1 as project_id
FROM access_rules ar
CROSS JOIN (
    SELECT id, ROW_NUMBER() OVER (ORDER BY id) as rn 
    FROM devices 
    WHERE project_id = 1 OR project_id IS NULL
    LIMIT 4
) d
WHERE ar.name IN ('Genel Çalışan Erişimi', 'IT Departmanı 7/24 Erişim', 'Güvenlik Vardiya Erişimi', 'Yönetim Katı Erişimi')
AND (
    (ar.name = 'Genel Çalışan Erişimi' AND d.rn IN (1, 2)) OR
    (ar.name = 'IT Departmanı 7/24 Erişim' AND d.rn IN (1, 2, 3)) OR
    (ar.name = 'Güvenlik Vardiya Erişimi' AND d.rn IN (2, 3, 4)) OR
    (ar.name = 'Yönetim Katı Erişimi' AND d.rn = 4)
);

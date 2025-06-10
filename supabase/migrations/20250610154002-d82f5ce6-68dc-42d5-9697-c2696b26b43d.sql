
-- Önce mevcut verileri temizle (eğer varsa)
DELETE FROM group_members;
DELETE FROM group_devices;

-- group_members tablosuna foreign key constraintleri ekle
ALTER TABLE group_members 
ADD CONSTRAINT fk_group_members_group_id 
FOREIGN KEY (group_id) REFERENCES access_rules(id) ON DELETE CASCADE;

ALTER TABLE group_members 
ADD CONSTRAINT fk_group_members_employee_id 
FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- group_devices tablosuna foreign key constraintleri ekle
ALTER TABLE group_devices 
ADD CONSTRAINT fk_group_devices_group_id 
FOREIGN KEY (group_id) REFERENCES access_rules(id) ON DELETE CASCADE;

ALTER TABLE group_devices 
ADD CONSTRAINT fk_group_devices_device_id 
FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE;

-- access_rules tablosundan eski kolonları kaldır
ALTER TABLE access_rules DROP COLUMN IF EXISTS employee_id;
ALTER TABLE access_rules DROP COLUMN IF EXISTS device_id;

-- RLS politikalarını ekle
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_devices ENABLE ROW LEVEL SECURITY;

-- group_members için RLS politikaları
CREATE POLICY "Allow all operations on group_members" ON group_members FOR ALL USING (true);

-- group_devices için RLS politikaları  
CREATE POLICY "Allow all operations on group_devices" ON group_devices FOR ALL USING (true);

-- Performans için indexler
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_employee_id ON group_members(employee_id);
CREATE INDEX IF NOT EXISTS idx_group_devices_group_id ON group_devices(group_id);
CREATE INDEX IF NOT EXISTS idx_group_devices_device_id ON group_devices(device_id);

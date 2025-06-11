
-- group_members ve group_devices tablolarında daha esnek RLS politikaları oluştur

-- Önce mevcut politikaları kaldır
DROP POLICY IF EXISTS "Allow all operations on group_members" ON group_members;
DROP POLICY IF EXISTS "Allow all operations on group_devices" ON group_devices;

-- group_members için yeni politikalar
CREATE POLICY "Enable read access for group_members" ON group_members FOR SELECT USING (true);
CREATE POLICY "Enable insert access for group_members" ON group_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for group_members" ON group_members FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for group_members" ON group_members FOR DELETE USING (true);

-- group_devices için yeni politikalar  
CREATE POLICY "Enable read access for group_devices" ON group_devices FOR SELECT USING (true);
CREATE POLICY "Enable insert access for group_devices" ON group_devices FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for group_devices" ON group_devices FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for group_devices" ON group_devices FOR DELETE USING (true);

-- access_rules tablosu için de politika kontrolü
DROP POLICY IF EXISTS "Enable all access for access_rules" ON access_rules;
CREATE POLICY "Enable all access for access_rules" ON access_rules FOR ALL USING (true);

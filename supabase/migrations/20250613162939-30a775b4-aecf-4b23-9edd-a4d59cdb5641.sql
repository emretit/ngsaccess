
-- Kart okuma kayıtlarına erişim kontrolü sütunu ekle
ALTER TABLE card_readings 
ADD COLUMN IF NOT EXISTS access_rule_granted boolean;

-- Çalışanın belirli bir cihaza erişim iznini kontrol eden fonksiyon
CREATE OR REPLACE FUNCTION public.check_employee_access(
    p_employee_id bigint,
    p_device_id bigint,
    p_access_time timestamp with time zone DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    has_access boolean := false;
    rule_record record;
    access_day text;
    access_time time;
    access_dow integer;
BEGIN
    -- Erişim gününü ve saatini al
    access_dow := EXTRACT(dow FROM p_access_time); -- 0=Sunday, 1=Monday, etc.
    access_time := p_access_time::time;
    
    -- Çalışanın aktif durumunu kontrol et
    IF NOT EXISTS (
        SELECT 1 FROM employees 
        WHERE id = p_employee_id 
        AND is_active = true 
        AND access_permission = true
    ) THEN
        RETURN false;
    END IF;
    
    -- Erişim kurallarını kontrol et (group-based access rules)
    FOR rule_record IN
        SELECT ar.*, gm.employee_id, gd.device_id as rule_device_id
        FROM access_rules ar
        JOIN group_members gm ON ar.id = gm.group_id
        JOIN group_devices gd ON ar.id = gd.group_id
        WHERE ar.is_active = true
        AND gm.employee_id = p_employee_id
        AND gd.device_id = p_device_id
        ORDER BY ar.priority DESC
    LOOP
        -- Gün kontrolü (days array'inde İngilizce gün isimleri: Monday, Tuesday, etc.)
        IF rule_record.days IS NOT NULL AND array_length(rule_record.days, 1) > 0 THEN
            -- access_dow'u gün ismine çevir
            CASE access_dow
                WHEN 0 THEN access_day := 'Sunday';
                WHEN 1 THEN access_day := 'Monday';
                WHEN 2 THEN access_day := 'Tuesday';
                WHEN 3 THEN access_day := 'Wednesday';
                WHEN 4 THEN access_day := 'Thursday';
                WHEN 5 THEN access_day := 'Friday';
                WHEN 6 THEN access_day := 'Saturday';
            END CASE;
            
            IF NOT (access_day = ANY(rule_record.days)) THEN
                CONTINUE;
            END IF;
        END IF;
        
        -- Saat kontrolü
        IF rule_record.start_time IS NOT NULL AND rule_record.end_time IS NOT NULL THEN
            IF access_time < rule_record.start_time OR access_time > rule_record.end_time THEN
                CONTINUE;
            END IF;
        END IF;
        
        -- Bu kurala göre erişim var
        has_access := true;
        EXIT;
    END LOOP;
    
    RETURN has_access;
END;
$$;

-- Yeni kayıtlar için trigger fonksiyonu
CREATE OR REPLACE FUNCTION public.update_access_rule_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Eğer employee_id ve device_id varsa erişim kontrolünü yap
    IF NEW.employee_id IS NOT NULL AND NEW.device_id IS NOT NULL THEN
        NEW.access_rule_granted := public.check_employee_access(NEW.employee_id, NEW.device_id, NEW.access_time);
    ELSE
        NEW.access_rule_granted := false;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS update_access_rule_status_trigger ON card_readings;
CREATE TRIGGER update_access_rule_status_trigger
    BEFORE INSERT OR UPDATE ON card_readings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_access_rule_status();

-- Mevcut kayıtları güncelle
UPDATE card_readings 
SET access_rule_granted = public.check_employee_access(employee_id, device_id, access_time)
WHERE employee_id IS NOT NULL AND device_id IS NOT NULL;

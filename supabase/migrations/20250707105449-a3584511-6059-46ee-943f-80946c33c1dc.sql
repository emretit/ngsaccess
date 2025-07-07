-- Create new group-based access control function
CREATE OR REPLACE FUNCTION public.check_employee_device_access(
    p_employee_id bigint,
    p_device_id bigint,
    p_access_time timestamp with time zone
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    access_granted boolean := false;
    rule_time time;
    rule_day text;
    rule_record record;
BEGIN
    -- Get current time and day
    rule_time := p_access_time::time;
    rule_day := to_char(p_access_time, 'Day');
    rule_day := trim(rule_day); -- Remove extra spaces
    
    -- Convert day name to English if needed
    CASE rule_day
        WHEN 'Pazartesi' THEN rule_day := 'Monday';
        WHEN 'Salı' THEN rule_day := 'Tuesday';
        WHEN 'Çarşamba' THEN rule_day := 'Wednesday';  
        WHEN 'Perşembe' THEN rule_day := 'Thursday';
        WHEN 'Cuma' THEN rule_day := 'Friday';
        WHEN 'Cumartesi' THEN rule_day := 'Saturday';
        WHEN 'Pazar' THEN rule_day := 'Sunday';
        ELSE rule_day := to_char(p_access_time, 'FMDay');
    END CASE;
    
    -- Check all active access rules for this employee and device
    FOR rule_record IN
        SELECT 
            ar.id,
            ar.name,
            ar.start_time,
            ar.end_time,
            ar.days,
            ar.access_direction,
            ar.is_active,
            ar.priority
        FROM access_rules ar
        WHERE ar.is_active = true
        AND EXISTS (
            -- Check if employee is in the group
            SELECT 1 FROM group_members gm 
            WHERE gm.group_id = ar.id 
            AND gm.employee_id = p_employee_id
        )
        AND EXISTS (
            -- Check if device is in the group
            SELECT 1 FROM group_devices gd 
            WHERE gd.group_id = ar.id 
            AND gd.device_id = p_device_id
        )
        ORDER BY ar.priority DESC
    LOOP
        -- Check day constraint
        IF rule_record.days IS NOT NULL AND array_length(rule_record.days, 1) > 0 THEN
            IF NOT (rule_day = ANY(rule_record.days)) THEN
                CONTINUE; -- Skip this rule if day doesn't match
            END IF;
        END IF;
        
        -- Check time constraint
        IF rule_record.start_time IS NOT NULL AND rule_record.end_time IS NOT NULL THEN
            IF NOT (rule_time BETWEEN rule_record.start_time AND rule_record.end_time) THEN
                CONTINUE; -- Skip this rule if time doesn't match
            END IF;
        END IF;
        
        -- If we reach here, all constraints are satisfied
        access_granted := true;
        EXIT; -- Exit loop on first matching rule (highest priority)
    END LOOP;
    
    RETURN access_granted;
END;
$$;
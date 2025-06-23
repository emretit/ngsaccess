
-- access_rule_granted kolonunu ve ilgili trigger/function'ları kaldır
DROP TRIGGER IF EXISTS update_access_rule_status_trigger ON card_readings;
DROP FUNCTION IF EXISTS update_access_rule_status() CASCADE;
DROP FUNCTION IF EXISTS check_employee_access(bigint, bigint, timestamp with time zone) CASCADE;

-- card_readings tablosundaki access_rule_granted kolonunu kaldır
ALTER TABLE card_readings DROP COLUMN IF EXISTS access_rule_granted CASCADE;

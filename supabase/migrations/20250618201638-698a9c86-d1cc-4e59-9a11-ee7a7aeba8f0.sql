
-- First drop the dependent view
DROP VIEW IF EXISTS devices_with_latest_readings;

-- Now drop the location column from devices table
ALTER TABLE devices DROP COLUMN IF EXISTS location;

-- Recreate the view without the location column
CREATE VIEW devices_with_latest_readings AS
SELECT 
    d.*,
    ldr.last_seen as actual_last_seen
FROM devices d
LEFT JOIN latest_device_readings ldr ON d.device_serial = ldr.device_serial;

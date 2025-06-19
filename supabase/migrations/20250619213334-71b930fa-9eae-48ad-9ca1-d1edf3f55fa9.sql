
-- Add missing columns to devices table
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS device_ip text,
ADD COLUMN IF NOT EXISTS device_mac text,
ADD COLUMN IF NOT EXISTS device_firmware text;

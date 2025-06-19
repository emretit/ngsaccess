
-- Create device model enum type
CREATE TYPE device_model_enum AS ENUM (
  'QR Reader',
  'Fingerprint Reader', 
  'RFID Reader',
  'Access Control Terminal',
  'Other'
);

-- Add device_model_enum column to devices table
ALTER TABLE public.devices 
ADD COLUMN IF NOT EXISTS device_model_enum device_model_enum;

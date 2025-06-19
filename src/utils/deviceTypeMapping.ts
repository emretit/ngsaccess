
export const deviceTypeMapping = {
  "QR Reader": "qr_reader",
  "Fingerprint Reader": "fingerprint_reader", 
  "RFID Reader": "card_reader",
  "Access Control Terminal": "access_terminal",
  "Other": "other"
} as const;

export const reverseDeviceTypeMapping = {
  "qr_reader": "QR Reader",
  "fingerprint_reader": "Fingerprint Reader",
  "card_reader": "RFID Reader", 
  "access_terminal": "Access Control Terminal",
  "other": "Other"
} as const;

export type DatabaseDeviceType = keyof typeof reverseDeviceTypeMapping;
export type HumanReadableDeviceType = keyof typeof deviceTypeMapping;

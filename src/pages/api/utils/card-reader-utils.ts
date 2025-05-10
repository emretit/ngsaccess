
import { CardReadingLogParams } from '../types/card-reader-types';
import { getOrCreateDevice } from './device-utils';
import { logCardReading } from './log-utils';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/integrations/supabase/types';

/**
 * Processes a card reading event, handling device verification and logging
 */
export async function processCardReading({
    supabase,
    cardNumber,
    deviceSerial,
    status,
    errorMessage,
    employeeId,
    employeeName,
    employeePhotoUrl,
    timestamp = new Date().toISOString()
}: CardReadingLogParams): Promise<string | undefined> {
    // Get or create device
    const { deviceName, deviceId } = await getOrCreateDevice(supabase, deviceSerial);
    
    // Log the card reading
    return logCardReading({
        supabase,
        cardNumber,
        deviceSerial,
        status,
        errorMessage,
        employeeId,
        employeeName,
        employeePhotoUrl,
        timestamp,
        deviceName,
        deviceId
    });
}

/**
 * Kart numarası ve seri numarasını ayrıştırır
 */
export function parseCardData(userIdSerialValue: string): { cardNumber: string; deviceSerial: string } | null {
    // %T formatını kontrol et
    if (!userIdSerialValue.includes('%T,')) {
        return null;
    }

    // %T,<serial_number> formatını ayrıştır
    const parts = userIdSerialValue.split(',');
    if (parts.length < 2) {
        return null;
    }

    // Kart numarası (%T bölümünden sonra gelen değer)
    const cardPart = parts[0];
    const cardNumber = cardPart.replace('%T', '');

    // Cihaz seri numarası (virgülden sonraki kısım)
    const deviceSerial = parts[1];

    if (!cardNumber || !deviceSerial) {
        return null;
    }

    return { cardNumber, deviceSerial };
}

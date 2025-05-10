
import { Database } from '@/integrations/supabase/types';
import { createClient } from '@supabase/supabase-js';

// Response types
export type SuccessResponse = {
    response: 'open_relay';
    confirmation: 'relay_opened';
}

export type ErrorResponse = {
    response: 'deny';
    confirmation: 'relay_closed';
    error?: string;
}

export type CardReaderResponse = SuccessResponse | ErrorResponse;

// Request type
export interface CardReaderRequest {
    user_id_serial?: string;
    [key: string]: any;
}

// Types for the logging function
export interface CardReadingLogParams {
    supabase: ReturnType<typeof createClient<Database>>;
    cardNumber: string;
    deviceSerial: string;
    status: 'granted' | 'denied';
    errorMessage?: string;
    employeeId?: string;
    employeeName?: string;
    employeePhotoUrl?: string;
    timestamp?: string;
}

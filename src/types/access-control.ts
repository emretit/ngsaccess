
export interface CardReading {
    id: number;
    card_no: string;
    access_granted: boolean;
    access_time: string;
    employee_id: number | null;
    employee_name: string | null;
    employee_photo_url: string | null;
    device_id: string;
    device_name: string;
    device_location: string;
    device_ip: string;
    device_serial: string;
    status: 'success' | 'denied' | 'unknown';
    read_type?: string;
    raw_data?: string;
    created_at?: string;
    updated_at?: string;
    read_time?: string;
    employees?: {
        departments?: {
            name: string;
        } | null;
    } | null;
}

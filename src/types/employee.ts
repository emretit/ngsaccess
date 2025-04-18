
export interface Employee {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    tc_no: string;
    card_number: string;
    access_permission: boolean;
    photo_url: string | null;
    shift: string | null;
    company_id: number | null;
    department_id: number;
    position_id: number | null;
    shift_id: number | null;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    departments?: {
        id: number;
        name: string;
    } | null;
    positions?: {
        id: number;
        name: string;
    } | null;
}

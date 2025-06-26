
export interface Employee {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    tc_no: string;
    card_number: string;
    photo_url: string | null;
    shift: string | null;
    company_id: number | null;
    department_id: number;
    position_id: number | null;
    shift_id: number | null;
    access_rule_id: number | null;
    access_rule?: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    notes?: string;
    departments?: {
        id: number;
        name: string;
    } | null;
    positions?: {
        id: number;
        name: string;
    } | null;
}

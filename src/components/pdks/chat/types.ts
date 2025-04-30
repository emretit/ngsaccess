
export interface MessageData {
  name: string;
  check_in: string;
  check_out: string | null;
  department: string;
  device?: string;
  location?: string;
}

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  data?: MessageData[];
}

export interface QueryParams {
  department?: string | null;
  date?: string | null;
  month?: string;
  year?: string;
  startDate?: string | null;
  endDate?: string | null;
}


export interface MessageData {
  name: string;
  check_in: string;
  check_out: string | null;
  department: string;
}

export interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  data?: MessageData[];
}

export interface AiEndpoints {
  completion: string[];
  status: string[];
  report: string[];
}

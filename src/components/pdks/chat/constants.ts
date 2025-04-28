
export const LOCAL_LLAMA_ENDPOINTS = {
  completion: [
    "http://localhost:5050/completion",
    "http://127.0.0.1:5050/completion"
  ],
  status: [
    "http://localhost:5050/status",
    "http://127.0.0.1:5050/status"
  ],
  report: [
    "http://localhost:5050/api/pdks-report",
    "http://127.0.0.1:5050/api/pdks-report"
  ]
};

export const SUPABASE_NATURAL_QUERY_ENDPOINT = "https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/pdks-natural-query";
export const PDF_GENERATION_ENDPOINT = "https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/generate-pdf";

export const LOCAL_MODEL_ENABLED = true;


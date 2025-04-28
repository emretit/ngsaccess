export const LOCAL_LLAMA_ENDPOINTS = {
  completion: [
    "http://localhost:4891/v1/chat/completions",
    "http://127.0.0.1:4891/v1/chat/completions"
  ],
  status: [
    "http://localhost:4891/v1/models",
    "http://127.0.0.1:4891/v1/models"
  ],
  report: [
    "http://localhost:4891/v1/pdks-report",
    "http://127.0.0.1:4891/v1/pdks-report"
  ]
};

export const SUPABASE_NATURAL_QUERY_ENDPOINT = "https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/pdks-natural-query";
export const PDF_GENERATION_ENDPOINT = "https://gjudsghhwmnsnndnswho.supabase.co/functions/v1/generate-pdf";

export const LOCAL_MODEL_ENABLED = true;


import { supabase } from "@/integrations/supabase/client";

export async function sendChatMessage(input: string) {
  console.log("Calling Supabase pdks-ai edge function");
  
  const response = await supabase.functions.invoke('pdks-ai', {
    body: JSON.stringify({ prompt: input })
  });
  
  console.log("Edge function response:", response);
  
  if (response.error) {
    throw new Error(response.error.message || "Edge function error");
  }
  
  return response.data;
}

export async function executeSqlQuery(query: string) {
  console.log("Executing SQL query:", query);
  
  const response = await fetch("http://localhost:5050/api/execute-sql", {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("SQL execution error:", errorText);
    throw new Error(errorText);
  }

  return response.json();
}

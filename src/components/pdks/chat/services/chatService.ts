
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
  const { data, error } = await supabase.rpc('execute_sql', { query_text: query });
  
  if (error) {
    console.error("SQL execution error:", error);
    throw error;
  }

  return { data };
}

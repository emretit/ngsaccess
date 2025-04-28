
import { supabase } from "@/integrations/supabase/client";
import { LOCAL_GPT4ALL_ENDPOINTS, GPT4ALL_DEFAULT_MODEL } from "../constants";

export async function sendChatMessage(input: string) {
  console.log("Calling local GPT4All service");
  
  try {
    // Try local GPT4All first
    const gpt4allResponse = await fetch(LOCAL_GPT4ALL_ENDPOINTS.COMPLETION, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GPT4ALL_DEFAULT_MODEL,
        prompt: input,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.95,
        stop: ["###"]
      })
    });
    
    if (gpt4allResponse.ok) {
      const data = await gpt4allResponse.json();
      console.log("GPT4All response:", data);
      
      return {
        content: data.choices[0].text,
        source: 'gpt4all'
      };
    }
    
    throw new Error("GPT4All service unavailable");
  } catch (error) {
    console.error("GPT4All error:", error);
    
    // Fallback to Supabase edge function
    console.log("Falling back to Supabase pdks-ai edge function");
    const response = await supabase.functions.invoke('pdks-ai', {
      body: JSON.stringify({ prompt: input })
    });
    
    console.log("Edge function response:", response);
    
    if (response.error) {
      throw new Error(response.error.message || "Edge function error");
    }
    
    return response.data;
  }
}

export async function executeSqlQuery(query: string) {
  const { data, error } = await supabase.rpc('execute_query', { query_text: query });
  
  if (error) {
    console.error("SQL execution error:", error);
    throw error;
  }

  return { data };
}

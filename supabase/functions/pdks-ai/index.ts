
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { pipeline } from "@huggingface/transformers";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    // Get records from database based on the prompt
    const { data: records, error } = await supabase
      .from('pdks_records')
      .select(`
        *,
        employees (
          department_id,
          departments (name)
        )
      `);

    if (error) throw error;

    // Initialize the transformer pipeline with Llama
    const llm = await pipeline(
      "text-generation",
      "mixedbread-ai/mxbai-embed-xsmall-v1",
      { device: "cpu" }
    );

    // Process the prompt with the data context
    const context = `You are an AI assistant analyzing employee attendance records. 
    Here is the data: ${JSON.stringify(records)}. 
    The prompt is: ${prompt}`;

    const output = await llm(context, {
      max_new_tokens: 100,
      temperature: 0.7
    });

    return new Response(JSON.stringify({ 
      answer: output[0].generated_text 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in PDKS AI assistant:', error);
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

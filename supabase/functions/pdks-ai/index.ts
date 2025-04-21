
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client 
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, useLocalModel } = await req.json();

    // Get records from database to provide context
    const { data: records, error } = await supabaseClient
      .from('pdks_records')
      .select(`
        *,
        employees (
          department_id,
          departments (name)
        )
      `);

    if (error) throw error;

    // Data context for the AI model
    const context = `You are an AI assistant analyzing employee attendance records. 
    Here is the data: ${JSON.stringify(records)}. 
    The prompt is: ${prompt}`;

    // Respond with a note that local model should be used
    return new Response(JSON.stringify({ 
      answer: "Bu fonksiyon, yerel Llama modeline bağlanmak için yapılandırılmıştır. Lütfen yerel modeli kullanın.",
      shouldUseLocalModel: true
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

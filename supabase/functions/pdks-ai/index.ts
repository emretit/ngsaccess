
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

// Llama model endpoint configuration
const LLAMA_ENDPOINT = 'http://localhost:8000';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    // Determine if this is a chat or report query
    const isReportQuery = prompt.toLowerCase().includes('rapor:') || 
                          prompt.toLowerCase().includes('report:');

    let context = '';
    
    if (isReportQuery) {
      // Get PDKS records from database for context if it's a report query
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

      // Format context for the Llama model
      context = `Sen bir PDKS (Personel Devam Kontrol Sistemi) asistanısın. 
      İşte mevcut veriler: ${JSON.stringify(records)}. 
      Soru: ${prompt}
      
      Lütfen verilen bağlamı kullanarak soruyu yanıtla.`;
    } else {
      // Regular conversational chat
      context = `Sen yardımcı bir asistansın. Kullanıcı ile normal bir sohbet ediyorsun.
      Soru: ${prompt}
      
      Lütfen doğal ve yardımsever bir şekilde yanıt ver. Eğer kullanıcı PDKS verisi isterse,
      onu 'Rapor:' ile başlayan bir soru sormaya yönlendir.`;
    }

    try {
      // Try to connect to local Llama server
      const llamaResponse = await fetch(`${LLAMA_ENDPOINT}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: context,
          max_tokens: 500,
          temperature: 0.7,
          top_p: 0.9,
          stop: ["###"]
        })
      });

      if (!llamaResponse.ok) {
        throw new Error(`Local Llama server connection failed: ${llamaResponse.status} ${llamaResponse.statusText}`);
      }

      const data = await llamaResponse.json();
      return new Response(JSON.stringify({ 
        content: data.content,
        source: 'llama'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (llamaError) {
      console.error('Llama server error:', llamaError);
      
      // For normal chat, provide a generic fallback response
      if (!isReportQuery) {
        return new Response(JSON.stringify({ 
          content: "Merhaba! Ben PDKS asistanıyım. Şu anda normal sohbet modunda hizmet veremiyorum, ancak 'Rapor:' ile başlayan bir soru sorarak veri sorgulayabilirsiniz. Örneğin: 'Rapor: Bugün işe gelenler'", 
          source: 'fallback'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // For report queries, use the natural language processor
      return new Response(JSON.stringify({ 
        content: "Raporunuz için doğal dil işleme servisi kullanılacak. Lütfen bekleyin...",
        error: llamaError.message,
        shouldUseNaturalQuery: true
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

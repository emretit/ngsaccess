
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
const LLAMA_ENDPOINT = 'http://localhost:5050';

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
        .from('card_readings')
        .select(`
          *,
          employees (
            first_name,
            last_name,
            department_id,
            departments (name)
          )
        `)
        .limit(20); // Limit context size for performance

      if (error) throw error;

      // Format context for the Llama model with SQL generation instructions
      context = `Sen bir PDKS (Personel Devam Kontrol Sistemi) asistanısın. 
      İşte mevcut verilerden örnekler: ${JSON.stringify(records).substring(0, 1000)}... 
      
      Kullanıcı Sorusu: ${prompt}
      
      Lütfen bu soruya cevap ver ve SADECE cevabın sonunda üç backtick içinde SQL sorgusunu oluştur. 
      Örnek format:
      
      Analiz sonuçlarım şunlar...
      
      \`\`\`sql
      SELECT * FROM card_readings WHERE ...
      \`\`\`
      
      Sorgu, card_readings tablosunu sorgulayacak şekilde olmalıdır. Bu tablo çalışanların kart okutma kayıtlarını içerir.`;
    } else {
      // Regular conversational chat
      context = `Sen yardımcı bir PDKS (Personel Devam Kontrol Sistemi) asistanısın. 
      Kullanıcı ile normal bir sohbet ediyorsun.
      Soru: ${prompt}
      
      Lütfen doğal ve yardımsever bir şekilde yanıt ver. Eğer kullanıcı PDKS verileri hakkında bir rapor 
      isterse, ona "Rapor:" ile başlayan bir soru sormasını öner.`;
    }

    // First try to connect to local Llama model
    try {
      console.log("Connecting to Llama model at:", LLAMA_ENDPOINT);
      
      // First try /completion endpoint
      const llamaResponse = await fetch(`${LLAMA_ENDPOINT}/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: context,
          max_tokens: 800,
          temperature: 0.7,
          top_p: 0.9,
          stop: ["###"]
        })
      });

      if (!llamaResponse.ok) {
        throw new Error(`Local Llama server connection failed: ${llamaResponse.status} ${llamaResponse.statusText}`);
      }

      const data = await llamaResponse.json();
      
      let content = data.content;
      let sqlQuery = null;
      
      // Extract SQL query if it exists in the response
      if (isReportQuery && content.includes('```sql')) {
        const sqlMatch = content.match(/```sql\s+([\s\S]*?)\s+```/);
        if (sqlMatch && sqlMatch[1]) {
          sqlQuery = sqlMatch[1].trim();
        }
      }

      return new Response(JSON.stringify({ 
        content,
        sqlQuery,
        source: 'llama'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (llamaError) {
      console.error('Llama server error:', llamaError);
      
      // For normal chat, provide customized responses based on the question
      if (!isReportQuery) {
        return new Response(JSON.stringify({ 
          content: "Üzgünüm, şu anda Llama AI modeline bağlanamıyorum. Lütfen daha sonra tekrar deneyin veya sistem yöneticinize başvurun.",
          source: 'fallback'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // For report queries, fall back to a simplified explanation
      return new Response(JSON.stringify({ 
        content: "Üzgünüm, rapor oluşturmak için Llama AI modeline bağlanamıyorum. Lütfen sistem yöneticisi ile iletişime geçin.",
        error: llamaError.message
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


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

    // Veritabanından departmanları ve çalışanları çek
    const { data: departments, error: depError } = await supabaseClient
      .from('departments')
      .select('*');
    
    if (depError) {
      console.error("Departman verileri çekilirken hata:", depError);
    }
    
    const { data: employees, error: empError } = await supabaseClient
      .from('employees')
      .select(`
        *,
        departments (id, name),
        positions (id, name)
      `);
    
    if (empError) {
      console.error("Çalışan verileri çekilirken hata:", empError);
    }
    
    // Veritabanı bilgilerinin özeti
    let dbSummary = "Veritabanı özeti:\n";
    
    if (departments && departments.length > 0) {
      dbSummary += `Departmanlar: ${departments.map(d => `${d.id}: ${d.name}`).join(", ")}\n`;
    } else {
      dbSummary += "Departman verisi bulunamadı.\n";
    }
    
    if (employees && employees.length > 0) {
      dbSummary += `Çalışanlar: ${employees.map(e => `${e.id}: ${e.first_name} ${e.last_name} (${e.departments?.name || 'Departmansız'}, ${e.positions?.name || 'Pozisyonsuz'})`).join("; ")}\n`;
    } else {
      dbSummary += "Çalışan verisi bulunamadı.";
    }

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
      
      ${dbSummary}
      
      İşte mevcut veritabanı kayıtlarından örnekler: ${JSON.stringify(records).substring(0, 1000)}... 
      
      Kullanıcı Sorusu: ${prompt}
      
      ÖNEMLİ: Yanıtlarında hayali veya örnek kişi isimleri (Ahmet Yılmaz, Ayşe Demir vb.) KULLANMA. Yanıtlarında sadece veritabanında bulunan gerçek çalışan isimlerini kullan.
      
      Lütfen bu soruya cevap ver ve SADECE cevabın sonunda üç backtick içinde SQL sorgusunu oluştur. 
      Örnek format:
      
      Analiz sonuçlarım şunlar...
      
      \`\`\`sql
      SELECT * FROM card_readings WHERE ...
      \`\`\`
      
      Sorgu, card_readings tablosunu sorgulayacak şekilde olmalıdır. Bu tablo çalışanların kart okutma kayıtlarını içerir.`;
    } else {
      // Regular conversational chat with database context
      context = `Sen yardımcı bir PDKS (Personel Devam Kontrol Sistemi) asistanısın. 
      
      ${dbSummary}
      
      Kullanıcı ile normal bir sohbet ediyorsun.
      Soru: ${prompt}
      
      ÖNEMLİ: Yanıtlarında hayali veya örnek kişi isimleri (Ahmet Yılmaz, Ayşe Demir vb.) KULLANMA. Yanıtlarında sadece veritabanında bulunan gerçek çalışan isimlerini kullan.
      
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
      
      // For normal chat, use the database context to create a response
      if (!isReportQuery) {
        // Eğer Llama modeline ulaşılamazsa, dahili bir yanıt oluştur
        let fallbackResponse = "Şu anda Llama AI modeline bağlanamıyorum, ancak veritabanı bilgilerine dayanarak yardımcı olabilirim.\n\n";
        
        // İstek içeriğine göre basit yanıtlar oluştur
        if (prompt.toLowerCase().includes("merhaba") || prompt.toLowerCase().includes("selam")) {
          fallbackResponse += "Merhaba! Ben PDKS asistanınızım. Size nasıl yardımcı olabilirim?";
        } else if (prompt.toLowerCase().includes("departman")) {
          const deptName = prompt.toLowerCase().includes("engineering") || prompt.toLowerCase().includes("mühendislik") ? "Engineering" : "";
          
          if (deptName && departments) {
            const foundDept = departments.find(d => d.name.toLowerCase().includes(deptName.toLowerCase()));
            if (foundDept) {
              fallbackResponse += `${foundDept.name} departmanı veritabanımızda bulunuyor. `;
              
              if (employees) {
                const deptEmployees = employees.filter(e => e.departments?.name?.toLowerCase().includes(deptName.toLowerCase()));
                if (deptEmployees.length > 0) {
                  fallbackResponse += `Bu departmanda çalışanlar: ${deptEmployees.map(e => `${e.first_name} ${e.last_name}`).join(", ")}`;
                } else {
                  fallbackResponse += "Bu departmanda henüz çalışan kaydı bulunmuyor.";
                }
              }
            }
          } else {
            if (departments && departments.length > 0) {
              fallbackResponse += `Veritabanında bulunan departmanlar: ${departments.map(d => d.name).join(", ")}`;
            }
          }
        } else if (prompt.toLowerCase().includes("çalışan") || prompt.toLowerCase().includes("employee")) {
          if (employees && employees.length > 0) {
            fallbackResponse += `Veritabanında kayıtlı çalışanlar: ${employees.map(e => `${e.first_name} ${e.last_name} (${e.departments?.name || "Departmansız"})`).join(", ")}`;
          } else {
            fallbackResponse += "Veritabanında henüz çalışan kaydı bulunmuyor.";
          }
        } else {
          fallbackResponse += "Veritabanı bilgilerine göre size yardımcı olmak için daha spesifik bir soru sorabilirsiniz.";
        }
        
        return new Response(JSON.stringify({ 
          content: fallbackResponse,
          source: 'fallback'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // For report queries, fall back to a simplified explanation
      return new Response(JSON.stringify({ 
        content: "Üzgünüm, rapor oluşturmak için Llama AI modeline bağlanamıyorum. Ancak veritabanı bilgilerine göre yardımcı olmaya çalışabilirim. Lütfen daha detaylı bir soru sorun veya sistem yöneticisiyle iletişime geçin.",
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

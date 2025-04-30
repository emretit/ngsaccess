
import { GPT4ALL_SYSTEM_PROMPT } from "../constants";
import { supabase } from "@/integrations/supabase/client";

const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini"; // Using a modern OpenAI model

export async function sendChatMessage(input: string) {
  console.log("Sending message to OpenAI API");
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye zaman aşımı
    
    const apiKey = localStorage.getItem('OPENAI_API_KEY');
    
    if (!apiKey) {
      return {
        content: "OpenAI API anahtarı bulunamadı. Lütfen API anahtarını ayarlayın.",
        source: 'error'
      };
    }
    
    // Add basic validation for API key format
    if (!apiKey.startsWith('sk-')) {
      return {
        content: "Geçersiz OpenAI API anahtarı formatı. API anahtarları 'sk-' ile başlamalıdır.",
        source: 'error'
      };
    }

    // Veritabanından departman bilgilerini çek
    const { data: departmentsData, error: departmentsError } = await supabase
      .from('departments')
      .select('*');
    
    if (departmentsError) {
      console.error("Departman bilgileri çekilirken hata:", departmentsError);
    }

    // Veritabanından çalışan bilgilerini çek
    const { data: employeesData, error: employeesError } = await supabase
      .from('employees')
      .select(`
        *,
        departments (id, name),
        positions (id, name)
      `);
    
    if (employeesError) {
      console.error("Çalışan bilgileri çekilirken hata:", employeesError);
    }

    // Veritabanı bilgilerini içeren bir context oluştur
    let dbContext = "Sistem veritabanı bilgileri:";
    
    if (departmentsData && departmentsData.length > 0) {
      dbContext += `\nDepartmanlar: ${departmentsData.map(d => `${d.id}: ${d.name}`).join(", ")}`;
    }
    
    if (employeesData && employeesData.length > 0) {
      dbContext += `\nÇalışanlar: ${employeesData.map(e => `${e.first_name} ${e.last_name} (${e.departments?.name || 'Departman yok'} departmanı, ${e.positions?.name || 'Pozisyon yok'})`).join("; ")}`;
    }
    
    // Güncellenmiş sistem prompt'u oluştur
    const enhancedSystemPrompt = `${GPT4ALL_SYSTEM_PROMPT}\n\n${dbContext}`;
    
    try {
      console.log("Connecting to OpenAI API...");
      const response = await fetch(OPENAI_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [
            { role: "system", content: enhancedSystemPrompt },
            { role: "user", content: input }
          ],
          max_tokens: 1000,
          temperature: 0.7
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log("OpenAI API response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let errorMessage = `OpenAI API hatası: ${response.status}`;
        
        if (errorData.error) {
          if (errorData.error.type === "invalid_request_error" && 
              errorData.error.message && errorData.error.message.includes("API key")) {
            errorMessage = "Geçersiz OpenAI API anahtarı. Lütfen API anahtarınızı kontrol edin.";
            // Clear invalid key
            localStorage.removeItem('OPENAI_API_KEY');
          } else {
            errorMessage += ` - ${errorData.error.message || 'Bilinmeyen hata'}`;
          }
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log("OpenAI yanıtı alındı");
      
      if (!data.choices || !data.choices[0]) {
        return {
          content: "Üzgünüm, yanıt oluşturulurken bir hata meydana geldi.",
          source: 'error'
        };
      }
      
      return {
        content: data.choices[0].message.content,
        source: 'openai'
      };
    } catch (fetchError) {
      // Clear timeout if there was a fetch error
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    console.error("Chat service error:", error);
    
    // Daha detaylı hata mesajları
    let errorMessage = "Üzgünüm, OpenAI bağlantısında bir hata oluştu.";
    
    if (error instanceof DOMException && error.name === "AbortError") {
      errorMessage = "Bağlantı zaman aşımına uğradı. OpenAI yanıt vermedi.";
    } else if (error instanceof Error) {
      errorMessage = error.message;
      
      // If API key is invalid, suggest resetting it
      if (errorMessage.includes("Geçersiz OpenAI API anahtarı")) {
        errorMessage += " Yeni bir API anahtarı eklemek için sayfayı yenileyebilirsiniz.";
      }
    }
    
    return {
      content: errorMessage,
      source: 'error'
    };
  }
}

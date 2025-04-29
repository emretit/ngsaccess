
import { GPT4ALL_SYSTEM_PROMPT } from "../constants";

const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini"; // Using a modern OpenAI model

export async function sendChatMessage(input: string) {
  console.log("Sending message to OpenAI API");
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye zaman aşımı
    
    const apiKey = process.env.OPEN_AI_API_KEY || localStorage.getItem('OPENAI_API_KEY');
    
    if (!apiKey) {
      return {
        content: "OpenAI API anahtarı bulunamadı. Lütfen API anahtarını ayarlayın.",
        source: 'error'
      };
    }
    
    const response = await fetch(OPENAI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: GPT4ALL_SYSTEM_PROMPT },
          { role: "user", content: input }
        ],
        max_tokens: 1000,
        temperature: 0.7
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API hatası: ${response.status} - ${errorData.error?.message || 'Bilinmeyen hata'}`);
    }
    
    const data = await response.json();
    console.log("OpenAI yanıtı:", data);
    
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
  } catch (error) {
    console.error("Chat service error:", error);
    
    // Daha detaylı hata mesajları
    let errorMessage = "Üzgünüm, OpenAI bağlantısında bir hata oluştu.";
    
    if (error instanceof DOMException && error.name === "AbortError") {
      errorMessage = "Bağlantı zaman aşımına uğradı. OpenAI yanıt vermedi.";
    } else if (error instanceof Error) {
      errorMessage = `Hata: ${error.message}`;
    }
    
    return {
      content: errorMessage,
      source: 'error'
    };
  }
}

// Helper function to format the prompt with system instructions is no longer needed
// since we're using OpenAI's message structure

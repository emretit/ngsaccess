
import { GPT4ALL_SYSTEM_PROMPT } from "../../constants";

const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini"; // OpenAI's modern model

export interface OpenAIResponse {
  content: string;
  source: 'openai' | 'error';
}

// Process message with OpenAI
export async function processWithOpenAI(input: string, dbContext: string): Promise<OpenAIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
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

  // Create enhanced system prompt
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
      let errorMessage = `OpenAI API error: ${response.status}`;
      
      if (errorData.error) {
        if (errorData.error.type === "invalid_request_error" && 
            errorData.error.message && errorData.error.message.includes("API key")) {
          errorMessage = "Invalid OpenAI API key. Please check your API key.";
          // Clear invalid key
          localStorage.removeItem('OPENAI_API_KEY');
        } else {
          errorMessage += ` - ${errorData.error.message || 'Unknown error'}`;
        }
      }
      
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    console.log("OpenAI response received");
    
    if (!data.choices || !data.choices[0]) {
      return {
        content: "Sorry, I couldn't generate a response.",
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
}

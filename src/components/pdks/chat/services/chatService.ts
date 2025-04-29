
import { GPT4ALL_ENDPOINT, GPT4ALL_DEFAULT_MODEL, GPT4ALL_SYSTEM_PROMPT } from "../constants";

export async function sendChatMessage(input: string) {
  console.log("Sending message to GPT4All");
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 saniye zaman aşımı
    
    const response = await fetch(`${GPT4ALL_ENDPOINT}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GPT4ALL_DEFAULT_MODEL,
        prompt: preparePrompt(input),
        max_tokens: 1000, // Increased token limit for longer responses
        temperature: 0.7
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`GPT4All API hatası: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("GPT4All yanıtı:", data);
    
    if (!data.choices || !data.choices[0]) {
      return {
        content: "Üzgünüm, yanıt oluşturulurken bir hata meydana geldi.",
        source: 'error'
      };
    }
    
    return {
      content: data.choices[0].text,
      source: 'gpt4all'
    };
  } catch (error) {
    console.error("Chat service error:", error);
    
    // Daha detaylı hata mesajları
    let errorMessage = "Üzgünüm, GPT4All bağlantısında bir hata oluştu.";
    
    if (error instanceof DOMException && error.name === "AbortError") {
      errorMessage = "Bağlantı zaman aşımına uğradı. GPT4All yanıt vermedi.";
    } else if (error instanceof Error) {
      if (error.message.includes("Failed to fetch")) {
        errorMessage = "GPT4All API'sine bağlanılamadı. Lütfen GPT4All uygulamasının çalıştığından ve API sunucusunun etkinleştirildiğinden emin olun.";
      }
    }
    
    return {
      content: `${errorMessage}\n\nKurulum rehberi için docs/gpt4all-setup.md dosyasını inceleyebilirsiniz.`,
      source: 'error'
    };
  }
}

// Helper function to format the prompt with system instructions
function preparePrompt(userInput: string): string {
  return `${GPT4ALL_SYSTEM_PROMPT}\n\nKullanıcı: ${userInput}\nAsistan:`;
}

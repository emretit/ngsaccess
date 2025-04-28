
import { GPT4ALL_ENDPOINT, GPT4ALL_DEFAULT_MODEL } from "../constants";

export async function sendChatMessage(input: string) {
  console.log("Sending message to GPT4All");
  
  try {
    const response = await fetch(`${GPT4ALL_ENDPOINT}/v1/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GPT4ALL_DEFAULT_MODEL,
        prompt: input,
        max_tokens: 500,
        temperature: 0.7
      })
    });
    
    if (!response.ok) {
      throw new Error(`GPT4All error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log("GPT4All response:", data);
    
    return {
      content: data.choices && data.choices[0] ? data.choices[0].text : "Üzgünüm, bir cevap oluşturulamadı.",
      source: 'gpt4all'
    };
  } catch (error) {
    console.error("Chat service error:", error);
    return {
      content: "Üzgünüm, GPT4All bağlantısında bir hata oluştu. Lütfen GPT4All uygulamasının çalıştığından ve API sunucusunun etkin olduğundan emin olun.",
      source: 'error'
    };
  }
}

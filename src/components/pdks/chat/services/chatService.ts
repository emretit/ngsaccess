
import { parseQuery } from './parsers/queryParser';
import { fetchCardReadings, fetchDatabaseContext } from './database/cardReadingsService';
import { processWithOpenAI } from './openai/openaiService';

export async function sendChatMessage(input: string) {
  console.log("Processing chat message:", input);
  
  try {
    // Mesajı işleme için log ekle
    console.log("İncelenen mesaj içeriği:", input);
    
    // Departman bilgileri içeren bir mesaj mı kontrol et
    const containsDepartmentInfo = input.includes("Mevcut departmanlar:");
    if (containsDepartmentInfo) {
      console.log("Mesaj departman bilgileri içeriyor, bağlam zenginleştirmesi yapıldı.");
    }
    
    // Check if this is a query that can be handled by the natural language parser
    const queryParams = parseQuery(input);
    
    if (queryParams.department) {
      console.log("Tespit edilen departman:", queryParams.department);
    }
    
    const isReportQuery = (queryParams.department || queryParams.date);
    
    if (isReportQuery) {
      console.log("Handling as report query", queryParams);
      
      try {
        // Fetch the data based on the parsed query
        const cardReadings = await fetchCardReadings(queryParams);
        
        if (cardReadings.length === 0) {
          return {
            content: `Belirtilen kriterlere uygun kayıt bulunamadı. (${queryParams.department || 'Tüm departmanlar'}, ${queryParams.date ? new Date(queryParams.date).toLocaleDateString('tr-TR') : 'Tüm tarihler'})`,
            source: 'parser'
          };
        }
        
        // Create a human-readable response
        const departmentStr = queryParams.department || "tüm departmanlar";
        const dateStr = queryParams.date ? new Date(queryParams.date).toLocaleDateString('tr-TR') : "tüm tarihler";
        
        const responseMessage = `${departmentStr} için ${dateStr} tarihindeki giriş kayıtları:`;
        
        return {
          content: responseMessage,
          data: cardReadings,
          source: 'parser'
        };
      } catch (error) {
        console.error("Error processing natural language query:", error);
        return {
          content: `Doğal dil sorgunuzu işlerken bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
          source: 'error'
        };
      }
    }
    
    // If not a report query, process with OpenAI
    try {
      // Fetch database context for AI
      const dbContext = await fetchDatabaseContext();
      
      // Process with OpenAI
      return await processWithOpenAI(input, dbContext);
    } catch (error) {
      console.error("Chat service error:", error);
      
      // More detailed error messages
      let errorMessage = "Sorry, there was an error connecting to OpenAI.";
      
      if (error instanceof DOMException && error.name === "AbortError") {
        errorMessage = "Connection timed out. OpenAI did not respond.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
        
        // If API key is invalid, suggest resetting it
        if (errorMessage.includes("Invalid OpenAI API key")) {
          errorMessage += " You can refresh the page to add a new API key.";
        }
      }
      
      return {
        content: errorMessage,
        source: 'error'
      };
    }
  } catch (error) {
    console.error("Chat service error:", error);
    
    return {
      content: `Bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`,
      source: 'error'
    };
  }
}

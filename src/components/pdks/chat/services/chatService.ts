import { parseQuery } from './parsers/queryParser';
import {
  fetchCardReadings,
  fetchDatabaseContext,
  type FetchCardReadingsFn,
  type FetchDatabaseContextFn,
} from './database/cardReadingsService';
import { processWithOpenAI } from './openai/openaiService';
import type { ProcessOpenAIFn } from './openai/openaiService';
import { NaturalLanguageService } from './naturalLanguageService';

export type ChatDataFetchers = {
  fetchCardReadings: FetchCardReadingsFn;
  fetchDatabaseContext: FetchDatabaseContextFn;
  processOpenAI?: ProcessOpenAIFn;
};

export async function sendChatMessage(
  input: string,
  fetchers?: ChatDataFetchers
) {
  try {
    // Önce doğal dil servisimizle deneyelim
    const nlResult = await NaturalLanguageService.processQuery(input, fetchers);
    
    // Eğer doğal dil servisi başarıyla sonuç döndürdüyse onu kullan
    if (nlResult.source !== 'error' && (nlResult.data?.length || 0) > 0) {
      return nlResult;
    }
    
    // Eğer doğal dil servisi sonuç bulamadıysa eski sistemi dene
    // Check if this is a query that can be handled by the natural language parser
    const queryParams = parseQuery(input);
    
    const isReportQuery = (queryParams.department || queryParams.date);
    
    if (isReportQuery) {
      try {
        // Fetch the data based on the parsed query
        const cardReadings = await fetchCardReadings(queryParams, fetchers?.fetchCardReadings);
        
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
      const dbContext = await fetchDatabaseContext(fetchers?.fetchDatabaseContext);
      
      // Process with OpenAI
      return await processWithOpenAI(input, dbContext, fetchers?.processOpenAI);
    } catch (error) {
      console.error("Chat service error:", error);
      
      // More detailed error messages
      let errorMessage = "Sorry, there was an error connecting to OpenAI.";
      
      if (error instanceof DOMException && error.name === "AbortError") {
        errorMessage = "Connection timed out. OpenAI did not respond.";
      } else if (error instanceof Error) {
        errorMessage = error.message;
        
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

// Create a chatService object for compatibility
export const chatService = {
  sendMessage: sendChatMessage
};

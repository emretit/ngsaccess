
import { GPT4ALL_SYSTEM_PROMPT } from "../constants";
import { supabase } from "@/integrations/supabase/client";
import { MessageData, QueryParams } from "../types";

const OPENAI_API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini"; // OpenAI's modern model

// Helper function to extract date from a query string
function extractDateFromQuery(query: string): string | null {
  // Common date formats in Turkish and English
  const datePatterns = [
    /(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+(\d{4})/i,  // 25 Nisan 2023
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i, // 25 April 2023
    /(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})/,  // 25/04/2023, 25.04.2023, 25-04-2023
    /(\d{4})[\/\.-](\d{1,2})[\/\.-](\d{1,2})/   // 2023/04/25, 2023.04.25, 2023-04-25
  ];
  
  const monthMap: Record<string, string> = {
    'ocak': '01', 'january': '01',
    'şubat': '02', 'february': '02',
    'mart': '03', 'march': '03',
    'nisan': '04', 'april': '04',
    'mayıs': '05', 'may': '05',
    'haziran': '06', 'june': '06',
    'temmuz': '07', 'july': '07',
    'ağustos': '08', 'august': '08',
    'eylül': '09', 'september': '09',
    'ekim': '10', 'october': '10',
    'kasım': '11', 'november': '11',
    'aralık': '12', 'december': '12'
  };
  
  for (const pattern of datePatterns) {
    const match = query.match(pattern);
    if (match) {
      // Check which pattern matched
      if (pattern.toString().includes('ocak|şubat|mart') || pattern.toString().includes('january|february|march')) {
        // Format: 25 Nisan 2023 or 25 April 2023
        const day = match[1].padStart(2, '0');
        const month = monthMap[match[2].toLowerCase()];
        const year = match[3];
        return `${year}-${month}-${day}`; // ISO format: YYYY-MM-DD
      } else if (pattern.toString().includes('\\d{4}')) {
        // Format: 2023/04/25
        const year = match[1];
        const month = match[2].padStart(2, '0');
        const day = match[3].padStart(2, '0');
        return `${year}-${month}-${day}`;
      } else {
        // Format: 25/04/2023
        const day = match[1].padStart(2, '0');
        const month = match[2].padStart(2, '0');
        const year = match[3];
        return `${year}-${month}-${day}`;
      }
    }
  }
  
  // Try to match just day and month, assume current year
  const shortDatePatterns = [
    /(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)/i,  // 25 Nisan
    /(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i, // 25 April
  ];
  
  for (const pattern of shortDatePatterns) {
    const match = query.match(pattern);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = monthMap[match[2].toLowerCase()];
      const year = new Date().getFullYear();
      return `${year}-${month}-${day}`;
    }
  }
  
  return null;
}

// Helper function to extract department from a query string
function extractDepartmentFromQuery(query: string): string | null {
  // Define common department patterns
  const departmentPatterns = [
    /(insan\s+kaynakları|human\s+resources|hr)\s+departmanı/i,
    /departman[ıi]?\s+(insan\s+kaynakları|human\s+resources|hr)/i,
    /(finans|finance)\s+departmanı/i,
    /departman[ıi]?\s+(finans|finance)/i,
    /(bilgi\s+teknolojileri|information\s+technology|it)\s+departmanı/i,
    /departman[ıi]?\s+(bilgi\s+teknolojileri|information\s+technology|it)/i,
    /(satış|sales)\s+departmanı/i,
    /departman[ıi]?\s+(satış|sales)/i,
    /(pazarlama|marketing)\s+departmanı/i,
    /departman[ıi]?\s+(pazarlama|marketing)/i,
    /(üretim|production|manufacturing)\s+departmanı/i,
    /departman[ıi]?\s+(üretim|production|manufacturing)/i,
    /(mühendislik|engineering)\s+departmanı/i,
    /departman[ıi]?\s+(mühendislik|engineering)/i
  ];
  
  // Department name mapping
  const departmentMap: Record<string, string> = {
    'insan kaynakları': 'Human Resources',
    'human resources': 'Human Resources',
    'hr': 'Human Resources',
    'finans': 'Finance',
    'finance': 'Finance',
    'bilgi teknolojileri': 'IT',
    'information technology': 'IT',
    'it': 'IT',
    'satış': 'Sales',
    'sales': 'Sales',
    'pazarlama': 'Marketing',
    'marketing': 'Marketing',
    'üretim': 'Production',
    'production': 'Production',
    'manufacturing': 'Production',
    'mühendislik': 'Engineering',
    'engineering': 'Engineering'
  };
  
  // Check each pattern
  for (const pattern of departmentPatterns) {
    const match = query.match(pattern);
    if (match) {
      // Find which department matched
      for (const [key, value] of Object.entries(departmentMap)) {
        if (match[0].toLowerCase().includes(key)) {
          return value;
        }
      }
    }
  }
  
  // Direct department name detection
  for (const [key, value] of Object.entries(departmentMap)) {
    if (query.toLowerCase().includes(key)) {
      return value;
    }
  }
  
  return null;
}

// Function to parse natural language query and extract parameters
function parseQuery(query: string): QueryParams {
  const dateStr = extractDateFromQuery(query);
  const department = extractDepartmentFromQuery(query);
  
  return {
    department,
    date: dateStr
  };
}

// Function to fetch card readings data based on query parameters
async function fetchCardReadings(params: QueryParams): Promise<MessageData[]> {
  try {
    console.log("Fetching card readings with params:", params);
    
    let query = supabase
      .from('card_readings')
      .select(`
        id,
        access_time,
        employee_name,
        employees (
          first_name,
          last_name,
          department_id,
          departments (id, name)
        ),
        device_name,
        device_location
      `)
      .order('access_time', { ascending: true });
    
    // Apply date filter if provided
    if (params.date) {
      const date = new Date(params.date);
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Format dates for Supabase query
      const formattedDate = date.toISOString();
      const formattedNextDay = nextDay.toISOString();
      
      query = query.gte('access_time', formattedDate).lt('access_time', formattedNextDay);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("Error fetching card readings:", error);
      throw error;
    }
    
    console.log("Fetched data:", data);
    
    // Filter by department if provided
    let filteredData = data;
    if (params.department && data) {
      filteredData = data.filter(record => 
        record.employees?.departments?.name?.toLowerCase() === params.department?.toLowerCase()
      );
    }
    
    // Transform data to format needed for message display
    const messageData: MessageData[] = filteredData.map(record => ({
      name: record.employee_name || `${record.employees?.first_name || ''} ${record.employees?.last_name || ''}`.trim(),
      check_in: new Date(record.access_time).toLocaleString('tr-TR'),
      check_out: null, // Card readings don't have exit time by default
      department: record.employees?.departments?.name || 'Bilinmeyen',
      device: record.device_name || '-',
      location: record.device_location || '-'
    }));
    
    return messageData;
  } catch (error) {
    console.error("Error in fetchCardReadings:", error);
    throw error;
  }
}

export async function sendChatMessage(input: string) {
  console.log("Processing chat message:", input);
  
  try {
    // Check if this is a query that can be handled by the natural language parser
    const queryParams = parseQuery(input);
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

    // Get department information from the database
    const { data: departmentsData, error: departmentsError } = await supabase
      .from('departments')
      .select('*');
    
    if (departmentsError) {
      console.error("Error fetching departments:", departmentsError);
    }

    // Get employee information from the database
    const { data: employeesData, error: employeesError } = await supabase
      .from('employees')
      .select(`
        *,
        departments (id, name),
        positions (id, name)
      `);
    
    if (employeesError) {
      console.error("Error fetching employees:", employeesError);
    }

    // Create a context with database information
    let dbContext = "System database information:";
    
    if (departmentsData && departmentsData.length > 0) {
      dbContext += `\nDepartments: ${departmentsData.map(d => `${d.id}: ${d.name}`).join(", ")}`;
    }
    
    if (employeesData && employeesData.length > 0) {
      dbContext += `\nEmployees: ${employeesData.map(e => `${e.first_name} ${e.last_name} (${e.departments?.name || 'No Department'} department, ${e.positions?.name || 'No Position'})`).join("; ")}`;
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
}

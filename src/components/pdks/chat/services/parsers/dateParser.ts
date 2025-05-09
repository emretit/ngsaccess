
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

// Helper function to extract date from a query string
export function extractDateFromQuery(query: string): string | null {
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

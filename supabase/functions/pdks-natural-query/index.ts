
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

console.log('PDKS Natural Query: Function initialized with Supabase URL:', Deno.env.get('SUPABASE_URL')?.substring(0, 15) + '...');

// Helper function to convert month names to numbers
const aylarMap: Record<string, string> = {
  'ocak': '01', 'şubat': '02', 'mart': '03', 'nisan': '04', 'mayıs': '05', 'haziran': '06',
  'temmuz': '07', 'ağustos': '08', 'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12',
  // Add English months for versatility
  'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
  'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12'
};

// Helper function for text normalization (remove accents, lowercase)
const normalizeText = (text: string): string => {
  return text.toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

serve(async (req) => {
  console.log(`PDKS Natural Query: Received ${req.method} request`);

  // CORS checks
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get request parameters
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      throw new Error("Query must be provided as a string");
    }
    
    const queryLower = query.toLowerCase();
    const queryNormalized = normalizeText(query);
    
    console.log(`PDKS Natural Query: Received query: "${queryLower}"`);
    console.log(`PDKS Natural Query: Normalized query: "${queryNormalized}"`);

    // Extract department name (if any)
    let departmentFilter = null;
    const departmentKeywords = [
      'finans', 'bilgi teknolojileri', 'insan kaynakları', 'muhasebe', 
      'satış', 'pazarlama', 'üretim', 'ar-ge', 'lojistik', 'it', 'finance', 
      'hr', 'marketing', 'sales', 'accounting', 'engineering', 'mühendislik'
    ];
    
    // First check for department prefixes/suffixes to improve detection
    const deptPrefixes = ['departman', 'bölüm', 'birim', 'department'];
    
    for (const prefix of deptPrefixes) {
      // Look for patterns like "engineering departmanı" or "departman engineering"
      const prefixRegex = new RegExp(`(\\w+)\\s+${prefix}`, 'i');
      const suffixRegex = new RegExp(`${prefix}\\s+(\\w+)`, 'i');
      
      const prefixMatch = queryNormalized.match(prefixRegex);
      const suffixMatch = queryNormalized.match(suffixRegex);
      
      if (prefixMatch && prefixMatch[1]) {
        const potentialDept = prefixMatch[1].toLowerCase();
        console.log(`PDKS Natural Query: Potential department from prefix pattern: "${potentialDept}"`);
        if (departmentKeywords.includes(potentialDept) || potentialDept === 'engineering' || potentialDept === 'mühendislik') {
          departmentFilter = potentialDept;
          console.log(`PDKS Natural Query: Detected department filter from prefix pattern: "${departmentFilter}"`);
          break;
        }
      }
      
      if (suffixMatch && suffixMatch[1]) {
        const potentialDept = suffixMatch[1].toLowerCase();
        console.log(`PDKS Natural Query: Potential department from suffix pattern: "${potentialDept}"`);
        if (departmentKeywords.includes(potentialDept) || potentialDept === 'engineering' || potentialDept === 'mühendislik') {
          departmentFilter = potentialDept;
          console.log(`PDKS Natural Query: Detected department filter from suffix pattern: "${departmentFilter}"`);
          break;
        }
      }
    }
    
    // If no department found using prefix/suffix patterns, check for direct mention
    if (!departmentFilter) {
      for (const dept of departmentKeywords) {
        if (queryNormalized.includes(normalizeText(dept))) {
          departmentFilter = dept;
          console.log(`PDKS Natural Query: Detected department filter: "${departmentFilter}"`);
          break;
        }
      }
      
      // Special check for "engineering" as it's being specifically mentioned
      if (!departmentFilter && (queryNormalized.includes('engineering') || queryNormalized.includes('mühendislik'))) {
        departmentFilter = 'engineering';
        console.log(`PDKS Natural Query: Detected special case department filter: "${departmentFilter}"`);
      }
    }

    // Extract month information (if any)
    let monthFilter = null;
    let yearFilter = new Date().getFullYear().toString(); // Default to current year
    
    for (const ay in aylarMap) {
      if (queryNormalized.includes(normalizeText(ay))) {
        monthFilter = aylarMap[ay];
        console.log(`PDKS Natural Query: Detected month filter: "${ay}" (${monthFilter})`);
        break;
      }
    }
    
    // Extract year information (if any)
    const yearMatches = queryLower.match(/20[0-9]{2}/);
    if (yearMatches) {
      yearFilter = yearMatches[0];
      console.log(`PDKS Natural Query: Detected year filter: "${yearFilter}"`);
    }

    // Handle specific date range requests (today, yesterday, this week, this month, last month)
    const now = new Date();
    let startDate: string | null = null;
    let endDate: string | null = null;

    // Time period detection
    if (queryNormalized.includes('bugun') || queryNormalized.includes('today')) {
      const today = now.toISOString().split('T')[0];
      startDate = `${today}T00:00:00`;
      endDate = `${today}T23:59:59`;
      console.log(`PDKS Natural Query: Detected time period: Today (${startDate} to ${endDate})`);
    } 
    else if (queryNormalized.includes('dun') || queryNormalized.includes('yesterday')) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      startDate = `${yesterdayStr}T00:00:00`;
      endDate = `${yesterdayStr}T23:59:59`;
      console.log(`PDKS Natural Query: Detected time period: Yesterday (${startDate} to ${endDate})`);
    }
    else if (queryNormalized.includes('hafta') || queryNormalized.includes('week')) {
      // Get the start of this week (Sunday or Monday depending on locale)
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Go to the start of the week (Sunday)
      const weekStartStr = weekStart.toISOString().split('T')[0];
      startDate = `${weekStartStr}T00:00:00`;
      endDate = `${now.toISOString().split('T')[0]}T23:59:59`;
      console.log(`PDKS Natural Query: Detected time period: This week (${startDate} to ${endDate})`);
    }
    else if (queryNormalized.includes('bu ay') || queryNormalized.includes('this month')) {
      // Get the start of this month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthStartStr = monthStart.toISOString().split('T')[0];
      startDate = `${monthStartStr}T00:00:00`;
      endDate = `${now.toISOString().split('T')[0]}T23:59:59`;
      console.log(`PDKS Natural Query: Detected time period: This month (${startDate} to ${endDate})`);
    }

    // Create base query
    console.log('PDKS Natural Query: Building Supabase query');
    let supabaseQuery = supabaseClient
      .from('card_readings')
      .select(`
        id,
        access_time,
        employee_name,
        device_name,
        device_location,
        status,
        employees:employee_id(
          first_name,
          last_name,
          department:departments(name)
        )
      `);
    
    // Add filters based on extracted information
    if (departmentFilter) {
      // Map common department aliases
      if (departmentFilter === 'it' || departmentFilter === 'bilgi teknolojileri') {
        departmentFilter = 'IT';
      } else if (departmentFilter === 'engineering' || departmentFilter === 'mühendislik') {
        departmentFilter = 'Engineering';
      } else if (departmentFilter === 'finans' || departmentFilter === 'finance') {
        departmentFilter = 'Finans';
      } else if (departmentFilter === 'hr' || departmentFilter === 'insan kaynakları') {
        departmentFilter = 'İnsan Kaynakları';
      }
      
      console.log(`PDKS Natural Query: Adding department filter for "${departmentFilter}"`);
      supabaseQuery = supabaseQuery.eq('employees.department.name', departmentFilter);
    }

    // Apply date filters from either specific date range or month/year
    if (startDate && endDate) {
      console.log(`PDKS Natural Query: Adding specific date range filter from "${startDate}" to "${endDate}"`);
      supabaseQuery = supabaseQuery.gte('access_time', startDate).lte('access_time', endDate);
    } 
    else if (monthFilter) {
      const startMonth = `${yearFilter}-${monthFilter}-01T00:00:00`;
      
      // Calculate month end
      const nextMonthNum = parseInt(monthFilter) + 1;
      let nextMonth = nextMonthNum <= 12 ? nextMonthNum : 1;
      let nextMonthYear = parseInt(yearFilter);
      if (nextMonth === 1) {
        nextMonthYear++;
      }
      const nextMonthStr = nextMonth < 10 ? `0${nextMonth}` : `${nextMonth}`;
      const endMonth = `${nextMonthYear}-${nextMonthStr}-01T00:00:00`;
      
      console.log(`PDKS Natural Query: Adding month range filter from "${startMonth}" to "${endMonth}"`);
      supabaseQuery = supabaseQuery.gte('access_time', startMonth).lt('access_time', endMonth);
    }

    // Add employee name filter if present
    const nameMatch = query.match(/(\w+\s\w+)(\'nin)/i) || query.match(/(\w+\s\w+)\siçin/i);
    if (nameMatch) {
      const employeeName = nameMatch[1];
      console.log(`PDKS Natural Query: Adding employee name filter for "${employeeName}"`);
      supabaseQuery = supabaseQuery.ilike('employee_name', `%${employeeName}%`);
    }

    // Sort by access time
    supabaseQuery = supabaseQuery.order('access_time', { ascending: false });

    // Execute query
    console.log("PDKS Natural Query: Executing Supabase query");
    const { data, error } = await supabaseQuery;

    if (error) {
      console.error("PDKS Natural Query: Query error:", error);
      throw error;
    }

    console.log(`PDKS Natural Query: Found ${data?.length || 0} records`);

    // Format response data
    const formattedResponse = data?.map(record => {
      // Extract department name
      let departmentName = 'Bilinmiyor';
      if (record.employees && record.employees.department) {
        departmentName = record.employees.department.name;
      }
      
      // Format date in a readable way
      const accessTime = new Date(record.access_time);
      const formattedDate = accessTime.toLocaleDateString('tr-TR');
      const formattedTime = accessTime.toLocaleTimeString('tr-TR');
      
      return {
        name: record.employee_name || 'Bilinmiyor',
        check_in: record.access_time,
        check_out: null, // Will be populated for paired records in a future enhancement
        department: departmentName,
        device: record.device_name,
        location: record.device_location
      };
    }) || [];

    // Create logical explanation based on extracted filters
    let explanation = "İşte sorgunuza göre rapor sonuçları";
    
    if (departmentFilter && monthFilter) {
      const ayIsimi = Object.keys(aylarMap).find(key => aylarMap[key] === monthFilter) || 'bilinmeyen ay';
      explanation = `${departmentFilter.charAt(0).toUpperCase() + departmentFilter.slice(1)} departmanı için ${ayIsimi} ${yearFilter} dönemine ait giriş kayıtları`;
    } 
    else if (departmentFilter && startDate && endDate) {
      const startDateStr = new Date(startDate).toLocaleDateString('tr-TR');
      const endDateStr = new Date(endDate).toLocaleDateString('tr-TR');
      explanation = `${departmentFilter.charAt(0).toUpperCase() + departmentFilter.slice(1)} departmanı için ${startDateStr} - ${endDateStr} tarih aralığındaki giriş kayıtları`;
    }
    else if (departmentFilter) {
      explanation = `${departmentFilter.charAt(0).toUpperCase() + departmentFilter.slice(1)} departmanı için giriş kayıtları`;
    } 
    else if (monthFilter) {
      const ayIsimi = Object.keys(aylarMap).find(key => aylarMap[key] === monthFilter) || 'bilinmeyen ay';
      explanation = `${ayIsimi} ${yearFilter} dönemine ait giriş kayıtları`;
    }
    else if (startDate && endDate) {
      const startDateStr = new Date(startDate).toLocaleDateString('tr-TR');
      const endDateStr = new Date(endDate).toLocaleDateString('tr-TR');
      explanation = `${startDateStr} - ${endDateStr} tarih aralığındaki giriş kayıtları`;
    }

    console.log(`PDKS Natural Query: Sending response with explanation: "${explanation}"`);
    return new Response(JSON.stringify({ 
      records: formattedResponse,
      explanation: explanation,
      queryParams: {
        department: departmentFilter,
        month: monthFilter,
        year: yearFilter,
        startDate,
        endDate
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('PDKS Natural Query Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        explanation: "Üzgünüm, sorgunuzu işlerken bir hata oluştu." 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

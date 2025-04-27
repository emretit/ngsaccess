
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
  'temmuz': '07', 'ağustos': '08', 'eylül': '09', 'ekim': '10', 'kasım': '11', 'aralık': '12'
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
    const queryLower = query.toLowerCase();
    
    console.log(`PDKS Natural Query: Received query: "${queryLower}"`);

    // Extract department name (if any)
    let departmentFilter = null;
    const departmanMatches = queryLower.match(/(finans|bilgi teknolojileri|insan kaynakları|muhasebe|satış|pazarlama|üretim|ar-ge|lojistik) departman[ıi]/);
    if (departmanMatches) {
      departmentFilter = departmanMatches[1];
      console.log(`PDKS Natural Query: Detected department filter: "${departmentFilter}"`);
    }

    // Extract month information (if any)
    let monthFilter = null;
    let yearFilter = new Date().getFullYear().toString(); // Default to current year
    
    for (const ay in aylarMap) {
      if (queryLower.includes(ay)) {
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
          department:departments(name)
        )
      `);
    
    // Add filters
    if (departmentFilter) {
      console.log(`PDKS Natural Query: Adding department filter for "${departmentFilter}"`);
      supabaseQuery = supabaseQuery.eq('employees.department.name', departmentFilter);
    }

    if (monthFilter) {
      const startDate = `${yearFilter}-${monthFilter}-01T00:00:00`;
      
      // Calculate month end
      let nextMonth = parseInt(monthFilter) + 1;
      let nextMonthYear = parseInt(yearFilter);
      if (nextMonth > 12) {
        nextMonth = 1;
        nextMonthYear++;
      }
      const nextMonthStr = nextMonth < 10 ? `0${nextMonth}` : `${nextMonth}`;
      const endDate = `${nextMonthYear}-${nextMonthStr}-01T00:00:00`;
      
      console.log(`PDKS Natural Query: Adding date range filter from "${startDate}" to "${endDate}"`);
      supabaseQuery = supabaseQuery.gte('access_time', startDate).lt('access_time', endDate);
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
      // Access time
      const accessTime = new Date(record.access_time);
      
      // Extract department name
      let departmentName = 'Bilinmiyor';
      if (record.employees && record.employees.department) {
        departmentName = record.employees.department.name;
      }
      
      return {
        name: record.employee_name || 'Bilinmiyor',
        check_in: record.access_time,
        check_out: null, // Exit information will be processed according to entry/exit logic
        department: departmentName 
      };
    }) || [];

    // Create logical explanation
    let explanation = "İşte sorgunuza göre rapor sonuçları";
    if (departmentFilter && monthFilter) {
      const ayIsimleri = Object.keys(aylarMap).find(key => aylarMap[key] === monthFilter);
      explanation = `${departmentFilter.charAt(0).toUpperCase() + departmentFilter.slice(1)} departmanı için ${ayIsimleri} ${yearFilter} dönemine ait giriş kayıtları`;
    } else if (departmentFilter) {
      explanation = `${departmentFilter.charAt(0).toUpperCase() + departmentFilter.slice(1)} departmanı için giriş kayıtları`;
    } else if (monthFilter) {
      const ayIsimleri = Object.keys(aylarMap).find(key => aylarMap[key] === monthFilter);
      explanation = `${ayIsimleri} ${yearFilter} dönemine ait giriş kayıtları`;
    }

    console.log(`PDKS Natural Query: Sending response with explanation: "${explanation}"`);
    return new Response(JSON.stringify({ 
      records: formattedResponse,
      explanation: explanation
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
